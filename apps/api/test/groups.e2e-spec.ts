import request from 'supertest';
import {
  createTestApp,
  createUser,
  resetDatabase,
  type TestApp,
} from './helpers.js';

type User = Awaited<ReturnType<typeof createUser>>;

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Groupes et invitations (e2e)', () => {
  let t: TestApp;
  let adrien: User;
  let camille: User;
  let sam: User;

  const http = () => request(t.app.getHttpServer());

  async function createGroup(owner: User, name = 'Nous deux') {
    const res = await http()
      .post('/api/groups')
      .set(owner.auth)
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  async function invite(
    member: User,
    groupId: string,
    body: Record<string, unknown> = {},
  ) {
    const res = await http()
      .post(`/api/groups/${groupId}/invitations`)
      .set(member.auth)
      .send(body)
      .expect(201);
    const token = new URL(res.body.url as string).hash.replace('#token=', '');
    return {
      ...(res.body as { id: string; code: string; url: string }),
      token,
    };
  }

  function accept(user: User, body: Record<string, string>) {
    return http().post('/api/invitations/accept').set(user.auth).send(body);
  }

  async function join(user: User, groupId: string, by: User) {
    const { token } = await invite(by, groupId);
    await accept(user, { token }).expect(200);
  }

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    adrien = await createUser(t, 'Adrien');
    camille = await createUser(t, 'Camille');
    sam = await createUser(t, 'Sam');
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('création et consultation', () => {
    it('crée un groupe d’un seul membre dont le créateur est propriétaire', async () => {
      const res = await http()
        .post('/api/groups')
        .set(adrien.auth)
        .send({ name: '  Nous deux ' })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Nous deux',
        role: 'OWNER',
        memberCount: 1,
        members: [{ userId: adrien.id, displayName: 'Adrien', role: 'OWNER' }],
      });

      const list = await http().get('/api/groups').set(adrien.auth).expect(200);
      expect(list.body).toEqual([
        { id: res.body.id, name: 'Nous deux', role: 'OWNER', memberCount: 1 },
      ]);
    });

    it('liste plusieurs groupes par ordre alphabétique', async () => {
      await createGroup(adrien, 'Coloc');
      await createGroup(adrien, 'Amis');
      const list = await http().get('/api/groups').set(adrien.auth).expect(200);
      expect(list.body.map((g: { name: string }) => g.name)).toEqual([
        'Amis',
        'Coloc',
      ]);
    });

    it('refuse un nom vide', async () => {
      const res = await http()
        .post('/api/groups')
        .set(adrien.auth)
        .send({ name: ' ' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('exige d’être connecté', async () => {
      await http().get('/api/groups').expect(401);
    });

    it('répond 404 à un non-membre, comme pour un groupe inexistant', async () => {
      const groupId = await createGroup(adrien);
      await http().get(`/api/groups/${groupId}`).set(camille.auth).expect(404);
      await http()
        .get(`/api/groups/${groupId}/invitations`)
        .set(camille.auth)
        .expect(404);
      await http()
        .post(`/api/groups/${groupId}/invitations`)
        .set(camille.auth)
        .send({})
        .expect(404);
      await http().get('/api/groups/pas-un-uuid').set(adrien.auth).expect(404);
      await http()
        .get('/api/groups/00000000-0000-4000-8000-000000000000')
        .set(adrien.auth)
        .expect(404);
    });

    it('réserve le renommage au propriétaire', async () => {
      const groupId = await createGroup(adrien);
      await join(camille, groupId, adrien);

      const refused = await http()
        .patch(`/api/groups/${groupId}`)
        .set(camille.auth)
        .send({ name: 'Piraté' })
        .expect(403);
      expect(refused.body.code).toBe('OWNER_ONLY');

      const res = await http()
        .patch(`/api/groups/${groupId}`)
        .set(adrien.auth)
        .send({ name: 'Canapé du soir' })
        .expect(200);
      expect(res.body.name).toBe('Canapé du soir');
    });
  });

  describe('invitations', () => {
    it('rejoint par le lien : aperçu, puis entrée comme membre', async () => {
      const groupId = await createGroup(adrien);
      const invitation = await invite(adrien, groupId);
      expect(invitation.url).toMatch(/^http:\/\/canapact\.test\/join#token=/);
      expect(invitation.code).toMatch(/^[A-Z2-9]{8}$/);

      const preview = await http()
        .post('/api/invitations/preview')
        .set(camille.auth)
        .send({ token: invitation.token })
        .expect(200);
      expect(preview.body).toEqual({
        groupId,
        groupName: 'Nous deux',
        memberCount: 1,
        invitedBy: 'Adrien',
        alreadyMember: false,
      });

      const joined = await accept(camille, { token: invitation.token }).expect(
        200,
      );
      expect(joined.body).toEqual({
        id: groupId,
        name: 'Nous deux',
        role: 'MEMBER',
        memberCount: 2,
      });

      const detail = await http()
        .get(`/api/groups/${groupId}`)
        .set(camille.auth)
        .expect(200);
      expect(detail.body.members.map((m: { role: string }) => m.role)).toEqual([
        'OWNER',
        'MEMBER',
      ]);
    });

    it('ne stocke que le hash du jeton', async () => {
      const groupId = await createGroup(adrien);
      const { token, id } = await invite(adrien, groupId);
      const row = await t.prisma.invitation.findUniqueOrThrow({
        where: { id },
      });
      expect(row.tokenHash).not.toContain(token);
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejoint par le code, tapé en minuscules avec un tiret', async () => {
      const groupId = await createGroup(adrien);
      const { code } = await invite(adrien, groupId);
      const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();

      await accept(camille, { code: typed }).expect(200);
      const list = await http()
        .get('/api/groups')
        .set(camille.auth)
        .expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('déjà membre : renvoie le groupe sans consommer d’utilisation', async () => {
      const groupId = await createGroup(adrien);
      const { token, id } = await invite(adrien, groupId, { maxUses: 1 });

      const preview = await http()
        .post('/api/invitations/preview')
        .set(adrien.auth)
        .send({ token })
        .expect(200);
      expect(preview.body.alreadyMember).toBe(true);

      const res = await accept(adrien, { token }).expect(200);
      expect(res.body.role).toBe('OWNER');
      const row = await t.prisma.invitation.findUniqueOrThrow({
        where: { id },
      });
      expect(row.uses).toBe(0);
    });

    it('refuse une invitation épuisée', async () => {
      const groupId = await createGroup(adrien);
      const { token } = await invite(adrien, groupId, { maxUses: 1 });
      await accept(camille, { token }).expect(200);

      const res = await accept(sam, { token }).expect(404);
      expect(res.body.code).toBe('INVITATION_INVALID');
    });

    it('refuse une invitation expirée', async () => {
      const groupId = await createGroup(adrien);
      const { token, id } = await invite(adrien, groupId);
      await t.prisma.invitation.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await accept(camille, { token }).expect(404);
      expect(res.body.code).toBe('INVITATION_INVALID');
    });

    it('refuse un lien ou un code inconnu', async () => {
      const byToken = await accept(camille, { token: 'inconnu' }).expect(404);
      expect(byToken.body.code).toBe('INVITATION_INVALID');
      await accept(camille, { code: 'ABCDEFGH' }).expect(404);
      await accept(camille, { code: 'court' }).expect(400);
    });

    it('révoque : l’invitation disparaît de la liste et ne marche plus', async () => {
      const groupId = await createGroup(adrien);
      const { token, id } = await invite(adrien, groupId);

      await http()
        .delete(`/api/groups/${groupId}/invitations/${id}`)
        .set(adrien.auth)
        .expect(204);

      const list = await http()
        .get(`/api/groups/${groupId}/invitations`)
        .set(adrien.auth)
        .expect(200);
      expect(list.body).toEqual([]);
      await accept(camille, { token }).expect(404);
    });

    it('un membre invite et révoque les siennes, pas celles des autres', async () => {
      const groupId = await createGroup(adrien);
      await join(camille, groupId, adrien);
      const fromAdrien = await invite(adrien, groupId);
      const fromCamille = await invite(camille, groupId);

      const list = await http()
        .get(`/api/groups/${groupId}/invitations`)
        .set(camille.auth)
        .expect(200);
      // + celle qui a servi à faire entrer Camille.
      expect(list.body).toHaveLength(3);
      expect(list.body[0]).toMatchObject({
        id: fromCamille.id,
        createdBy: { userId: camille.id, displayName: 'Camille' },
      });
      expect(list.body[0]).not.toHaveProperty('url');

      await http()
        .delete(`/api/groups/${groupId}/invitations/${fromAdrien.id}`)
        .set(camille.auth)
        .expect(403);
      await http()
        .delete(`/api/groups/${groupId}/invitations/${fromCamille.id}`)
        .set(camille.auth)
        .expect(204);
    });

    it('ne révoque pas une invitation d’un autre groupe', async () => {
      const mine = await createGroup(adrien);
      const theirs = await createGroup(camille);
      const { id } = await invite(camille, theirs);

      await http()
        .delete(`/api/groups/${mine}/invitations/${id}`)
        .set(adrien.auth)
        .expect(404);
    });

    it('refuse d’entrer dans un groupe complet', async () => {
      const groupId = await createGroup(adrien);
      const { token } = await invite(adrien, groupId);
      // Remplit le groupe jusqu'à la limite (20) avec des comptes factices.
      const fillers = await Promise.all(
        Array.from({ length: 19 }, (_, i) => createUser(t, `Membre${i}`)),
      );
      await t.prisma.groupMember.createMany({
        data: fillers.map((f) => ({ groupId, userId: f.id })),
      });

      const res = await accept(camille, { token }).expect(409);
      expect(res.body.code).toBe('GROUP_FULL');
    });
  });

  describe('quitter et retirer', () => {
    it('le dernier membre qui part supprime le groupe', async () => {
      const groupId = await createGroup(adrien);
      await invite(adrien, groupId);

      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(adrien.auth)
        .expect(204);

      expect(await t.prisma.group.count()).toBe(0);
      expect(await t.prisma.invitation.count()).toBe(0);
    });

    it('le propriétaire qui part passe la main au membre arrivé le plus tôt', async () => {
      const groupId = await createGroup(adrien);
      await join(camille, groupId, adrien);
      await join(sam, groupId, adrien);

      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(adrien.auth)
        .expect(204);

      const detail = await http()
        .get(`/api/groups/${groupId}`)
        .set(camille.auth)
        .expect(200);
      expect(detail.body.role).toBe('OWNER');
      expect(
        detail.body.members.map((m: { displayName: string; role: string }) => [
          m.displayName,
          m.role,
        ]),
      ).toEqual([
        ['Camille', 'OWNER'],
        ['Sam', 'MEMBER'],
      ]);
      await http().get(`/api/groups/${groupId}`).set(adrien.auth).expect(404);
    });

    it('les invitations d’un membre qui part sont révoquées', async () => {
      const groupId = await createGroup(adrien);
      await join(camille, groupId, adrien);
      const { token } = await invite(camille, groupId);

      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(camille.auth)
        .expect(204);

      await accept(sam, { token }).expect(404);
    });

    it('le propriétaire retire un membre ; un membre ne peut pas', async () => {
      const groupId = await createGroup(adrien);
      await join(camille, groupId, adrien);
      await join(sam, groupId, adrien);

      const refused = await http()
        .delete(`/api/groups/${groupId}/members/${sam.id}`)
        .set(camille.auth)
        .expect(403);
      expect(refused.body.code).toBe('OWNER_ONLY');

      await http()
        .delete(`/api/groups/${groupId}/members/${sam.id}`)
        .set(adrien.auth)
        .expect(204);
      await http().get(`/api/groups/${groupId}`).set(sam.auth).expect(404);

      const self = await http()
        .delete(`/api/groups/${groupId}/members/${adrien.id}`)
        .set(adrien.auth)
        .expect(400);
      expect(self.body.code).toBe('CANNOT_REMOVE_SELF');

      await http()
        .delete(`/api/groups/${groupId}/members/${sam.id}`)
        .set(adrien.auth)
        .expect(404);
    });
  });
});
