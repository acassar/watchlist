import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PasswordService } from '../src/auth/password.service.js';
import { RefreshTokenService } from '../src/auth/refresh-token.service.js';
import { generateToken, hashToken } from '../src/auth/tokens.js';
import { MailService } from '../src/mail/mail.service.js';
import { RetentionService } from '../src/users/retention.service.js';
import {
  createTestApp,
  createUser,
  refreshCookieFrom,
  resetDatabase,
  type TestApp,
} from './helpers.js';
import { mockYouTube } from './youtube-mock.js';

type User = Awaited<ReturnType<typeof createUser>>;

const RICK = 'dQw4w9WgXcQ';
const CAT = 'J---aiyznGQ';

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Export et suppression du compte (e2e)', () => {
  let t: TestApp;
  let adrien: User;
  let camille: User;
  let sam: User;

  const http = () => request(t.app.getHttpServer());

  async function createGroup(owner: User, name: string) {
    const res = await http()
      .post('/api/groups')
      .set(owner.auth)
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  async function join(user: User, groupId: string, by: User) {
    const invite = await http()
      .post(`/api/groups/${groupId}/invitations`)
      .set(by.auth)
      .send({})
      .expect(201);
    await http()
      .post('/api/invitations/accept')
      .set(user.auth)
      .send({ code: invite.body.code })
      .expect(200);
  }

  async function add(
    user: User,
    groupId: string,
    id: string,
    status = 'TOGETHER',
  ) {
    const res = await http()
      .post(`/api/groups/${groupId}/titles`)
      .set(user.auth)
      .send({ url: `https://youtu.be/${id}`, status })
      .expect(201);
    return res.body.id as string;
  }

  /** Ajoute un jeton valide à la famille et renvoie sa valeur brute. */
  async function currentToken(userId: string, familyId: string) {
    const raw = generateToken();
    await t.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 1e9),
      },
    });
    return raw;
  }

  const remove = (user: User, body: Record<string, unknown>) =>
    http().post('/api/me/delete').set(user.auth).send(body);

  async function setPassword(user: User, password: string) {
    await t.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await t.app.get(PasswordService).hash(password) },
    });
  }

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    mockYouTube({
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('export', () => {
    it('renvoie toutes les données de la personne, sans secret, en pièce jointe', async () => {
      await setPassword(adrien, 'canape-du-soir');
      const groupId = await createGroup(adrien, 'Nous deux');
      await join(camille, groupId, adrien);
      await add(adrien, groupId, RICK, 'OK_ALONE');
      const catId = await add(camille, groupId, CAT);
      await http()
        .put(`/api/groups/${groupId}/titles/${catId}/status`)
        .set(adrien.auth)
        .send({ status: 'NOT_INTERESTED' })
        .expect(200);

      const res = await http()
        .get('/api/me/export')
        .set(adrien.auth)
        .expect(200);

      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="canapact-export.json"',
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({
        format: 'canapact-export',
        version: 2,
        account: {
          id: adrien.id,
          lastActiveAt: expect.any(String),
          inactivityWarnedAt: null,
          email: 'adrien@exemple.fr',
          displayName: 'Adrien',
          hasPassword: true,
          googleId: null,
        },
        groups: [
          {
            id: groupId,
            name: 'Nous deux',
            role: 'OWNER',
            otherMembers: ['Camille'],
          },
        ],
        addedTitles: [
          {
            groupName: 'Nous deux',
            title: 'Never Gonna Give You Up',
            url: `https://www.youtube.com/watch?v=${RICK}`,
            source: 'YOUTUBE',
          },
        ],
        invitations: [{ groupId, uses: 1 }],
      });
      expect(
        (res.body.statuses as { title: string; status: string }[])
          .map((s) => [s.title, s.status])
          .sort(([a], [b]) => a.localeCompare(b)),
      ).toEqual([
        ['Keyboard Cat', 'NOT_INTERESTED'],
        ['Never Gonna Give You Up', 'OK_ALONE'],
      ]);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('argon2');
      expect(raw).not.toMatch(/hash/i);
    });

    it('ne révèle plus rien d’un groupe quitté', async () => {
      const groupId = await createGroup(adrien, 'Ancienne coloc');
      await join(camille, groupId, adrien);
      const rickId = await add(adrien, groupId, RICK);
      await http()
        .post(`/api/groups/${groupId}/leave`)
        .set(adrien.auth)
        .expect((r) => expect(r.status).toBeLessThan(300));
      await t.prisma.group.update({
        where: { id: groupId },
        data: { name: 'Nouveau nom' },
      });
      await t.prisma.groupTitle.update({
        where: { id: rickId },
        data: { watchedTogetherAt: new Date() },
      });

      const res = await http()
        .get('/api/me/export')
        .set(adrien.auth)
        .expect(200);

      expect(res.body.groups).toEqual([]);
      expect(res.body.addedTitles).toMatchObject([
        { groupId, groupName: null, watchedTogetherAt: null },
      ]);
      expect(res.body.invitations).toMatchObject([
        { groupId, groupName: null },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('Nouveau nom');
    });

    it('exige d’être connecté', async () => {
      await http().get('/api/me/export').expect(401);
    });
  });

  describe('suppression', () => {
    it('supprime réellement le compte, ses sessions et ses jetons', async () => {
      await t.prisma.refreshToken.create({
        data: {
          userId: adrien.id,
          familyId: crypto.randomUUID(),
          tokenHash: 'x',
          expiresAt: new Date(Date.now() + 1e9),
        },
      });

      const res = await remove(adrien, {
        confirmEmail: 'Adrien@Exemple.fr ',
      }).expect(204);

      // Le cookie de refresh est effacé.
      expect(refreshCookieFrom(res.headers)).toBeUndefined();
      expect(
        (res.headers['set-cookie'] as unknown as string[]).some((c) =>
          c.startsWith('canapact_rt=;'),
        ),
      ).toBe(true);
      expect(
        await t.prisma.user.findUnique({ where: { id: adrien.id } }),
      ).toBeNull();
      expect(
        await t.prisma.refreshToken.count({ where: { userId: adrien.id } }),
      ).toBe(0);
      // Le JWT encore valide ne donne plus accès au profil.
      await http().get('/api/me').set(adrien.auth).expect(401);
    });

    it('refuse si l’adresse retapée ne correspond pas', async () => {
      const res = await remove(adrien, {
        confirmEmail: 'camille@exemple.fr',
      }).expect(400);
      expect(res.body.code).toBe('CONFIRMATION_MISMATCH');
      expect(await t.prisma.user.count({ where: { id: adrien.id } })).toBe(1);
    });

    it('redemande le mot de passe quand le compte en a un', async () => {
      await setPassword(adrien, 'canape-du-soir');
      const confirmEmail = 'adrien@exemple.fr';

      const missing = await remove(adrien, { confirmEmail }).expect(401);
      expect(missing.body.code).toBe('INVALID_CREDENTIALS');
      await remove(adrien, { confirmEmail, password: 'mauvais' }).expect(401);
      expect(await t.prisma.user.count({ where: { id: adrien.id } })).toBe(1);

      await remove(adrien, { confirmEmail, password: 'canape-du-soir' }).expect(
        204,
      );
      expect(await t.prisma.user.count({ where: { id: adrien.id } })).toBe(0);
    });

    it('sans mot de passe, exige une connexion récente', async () => {
      const oldLogin = Math.floor(Date.now() / 1000) - 3600;
      const staleToken = await t.app
        .get(JwtService)
        .signAsync({ sub: adrien.id, auth_time: oldLogin });

      const res = await http()
        .post('/api/me/delete')
        .set({ authorization: `Bearer ${staleToken}` })
        .send({ confirmEmail: 'adrien@exemple.fr' })
        .expect(403);
      expect(res.body.code).toBe('REAUTH_REQUIRED');
      expect(await t.prisma.user.count({ where: { id: adrien.id } })).toBe(1);
    });

    it('le rafraîchissement garde l’heure de la connexion', async () => {
      const loginAt = new Date(Date.now() - 3600_000);
      const familyId = crypto.randomUUID();
      // Premier jeton de la session, déjà utilisé, puis le jeton courant.
      await t.prisma.refreshToken.create({
        data: {
          userId: adrien.id,
          familyId,
          tokenHash: 'premier',
          createdAt: loginAt,
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 1e9),
        },
      });
      const rotated = await t.app
        .get(RefreshTokenService)
        .rotate(await currentToken(adrien.id, familyId));
      expect(rotated).toMatchObject({ ok: true, authTime: loginAt });
    });

    it('dans un groupe partagé : avis supprimés, titres gardés, propriété transmise', async () => {
      const groupId = await createGroup(adrien, 'Coloc');
      await join(camille, groupId, adrien);
      await join(sam, groupId, adrien);
      const rickId = await add(adrien, groupId, RICK);
      const catId = await add(camille, groupId, CAT, 'OK_ALONE');
      await http()
        .put(`/api/groups/${groupId}/titles/${catId}/status`)
        .set(adrien.auth)
        .send({ status: 'TOGETHER' })
        .expect(200);
      const invite = await http()
        .post(`/api/groups/${groupId}/invitations`)
        .set(adrien.auth)
        .send({})
        .expect(201);

      await remove(adrien, { confirmEmail: 'adrien@exemple.fr' }).expect(204);

      // Camille, arrivée la première après Adrien, devient propriétaire.
      const detail = await http()
        .get(`/api/groups/${groupId}`)
        .set(camille.auth)
        .expect(200);
      expect(detail.body.members).toEqual([
        expect.objectContaining({ userId: camille.id, role: 'OWNER' }),
        expect.objectContaining({ userId: sam.id, role: 'MEMBER' }),
      ]);
      // Ses avis ont disparu : il ne bloque plus « Keyboard Cat ».
      expect(
        await t.prisma.memberStatus.count({ where: { userId: adrien.id } }),
      ).toBe(0);
      // Son titre reste, sans auteur (affiché « ancien membre »).
      const list = await http()
        .get(`/api/groups/${groupId}/titles`)
        .set(camille.auth)
        .expect(200);
      const titles = list.body as { id: string; addedBy: unknown }[];
      expect(titles.find((x) => x.id === rickId)?.addedBy).toBeNull();
      // Son invitation ne fonctionne plus.
      const revoked = await t.prisma.invitation.findUniqueOrThrow({
        where: { id: invite.body.id as string },
      });
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.createdById).toBeNull();
    });

    it('supprime les groupes dont la personne était seule membre, avec leurs titres', async () => {
      const solo = await createGroup(adrien, 'Rien que moi');
      await add(adrien, solo, RICK);
      const shared = await createGroup(camille, 'Nous deux');
      await join(adrien, shared, camille);

      await remove(adrien, { confirmEmail: 'adrien@exemple.fr' }).expect(204);

      expect(await t.prisma.group.count({ where: { id: solo } })).toBe(0);
      expect(
        await t.prisma.groupTitle.count({ where: { groupId: solo } }),
      ).toBe(0);
      // Le groupe partagé garde Camille, toujours propriétaire.
      const members = await t.prisma.groupMember.findMany({
        where: { groupId: shared },
      });
      expect(members).toEqual([
        expect.objectContaining({ userId: camille.id, role: 'OWNER' }),
      ]);
    });
  });

  describe('purge des données expirées', () => {
    const DAY = 24 * 3600 * 1000;
    const ago = (days: number) => new Date(Date.now() - days * DAY);

    it('supprime sessions et liens expirés, et les comptes jamais confirmés', async () => {
      const token = (userId: string, expiresAt: Date, tokenHash: string) =>
        t.prisma.refreshToken.create({
          data: { userId, familyId: crypto.randomUUID(), tokenHash, expiresAt },
        });
      await token(adrien.id, ago(1), 'expired');
      await token(adrien.id, new Date(Date.now() + DAY), 'valid');
      await t.prisma.emailToken.createMany({
        data: [
          {
            userId: adrien.id,
            type: 'RESET_PASSWORD',
            tokenHash: 'old',
            expiresAt: ago(1),
          },
          {
            userId: adrien.id,
            type: 'RESET_PASSWORD',
            tokenHash: 'new',
            expiresAt: new Date(Date.now() + DAY),
          },
        ],
      });
      const unverified = (email: string, days: number) =>
        t.prisma.user.create({
          data: { email, displayName: email, createdAt: ago(days) },
        });
      const stale = await unverified('vieux@exemple.fr', 8);
      const recent = await unverified('recent@exemple.fr', 2);
      // Vieux compte, mais lien renvoyé hier : encore valable.
      const retried = await unverified('relance@exemple.fr', 30);
      await t.prisma.emailToken.create({
        data: {
          userId: retried.id,
          type: 'VERIFY_EMAIL',
          tokenHash: 'retry',
          expiresAt: new Date(Date.now() + DAY),
        },
      });

      const report = await t.app.get(RetentionService).purge();

      expect(report).toEqual({
        refreshTokens: 1,
        emailTokens: 1,
        unverifiedAccounts: 1,
        inactivityWarnings: 0,
        inactiveAccounts: 0,
      });
      expect(
        await t.prisma.refreshToken.findMany({ select: { tokenHash: true } }),
      ).toEqual([{ tokenHash: 'valid' }]);
      const left = await t.prisma.user.findMany({ select: { id: true } });
      expect(left.map((u) => u.id)).not.toContain(stale.id);
      expect(left.map((u) => u.id)).toEqual(
        expect.arrayContaining([recent.id, retried.id, adrien.id]),
      );
    });
  });
  describe('comptes inactifs', () => {
    const DAY = 24 * 3600 * 1000;
    const YEAR = 365 * DAY;
    const purge = (now = new Date()) => t.app.get(RetentionService).purge(now);
    const setUser = (
      id: string,
      data: { lastActiveAt?: Date; inactivityWarnedAt?: Date | null },
    ) => t.prisma.user.update({ where: { id }, data });
    const exists = async (id: string) =>
      (await t.prisma.user.count({ where: { id } })) === 1;

    it('prévient un mois avant les 3 ans, une seule fois', async () => {
      // 3 ans moins 20 jours : dans le mois de prévenance.
      await setUser(adrien.id, {
        lastActiveAt: new Date(Date.now() - 3 * YEAR + 20 * DAY),
      });
      // 3 ans moins 40 jours : pas encore.
      await setUser(camille.id, {
        lastActiveAt: new Date(Date.now() - 3 * YEAR + 40 * DAY),
      });
      t.mail.clear();

      expect(await purge()).toMatchObject({
        inactivityWarnings: 1,
        inactiveAccounts: 0,
      });
      const [warning] = t.mail.to('adrien@exemple.fr');
      expect(warning.subject).toMatch(
        /^Votre compte Canapact sera supprimé le /,
      );
      expect(warning.text).toContain('http://canapact.test/login');
      expect(t.mail.to('camille@exemple.fr')).toEqual([]);
      const warned = await t.prisma.user.findUniqueOrThrow({
        where: { id: adrien.id },
      });
      expect(warned.inactivityWarnedAt).not.toBeNull();

      // Le lendemain : pas de second email.
      expect(await purge(new Date(Date.now() + DAY))).toMatchObject({
        inactivityWarnings: 0,
      });
      expect(t.mail.to('adrien@exemple.fr')).toHaveLength(1);
    });

    it('annonce une date au moins un mois après l’email', async () => {
      // Inactif depuis 5 ans (la purge n'existait pas encore) : un mois de
      // délai quand même, et pas de suppression avant.
      const now = new Date('2030-06-10T12:00:00Z');
      await setUser(adrien.id, { lastActiveAt: new Date('2025-01-01') });
      // Les autres se sont connectés récemment.
      await setUser(camille.id, { lastActiveAt: now });
      await setUser(sam.id, { lastActiveAt: now });
      t.mail.clear();

      await purge(now);
      expect(t.mail.to('adrien@exemple.fr')[0].subject).toBe(
        'Votre compte Canapact sera supprimé le 10 juillet 2030',
      );
      expect(await purge(new Date(now.getTime() + 29 * DAY))).toMatchObject({
        inactiveAccounts: 0,
      });
      expect(await exists(adrien.id)).toBe(true);
      expect(await purge(new Date(now.getTime() + 30 * DAY))).toMatchObject({
        inactiveAccounts: 1,
      });
      expect(await exists(adrien.id)).toBe(false);
    });

    it('supprime le compte comme depuis les réglages', async () => {
      const groupId = await createGroup(adrien, 'Nous deux');
      await join(camille, groupId, adrien);
      await add(adrien, groupId, RICK);
      await setUser(adrien.id, {
        lastActiveAt: new Date(Date.now() - 3 * YEAR - 2 * DAY),
        inactivityWarnedAt: new Date(Date.now() - 31 * DAY),
      });
      await setUser(camille.id, {
        lastActiveAt: new Date(Date.now() - 3 * YEAR - 2 * DAY),
      });

      expect(await purge()).toMatchObject({
        inactiveAccounts: 1,
        // Camille, jamais prévenue : l'email part, elle reste.
        inactivityWarnings: 1,
      });
      expect(await exists(adrien.id)).toBe(false);
      expect(await exists(camille.id)).toBe(true);
      // Même départ qu'une suppression volontaire : la propriété passe à
      // Camille, le titre reste, signé « ancien membre ».
      expect(
        await t.prisma.groupMember.findMany({ where: { groupId } }),
      ).toEqual([
        expect.objectContaining({ userId: camille.id, role: 'OWNER' }),
      ]);
      expect(
        await t.prisma.groupTitle.findMany({ where: { groupId } }),
      ).toEqual([expect.objectContaining({ addedById: null })]);
    });

    it('ne supprime jamais sans prévenance', async () => {
      await setUser(adrien.id, {
        lastActiveAt: new Date(Date.now() - 10 * YEAR),
      });
      const mail = t.app.get(MailService);
      const send = vi
        .spyOn(mail, 'sendInactivityWarning')
        .mockRejectedValue(new Error('Brevo indisponible'));

      for (const days of [0, 40, 80]) {
        expect(await purge(new Date(Date.now() + days * DAY))).toMatchObject({
          inactivityWarnings: 0,
          inactiveAccounts: 0,
        });
      }
      expect(send).toHaveBeenCalledTimes(3);
      expect(await exists(adrien.id)).toBe(true);
      send.mockRestore();
    });

    it('une connexion annule la prévenance et repart pour 3 ans', async () => {
      await setUser(adrien.id, {
        lastActiveAt: new Date(Date.now() - 3 * YEAR - 2 * DAY),
        inactivityWarnedAt: new Date(Date.now() - 31 * DAY),
      });
      const rawToken = await t.app.get(RefreshTokenService).issue(adrien.id);
      expect(rawToken).toBeTruthy();

      expect(await purge()).toMatchObject({
        inactiveAccounts: 0,
        inactivityWarnings: 0,
      });
      const user = await t.prisma.user.findUniqueOrThrow({
        where: { id: adrien.id },
      });
      expect(user.inactivityWarnedAt).toBeNull();
      expect(Date.now() - user.lastActiveAt.getTime()).toBeLessThan(60_000);
    });

    it('le rafraîchissement de session compte comme une activité', async () => {
      const tokens = t.app.get(RefreshTokenService);
      const raw = await tokens.issue(adrien.id);
      await setUser(adrien.id, {
        lastActiveAt: new Date(Date.now() - 3 * YEAR),
        inactivityWarnedAt: new Date(Date.now() - 31 * DAY),
      });
      expect(await tokens.rotate(raw)).toMatchObject({ ok: true });
      const user = await t.prisma.user.findUniqueOrThrow({
        where: { id: adrien.id },
      });
      expect(user.inactivityWarnedAt).toBeNull();
      expect(Date.now() - user.lastActiveAt.getTime()).toBeLessThan(60_000);
    });
  });
});
