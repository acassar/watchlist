import request from 'supertest';
import { GROUP_MAX_ACTIVE_TITLES } from '@watchlist/shared';
import {
  createTestApp,
  createUser,
  resetDatabase,
  type TestApp,
} from './helpers.js';
import { MediaRefreshService } from '../src/media/media-refresh.service.js';
import { mockYouTube } from './youtube-mock.js';

type User = Awaited<ReturnType<typeof createUser>>;

const RICK = 'dQw4w9WgXcQ';
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 3600 * 1000);
const CAT = 'J---aiyznGQ';

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Ajout de titres par lien YouTube (e2e)', () => {
  let t: TestApp;
  let adrien: User;
  let camille: User;
  let sam: User;
  let groupId: string;
  let youtube: ReturnType<typeof mockYouTube>;

  const http = () => request(t.app.getHttpServer());

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

  const resolve = (user: User, url: string) =>
    http().get('/api/media/resolve').query({ url }).set(user.auth);

  const add = (user: User, id: string, body: Record<string, unknown>) =>
    http().post(`/api/groups/${id}/titles`).set(user.auth).send(body);

  const list = (user: User, id: string) =>
    http().get(`/api/groups/${id}/titles`).set(user.auth);

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    youtube = mockYouTube({
      [RICK]: {
        title: 'Never Gonna Give You Up',
        channel: 'Rick Astley',
        duration: 'PT3M33S',
      },
      [CAT]: { title: 'Keyboard Cat', channel: 'Charlie', duration: 'PT54S' },
    });
    await resetDatabase(t.prisma);
    adrien = await createUser(t, 'Adrien');
    camille = await createUser(t, 'Camille');
    sam = await createUser(t, 'Sam');
    groupId = await createGroup(adrien);
    await join(camille, groupId, adrien);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('aperçu d’un lien', () => {
    it('exige d’être connecté', async () => {
      await http()
        .get('/api/media/resolve')
        .query({ url: `https://youtu.be/${RICK}` })
        .expect(401);
    });

    it('renvoie titre, chaîne, miniature et durée', async () => {
      const res = await resolve(
        adrien,
        `Regarde ça https://youtu.be/${RICK}?si=xyz`,
      ).expect(200);

      expect(res.body).toEqual({
        source: 'YOUTUBE',
        externalId: RICK,
        url: `https://www.youtube.com/watch?v=${RICK}`,
        title: 'Never Gonna Give You Up',
        author: 'Rick Astley',
        thumbnailUrl: `https://i.ytimg.com/vi/${RICK}/mqdefault.jpg`,
        durationSec: 213,
      });
    });

    it('ne redemande pas à YouTube une vidéo déjà connue', async () => {
      await resolve(adrien, `https://youtu.be/${RICK}`).expect(200);
      const calls = youtube.calls.length;

      await resolve(
        camille,
        `https://www.youtube.com/watch?v=${RICK}&t=10`,
      ).expect(200);
      expect(youtube.calls).toHaveLength(calls);
    });

    it('rafraîchit une vidéo connue depuis plus de 28 jours', async () => {
      await resolve(adrien, `https://youtu.be/${RICK}`).expect(200);
      await t.prisma.mediaItem.updateMany({
        data: { fetchedAt: daysAgo(28.5) },
      });
      youtube.videos[RICK].title = 'Never Gonna Give You Up (4K)';

      const res = await resolve(adrien, `https://youtu.be/${RICK}`).expect(200);
      expect(res.body.title).toBe('Never Gonna Give You Up (4K)');
    });

    it('refuse un lien d’un service non pris en charge', async () => {
      const res = await resolve(adrien, 'https://vimeo.com/123').expect(400);
      expect(res.body.code).toBe('UNSUPPORTED_URL');
      expect(youtube.calls).toHaveLength(0);
    });

    it('refuse un texte sans lien', async () => {
      const res = await resolve(adrien, 'coucou').expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('signale une vidéo introuvable ou privée', async () => {
      const res = await resolve(adrien, 'https://youtu.be/AAAAAAAAAAA').expect(
        404,
      );
      expect(res.body.code).toBe('MEDIA_NOT_FOUND');
    });

    it('signale un YouTube injoignable', async () => {
      youtube.down = true;
      const res = await resolve(adrien, `https://youtu.be/${RICK}`).expect(502);
      expect(res.body.code).toBe('MEDIA_UNAVAILABLE');
    });
  });

  describe('ajout à un groupe', () => {
    it('ajoute le titre avec « Sans moi, ok » par défaut pour celui qui ajoute', async () => {
      const res = await add(adrien, groupId, {
        url: `https://youtu.be/${RICK}`,
      }).expect(201);

      expect(res.body).toMatchObject({
        media: { title: 'Never Gonna Give You Up', durationSec: 213 },
        addedBy: { userId: adrien.id, displayName: 'Adrien' },
        myStatus: 'OK_ALONE',
      });
      expect(typeof res.body.id).toBe('string');
    });

    it('garde l’avis choisi, et les autres membres n’ont pas encore d’avis', async () => {
      await add(adrien, groupId, {
        url: `https://youtu.be/${RICK}`,
        status: 'TOGETHER',
      }).expect(201);

      const mine = await list(adrien, groupId).expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].myStatus).toBe('TOGETHER');

      const theirs = await list(camille, groupId).expect(200);
      expect(theirs.body[0].myStatus).toBe('PENDING');
    });

    it('liste les plus récents d’abord', async () => {
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` });
      await add(camille, groupId, { url: `https://youtu.be/${CAT}` });

      const res = await list(adrien, groupId).expect(200);
      expect(
        res.body.map((x: { media: { title: string } }) => x.media.title),
      ).toEqual(['Keyboard Cat', 'Never Gonna Give You Up']);
    });

    it('refuse un doublon, même collé sous une autre forme', async () => {
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` }).expect(
        201,
      );
      const res = await add(camille, groupId, {
        url: `https://www.youtube.com/shorts/${RICK}`,
      }).expect(409);
      expect(res.body.code).toBe('TITLE_ALREADY_IN_GROUP');
    });

    it('partage les métadonnées entre groupes', async () => {
      const other = await createGroup(sam, 'Coloc');
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` }).expect(
        201,
      );
      await add(sam, other, { url: `https://youtu.be/${RICK}` }).expect(201);

      expect(await t.prisma.mediaItem.count()).toBe(1);
      expect(await t.prisma.groupTitle.count()).toBe(2);
    });

    describe(`${GROUP_MAX_ACTIVE_TITLES} titres en cours au plus`, () => {
      /** Remplit la liste de titres en cours, sans passer par YouTube. */
      async function fill(count: number, watchedTogetherAt: Date | null) {
        for (let i = 0; i < count; i++) {
          const media = await t.prisma.mediaItem.create({
            data: {
              source: 'YOUTUBE',
              externalId: `seed${String(i).padStart(7, '0')}`,
              url: `https://youtu.be/seed${i}`,
              title: `Titre ${i}`,
              fetchedAt: new Date(),
            },
          });
          await t.prisma.groupTitle.create({
            data: { groupId, mediaItemId: media.id, watchedTogetherAt },
          });
        }
      }

      it('refuse un ajout quand la liste en cours est pleine', async () => {
        await fill(GROUP_MAX_ACTIVE_TITLES, null);
        const res = await add(adrien, groupId, {
          url: `https://youtu.be/${RICK}`,
        }).expect(409);
        expect(res.body.code).toBe('TOO_MANY_ACTIVE_TITLES');
        // Refusé avant d'interroger YouTube.
        expect(youtube.calls).toHaveLength(0);
      });

      it('ne compte pas les titres vus ensemble', async () => {
        await fill(GROUP_MAX_ACTIVE_TITLES - 1, null);
        await add(adrien, groupId, { url: `https://youtu.be/${CAT}` }).expect(
          201,
        );
        const cat = await t.prisma.groupTitle.findFirstOrThrow({
          where: { mediaItem: { externalId: CAT } },
        });
        await http()
          .put(`/api/groups/${groupId}/titles/${cat.id}/watched-together`)
          .set(adrien.auth)
          .expect(200);
        await add(adrien, groupId, { url: `https://youtu.be/${RICK}` }).expect(
          201,
        );

        // Liste pleine : annuler le « vu ensemble » la ferait déborder.
        const res = await http()
          .delete(`/api/groups/${groupId}/titles/${cat.id}/watched-together`)
          .set(adrien.auth)
          .expect(409);
        expect(res.body.code).toBe('TOO_MANY_ACTIVE_TITLES');
      });
    });

    it('est réservé aux membres du groupe', async () => {
      await add(sam, groupId, { url: `https://youtu.be/${RICK}` }).expect(404);
      await list(sam, groupId).expect(404);
      expect(youtube.calls).toHaveLength(0);
    });

    it('refuse un avis inconnu', async () => {
      const res = await add(adrien, groupId, {
        url: `https://youtu.be/${RICK}`,
        status: 'PENDING',
      }).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('n’ajoute rien si la vidéo est introuvable', async () => {
      await add(adrien, groupId, {
        url: 'https://youtu.be/AAAAAAAAAAA',
      }).expect(404);
      expect(await t.prisma.groupTitle.count()).toBe(0);
    });

    it('les titres disparaissent avec le groupe, pas les métadonnées', async () => {
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` });
      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(camille.auth)
        .expect(204);
      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(adrien.auth)
        .expect(204);

      expect(await t.prisma.groupTitle.count()).toBe(0);
      expect(await t.prisma.memberStatus.count()).toBe(0);
      expect(await t.prisma.mediaItem.count()).toBe(1);
    });
  });

  describe('conservation des données YouTube (30 jours au plus)', () => {
    const refresh = () => t.app.get(MediaRefreshService).refreshStale();
    const ageAll = (days: number) =>
      t.prisma.mediaItem.updateMany({ data: { fetchedAt: daysAgo(days) } });

    it('rafraîchit les titres des listes et supprime les autres', async () => {
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` }).expect(
        201,
      );
      await resolve(adrien, `https://youtu.be/${CAT}`).expect(200);
      await ageAll(29.5);
      youtube.videos[RICK].duration = 'PT3M34S';

      expect(await refresh()).toEqual({
        refreshed: 1,
        gone: 0,
        failed: 0,
        deleted: 1,
      });
      const items = await t.prisma.mediaItem.findMany();
      expect(items).toHaveLength(1);
      expect(items[0].externalId).toBe(RICK);
      expect(items[0].durationSec).toBe(214);
      expect(Date.now() - items[0].fetchedAt.getTime()).toBeLessThan(60_000);
    });

    it('ne touche pas aux données récentes', async () => {
      await resolve(adrien, `https://youtu.be/${CAT}`).expect(200);
      await ageAll(28.5);

      expect(await refresh()).toEqual({
        refreshed: 0,
        gone: 0,
        failed: 0,
        deleted: 0,
      });
      expect(youtube.calls).toHaveLength(2);
    });

    it('vidéo supprimée : le titre reste, sans la durée', async () => {
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` }).expect(
        201,
      );
      await ageAll(29.5);
      delete youtube.videos[RICK];

      expect((await refresh()).gone).toBe(1);
      const [title] = (await list(adrien, groupId).expect(200)).body;
      expect(title.media.title).toBe('Never Gonna Give You Up');
      expect(title.media.durationSec).toBeNull();
    });

    it('YouTube injoignable : rien n’est perdu, nouvel essai plus tard', async () => {
      await add(adrien, groupId, { url: `https://youtu.be/${RICK}` }).expect(
        201,
      );
      await ageAll(29.5);
      youtube.down = true;

      expect((await refresh()).failed).toBe(1);
      const item = await t.prisma.mediaItem.findFirstOrThrow();
      expect(item.durationSec).toBe(213);
    });
  });
});
