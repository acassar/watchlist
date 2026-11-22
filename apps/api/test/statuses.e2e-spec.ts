import type { GroupTitle } from '@watchlist/shared';
import request from 'supertest';
import {
  createTestApp,
  createUser,
  resetDatabase,
  type TestApp,
} from './helpers.js';

type User = Awaited<ReturnType<typeof createUser>>;

let videoCounter = 0;

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Avis, vues et suivi « vu » (e2e)', () => {
  let t: TestApp;
  let adrien: User;
  let camille: User;
  let sam: User;
  let groupId: string;

  const http = () => request(t.app.getHttpServer());
  const base = (id = groupId) => `/api/groups/${id}/titles`;

  async function createGroup(owner: User, name = 'Nous deux') {
    const res = await http()
      .post('/api/groups')
      .set(owner.auth)
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  async function join(user: User, id: string, by: User) {
    const invite = await http()
      .post(`/api/groups/${id}/invitations`)
      .set(by.auth)
      .send({})
      .expect(201);
    await http()
      .post('/api/invitations/accept')
      .set(user.auth)
      .send({ code: invite.body.code })
      .expect(200);
  }

  /** Titre ajouté directement en base (l'ajout par lien a ses propres tests). */
  async function addTitle(
    by: User,
    status: 'OK_ALONE' | 'TOGETHER' | 'NOT_INTERESTED' = 'OK_ALONE',
    { id = groupId, addedAt = new Date() } = {},
  ) {
    videoCounter += 1;
    const media = await t.prisma.mediaItem.create({
      data: {
        source: 'YOUTUBE',
        externalId: `video${videoCounter}`,
        url: `https://www.youtube.com/watch?v=video${videoCounter}`,
        title: `Vidéo ${videoCounter}`,
        fetchedAt: new Date(),
      },
    });
    const title = await t.prisma.groupTitle.create({
      data: {
        groupId: id,
        mediaItemId: media.id,
        addedById: by.id,
        addedAt,
        statuses: { create: { userId: by.id, status } },
      },
    });
    return title.id;
  }

  const list = async (user: User, id = groupId) =>
    (await http().get(base(id)).set(user.auth).expect(200))
      .body as GroupTitle[];

  /** Vue d'un titre pour un membre, ou `absent` s'il n'est pas dans ses listes actives. */
  async function viewOf(
    user: User,
    titleId: string,
  ): Promise<GroupTitle['view'] | 'absent'> {
    return (await list(user)).find((x) => x.id === titleId)?.view ?? 'absent';
  }

  const setStatus = (user: User, titleId: string, status: string) =>
    http().put(`${base()}/${titleId}/status`).set(user.auth).send({ status });

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    adrien = await createUser(t, 'Adrien');
    camille = await createUser(t, 'Camille');
    sam = await createUser(t, 'Sam');
    groupId = await createGroup(adrien);
    await join(camille, groupId, adrien);
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('les trois vues', () => {
    it('un nouveau titre attend l’avis de l’autre', async () => {
      const id = await addTitle(adrien, 'OK_ALONE');
      expect(await viewOf(adrien, id)).toBe('WAITING');
      expect(await viewOf(camille, id)).toBe('PENDING');
    });

    it('détaille l’avis de chaque membre, moi en premier', async () => {
      const id = await addTitle(adrien, 'TOGETHER');
      const [title] = await list(camille);
      expect(title).toMatchObject({
        id,
        myStatus: 'PENDING',
        myWatchedAloneAt: null,
        watchedTogetherAt: null,
        addedBy: {
          userId: adrien.id,
          displayName: 'Adrien',
          formerMember: false,
        },
        members: [
          {
            userId: camille.id,
            displayName: 'Camille',
            status: 'PENDING',
            counted: true,
          },
          {
            userId: adrien.id,
            displayName: 'Adrien',
            status: 'TOGETHER',
            counted: true,
          },
        ],
      });
    });

    it('« sans moi, ok » des deux côtés : regardable seul pour chacun', async () => {
      const id = await addTitle(adrien, 'OK_ALONE');
      const res = await setStatus(camille, id, 'OK_ALONE').expect(200);
      expect(res.body).toMatchObject({
        id,
        myStatus: 'OK_ALONE',
        view: 'ALONE',
      });
      expect(await viewOf(adrien, id)).toBe('ALONE');
    });

    it('« ensemble » d’un côté : à regarder ensemble pour les deux', async () => {
      const id = await addTitle(adrien, 'OK_ALONE');
      await setStatus(camille, id, 'TOGETHER').expect(200);
      expect(await viewOf(adrien, id)).toBe('TOGETHER');
      expect(await viewOf(camille, id)).toBe('TOGETHER');
    });

    it('« pas pour moi » : sort de mes listes, regardable seul pour l’autre', async () => {
      const id = await addTitle(adrien, 'TOGETHER');
      await setStatus(camille, id, 'NOT_INTERESTED').expect(200);
      expect(await viewOf(camille, id)).toBe('absent');
      expect(await viewOf(adrien, id)).toBe('ALONE');
    });

    it('on peut changer d’avis', async () => {
      const id = await addTitle(adrien);
      await setStatus(camille, id, 'TOGETHER').expect(200);
      await setStatus(camille, id, 'OK_ALONE').expect(200);
      expect(await viewOf(adrien, id)).toBe('ALONE');
    });

    it('à trois : seul quand tous les autres sont d’accord', async () => {
      await join(sam, groupId, adrien);
      const id = await addTitle(adrien);
      await setStatus(camille, id, 'OK_ALONE').expect(200);
      expect(await viewOf(adrien, id)).toBe('WAITING');
      await setStatus(sam, id, 'NOT_INTERESTED').expect(200);
      expect(await viewOf(adrien, id)).toBe('ALONE');
      expect(await viewOf(camille, id)).toBe('ALONE');
    });
  });

  describe('nouveau membre', () => {
    it('ne bloque pas les titres ajoutés avant son arrivée, mais peut donner son avis', async () => {
      const old = await addTitle(adrien, 'OK_ALONE', {
        addedAt: new Date(Date.now() - 60_000),
      });
      await setStatus(camille, old, 'OK_ALONE').expect(200);
      await join(sam, groupId, adrien);

      expect(await viewOf(adrien, old)).toBe('ALONE');
      expect(await viewOf(sam, old)).toBe('PENDING');
      const [title] = await list(adrien);
      expect(title.members.find((m) => m.userId === sam.id)).toMatchObject({
        status: 'PENDING',
        counted: false,
      });

      // Un avis donné engage : son « ensemble » compte.
      await setStatus(sam, old, 'TOGETHER').expect(200);
      expect(await viewOf(adrien, old)).toBe('TOGETHER');
    });

    it('compte pour les titres ajoutés après son arrivée', async () => {
      await join(sam, groupId, adrien);
      const id = await addTitle(adrien);
      await setStatus(camille, id, 'OK_ALONE').expect(200);
      expect(await viewOf(adrien, id)).toBe('WAITING');
    });
  });

  describe('vu seul', () => {
    it('ne retire le titre que de mes listes, et s’annule', async () => {
      const id = await addTitle(adrien);
      await setStatus(camille, id, 'OK_ALONE').expect(200);

      const res = await http()
        .put(`${base()}/${id}/watched-alone`)
        .set(adrien.auth)
        .expect(200);
      expect(res.body.view).toBe('HIDDEN');
      expect(res.body.myWatchedAloneAt).toEqual(expect.any(String));
      expect(await viewOf(adrien, id)).toBe('absent');
      expect(await viewOf(camille, id)).toBe('ALONE');

      const history = await http()
        .get(`${base()}/history`)
        .set(adrien.auth)
        .expect(200);
      expect(history.body.map((x: { id: string }) => x.id)).toEqual([id]);

      await http()
        .delete(`${base()}/${id}/watched-alone`)
        .set(adrien.auth)
        .expect(200);
      expect(await viewOf(adrien, id)).toBe('ALONE');
    });

    it('sans avis donné, enregistre « sans moi, ok »', async () => {
      const id = await addTitle(adrien);
      const res = await http()
        .put(`${base()}/${id}/watched-alone`)
        .set(camille.auth)
        .expect(200);
      expect(res.body.myStatus).toBe('OK_ALONE');
    });

    it('archive le titre quand chacun l’a vu seul ou n’est pas intéressé', async () => {
      const id = await addTitle(adrien);
      await setStatus(camille, id, 'NOT_INTERESTED').expect(200);
      const res = await http()
        .put(`${base()}/${id}/watched-alone`)
        .set(adrien.auth)
        .expect(200);
      expect(res.body.view).toBe('ARCHIVED');
      const history = await http()
        .get(`${base()}/history`)
        .set(camille.auth)
        .expect(200);
      expect(history.body[0]).toMatchObject({ id, view: 'ARCHIVED' });
    });
  });

  describe('vu ensemble', () => {
    it('archive le titre pour tout le groupe, avec la date, et s’annule', async () => {
      const id = await addTitle(adrien, 'TOGETHER');
      await setStatus(camille, id, 'TOGETHER').expect(200);
      const watchedAt = '2026-11-21T21:30:00.000Z';

      const res = await http()
        .put(`${base()}/${id}/watched-together`)
        .set(camille.auth)
        .send({ watchedAt })
        .expect(200);
      expect(res.body).toMatchObject({
        view: 'ARCHIVED',
        watchedTogetherAt: watchedAt,
      });
      expect(await list(adrien)).toEqual([]);
      expect(await list(camille)).toEqual([]);

      const history = await http()
        .get(`${base()}/history`)
        .set(adrien.auth)
        .expect(200);
      expect(history.body[0]).toMatchObject({
        id,
        watchedTogetherAt: watchedAt,
      });

      await http()
        .delete(`${base()}/${id}/watched-together`)
        .set(adrien.auth)
        .expect(200);
      expect(await viewOf(adrien, id)).toBe('TOGETHER');
    });

    it('prend maintenant par défaut', async () => {
      const id = await addTitle(adrien, 'TOGETHER');
      const before = Date.now();
      const res = await http()
        .put(`${base()}/${id}/watched-together`)
        .set(adrien.auth)
        .expect(200);
      expect(
        new Date(res.body.watchedTogetherAt).getTime(),
      ).toBeGreaterThanOrEqual(before - 1000);
    });

    it('refuse une date dans le futur', async () => {
      const id = await addTitle(adrien, 'TOGETHER');
      const res = await http()
        .put(`${base()}/${id}/watched-together`)
        .set(adrien.auth)
        .send({ watchedAt: new Date(Date.now() + 86_400_000).toISOString() })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('départ d’un membre', () => {
    it('ses avis disparaissent, ses titres restent avec « ancien membre »', async () => {
      const id = await addTitle(camille, 'TOGETHER');
      await setStatus(adrien, id, 'OK_ALONE').expect(200);
      expect(await viewOf(adrien, id)).toBe('TOGETHER');

      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(camille.auth)
        .expect(204);

      const [title] = await list(adrien);
      expect(title).toMatchObject({
        id,
        view: 'ALONE',
        addedBy: { userId: camille.id, formerMember: true },
      });
      expect(title.members).toHaveLength(1);
      expect(
        await t.prisma.memberStatus.count({ where: { userId: camille.id } }),
      ).toBe(0);
    });
  });

  describe('accès', () => {
    it('est réservé aux membres du groupe', async () => {
      const id = await addTitle(adrien);
      await setStatus(sam, id, 'OK_ALONE').expect(404);
      await http().get(`${base()}/history`).set(sam.auth).expect(404);
    });

    it('refuse un titre d’un autre groupe', async () => {
      const other = await createGroup(sam, 'Coloc');
      const id = await addTitle(sam, 'OK_ALONE', { id: other });
      const res = await setStatus(adrien, id, 'OK_ALONE').expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
      await http()
        .put(`${base()}/${id}/watched-together`)
        .set(adrien.auth)
        .expect(404);
    });

    it('répond 404 pour un identifiant mal formé', async () => {
      await setStatus(adrien, 'pas-un-uuid', 'OK_ALONE').expect(404);
    });

    it('refuse un avis inconnu (PENDING ne se choisit pas)', async () => {
      const id = await addTitle(adrien);
      await setStatus(camille, id, 'PENDING').expect(400);
      await setStatus(camille, id, 'MAYBE').expect(400);
    });
  });
});
