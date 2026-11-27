import request from 'supertest';
import { GROUP_MAX_ACTIVE_TITLES } from '@watchlist/shared';
import {
  createTestApp,
  createUser,
  resetDatabase,
  type TestApp,
} from './helpers.js';
import { mockYouTube, type FakeVideo } from './youtube-mock.js';

type User = Awaited<ReturnType<typeof createUser>>;

/** Id de vidéo factice (11 caractères). */
const vid = (n: number) => `v${String(n).padStart(10, '0')}`;
const video = (n: number): FakeVideo => ({
  title: `Vidéo ${n}`,
  channel: 'Chaîne',
  duration: 'PT1M',
});
const MINE = 'PLmine000000000000';
const HERS = 'PLhers000000000000';
const playlistUrl = (id: string) =>
  `https://www.youtube.com/playlist?list=${id}`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000);

// Nécessite une base Postgres (`pnpm db:up`) et DATABASE_URL.
describe('Synchro des playlists YouTube (e2e)', () => {
  let t: TestApp;
  let adrien: User;
  let camille: User;
  let groupId: string;
  let youtube: ReturnType<typeof mockYouTube>;

  const http = () => request(t.app.getHttpServer());
  const base = () => `/api/groups/${groupId}/playlists`;

  const link = (user: User, url: string, importExisting = true) =>
    http().put(`${base()}/mine`).set(user.auth).send({ url, importExisting });
  const sync = (user: User, mode: 'auto' | 'manual') =>
    http().post(`${base()}/sync`).set(user.auth).send({ mode });
  const titles = async (user: User) =>
    (
      await http()
        .get(`/api/groups/${groupId}/titles`)
        .set(user.auth)
        .expect(200)
    ).body as {
      id: string;
      media: { externalId: string };
      myStatus: string;
      addedBy: { userId: string } | null;
    }[];
  /** Dernière synchro reculée dans le temps (les intervalles sont réels). */
  const syncedHoursAgo = (h: number) =>
    t.prisma.group.update({
      where: { id: groupId },
      data: { playlistsSyncedAt: hoursAgo(h) },
    });

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    const videos: Record<string, FakeVideo> = {};
    for (let n = 1; n <= 70; n++) videos[vid(n)] = video(n);
    youtube = mockYouTube(videos, {
      [MINE]: {
        items: [
          { videoId: vid(1) },
          { videoId: vid(2), private: true },
          { videoId: 'gone0000000' }, // supprimée : absente de videos.list
          { videoId: vid(3) },
        ],
      },
      [HERS]: { items: [{ videoId: vid(11) }, { videoId: vid(12) }] },
    });
    await resetDatabase(t.prisma);
    adrien = await createUser(t, 'Adrien');
    camille = await createUser(t, 'Camille');
    groupId = (
      await http()
        .post('/api/groups')
        .set(adrien.auth)
        .send({ name: 'Nous deux' })
        .expect(201)
    ).body.id;
    const invite = await http()
      .post(`/api/groups/${groupId}/invitations`)
      .set(adrien.auth)
      .send({})
      .expect(201);
    await http()
      .post('/api/invitations/accept')
      .set(camille.auth)
      .send({ code: invite.body.code })
      .expect(200);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await t.app.close();
  });

  it('sans playlist : état vide, la synchro auto ne fait rien', async () => {
    const res = await http().get(base()).set(adrien.auth).expect(200);
    expect(res.body).toEqual({
      enabled: true,
      mine: null,
      linkedCount: 0,
      lastSyncedAt: null,
      nextManualSyncAt: null,
      waiting: 0,
    });
    const auto = await sync(adrien, 'auto').expect(200);
    expect(auto.body).toMatchObject({ synced: false, added: 0 });
    expect(youtube.calls).toHaveLength(0);
  });

  it('refuse les liens qui ne sont pas des playlists lisibles', async () => {
    const invalid = await link(adrien, 'https://youtu.be/dQw4w9WgXcQ');
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_PLAYLIST_URL');

    const watchLater = await link(adrien, playlistUrl('WL'));
    expect(watchLater.status).toBe(400);
    expect(watchLater.body.code).toBe('PLAYLIST_NOT_SUPPORTED');

    const unknown = await link(adrien, playlistUrl('PLinconnue00000000'));
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe('PLAYLIST_NOT_FOUND');
  });

  it('importe les vidéos déjà présentes, sans avis, au nom du propriétaire', async () => {
    const res = await link(adrien, playlistUrl(MINE)).expect(200);
    expect(res.body).toMatchObject({
      synced: true,
      added: 2,
      waiting: 0,
      state: {
        mine: { playlistId: MINE, importExisting: true, error: null },
        linkedCount: 1,
      },
    });

    const list = await titles(adrien);
    // Ordre de la playlist ; privée et supprimée ignorées.
    expect(list.map((x) => x.media.externalId)).toEqual([vid(1), vid(3)]);
    expect(list.every((x) => x.myStatus === 'PENDING')).toBe(true);
    expect(list.every((x) => x.addedBy?.userId === adrien.id)).toBe(true);
    // Durées et titres demandés en un seul appel groupé.
    const videoCalls = youtube.calls.filter((u) =>
      u.pathname.endsWith('/videos'),
    );
    expect(videoCalls).toHaveLength(1);
  });

  it('sans import : seules les vidéos ajoutées ensuite arrivent', async () => {
    const res = await link(adrien, playlistUrl(MINE), false).expect(200);
    expect(res.body).toMatchObject({ added: 0 });
    expect(await titles(adrien)).toHaveLength(0);

    youtube.playlists[MINE]!.items.push({
      videoId: vid(4),
      addedAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await syncedHoursAgo(1);
    await sync(camille, 'manual').expect(200);
    expect((await titles(adrien)).map((x) => x.media.externalId)).toEqual([
      vid(4),
    ]);
  });

  it('une playlist par membre et par groupe : la nouvelle remplace l’ancienne', async () => {
    await link(adrien, playlistUrl(MINE)).expect(200);
    youtube.playlists['PLautre00000000000'] = { items: [] };
    await link(adrien, playlistUrl('PLautre00000000000')).expect(200);
    expect(await t.prisma.groupPlaylist.count()).toBe(1);
    const state = await http().get(base()).set(adrien.auth).expect(200);
    expect(state.body.mine.playlistId).toBe('PLautre00000000000');
  });

  it('auto après 4 h seulement, bouton après 15 min seulement', async () => {
    await link(adrien, playlistUrl(MINE)).expect(200);
    youtube.playlists[MINE]!.items.unshift({ videoId: vid(5) });

    const auto = await sync(camille, 'auto').expect(200);
    expect(auto.body.synced).toBe(false);

    const tooSoon = await sync(camille, 'manual');
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.code).toBe('PLAYLIST_SYNC_TOO_SOON');

    await syncedHoursAgo(1);
    expect((await sync(camille, 'auto').expect(200)).body.synced).toBe(false);
    const manual = await sync(camille, 'manual').expect(200);
    expect(manual.body).toMatchObject({ synced: true, added: 1 });
    expect(manual.body.state.nextManualSyncAt).not.toBeNull();

    youtube.playlists[MINE]!.items.unshift({ videoId: vid(6) });
    await syncedHoursAgo(5);
    const later = await sync(camille, 'auto').expect(200);
    expect(later.body).toMatchObject({ synced: true, added: 1 });
  });

  it('une vidéo retirée de la playlist reste dans la liste', async () => {
    await link(adrien, playlistUrl(MINE)).expect(200);
    youtube.playlists[MINE]!.items = [];
    await syncedHoursAgo(5);
    await sync(adrien, 'auto').expect(200);
    expect(await titles(adrien)).toHaveLength(2);
  });

  it('liste pleine : les vidéos attendent une place et arrivent ensuite', async () => {
    youtube.playlists[MINE] = {
      items: Array.from({ length: GROUP_MAX_ACTIVE_TITLES + 5 }, (_, i) => ({
        videoId: vid(i + 1),
      })),
    };
    const res = await link(adrien, playlistUrl(MINE)).expect(200);
    expect(res.body).toMatchObject({
      added: GROUP_MAX_ACTIVE_TITLES,
      waiting: 5,
      state: { waiting: 5 },
    });

    const [first] = await titles(adrien);
    await http()
      .put(`/api/groups/${groupId}/titles/${first!.id}/watched-together`)
      .set(adrien.auth)
      .send({})
      .expect(200);
    await syncedHoursAgo(1);
    const again = await sync(camille, 'manual').expect(200);
    expect(again.body).toMatchObject({ added: 1, waiting: 4 });
  });

  it('chacun son tour quand la place manque', async () => {
    await link(camille, playlistUrl(HERS)).expect(200);
    await link(adrien, playlistUrl(MINE)).expect(200);
    const ids = (await titles(adrien)).map((x) => x.media.externalId).sort();
    expect(ids).toEqual([vid(1), vid(11), vid(12), vid(3)].sort());
  });

  it('playlist devenue privée : signalée à son propriétaire', async () => {
    await link(adrien, playlistUrl(MINE)).expect(200);
    delete youtube.playlists[MINE];
    await syncedHoursAgo(5);
    await sync(camille, 'auto').expect(200);
    const state = await http().get(base()).set(adrien.auth).expect(200);
    expect(state.body.mine.error).toBe('NOT_FOUND');
  });

  it('quota YouTube épuisé : réessayer demain', async () => {
    youtube.quotaExceeded = true;
    const res = await link(adrien, playlistUrl(MINE));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PLAYLIST_QUOTA_EXCEEDED');
  });

  it('part du quota par groupe : un groupe gourmand ne bloque pas les autres', async () => {
    const today = new Date(new Date().toISOString().slice(0, 10));
    await t.prisma.youTubeGroupDailyUnits.create({
      data: { day: today, groupId, units: 500 },
    });
    const res = await link(adrien, playlistUrl(MINE));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PLAYLIST_QUOTA_EXCEEDED');

    // Un autre groupe garde sa part (et rien n'est compté à ce groupe-ci).
    const other = await createUser(t, 'Sam');
    const created = await http()
      .post('/api/groups')
      .set(other.auth)
      .send({ name: 'Colocs' })
      .expect(201);
    await http()
      .put(`/api/groups/${created.body.id}/playlists/mine`)
      .set(other.auth)
      .send({ url: playlistUrl(HERS), importExisting: true })
      .expect(200);
    const mine = await t.prisma.youTubeGroupDailyUnits.findUnique({
      where: { day_groupId: { day: today, groupId } },
    });
    expect(mine?.units).toBe(500);
  });

  it('délier, ou quitter le groupe, retire la playlist mais garde les titres', async () => {
    await link(adrien, playlistUrl(MINE)).expect(200);
    await link(camille, playlistUrl(HERS)).expect(200);

    const unlinked = await http()
      .delete(`${base()}/mine`)
      .set(adrien.auth)
      .expect(200);
    expect(unlinked.body).toMatchObject({ mine: null, linkedCount: 1 });

    await http()
      .post(`/api/groups/${groupId}/leave`)
      .set(camille.auth)
      .expect(204);
    expect(await t.prisma.groupPlaylist.count()).toBe(0);
    expect(await titles(adrien)).toHaveLength(4);
  });
});
