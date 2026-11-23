/**
 * Petits souvenirs propres à cet appareil, dans localStorage. Tout est
 * facultatif : navigation privée ou stockage bloqué = on fait sans.
 */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : tant pis, ce n'est qu'un confort.
  }
}

const activeKey = (userId: string) => `canapact.activeGroup.${userId}`;

/** Dernier groupe ouvert par cet utilisateur sur cet appareil. */
export const activeGroupMemory = {
  get: (userId: string) => read(activeKey(userId)),
  set: (userId: string, groupId: string | null) =>
    write(activeKey(userId), groupId),
};

const PENDING_KEY = 'canapact.pendingInvite';
/** Au-delà, on oublie l'invitation (le lien lui-même expire au bout de 7 jours). */
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lien d'invitation ouvert avant d'être connecté : on le garde le temps de
 * l'inscription (y compris si le lien de confirmation s'ouvre dans un autre
 * onglet), puis on revient sur l'écran « Rejoindre ».
 */
export const pendingInvite = {
  get(): string | null {
    const raw = read(PENDING_KEY);
    if (!raw) return null;
    try {
      const { token, at } = JSON.parse(raw) as {
        token?: unknown;
        at?: unknown;
      };
      if (
        typeof token === 'string' &&
        typeof at === 'number' &&
        Date.now() - at < PENDING_TTL_MS
      ) {
        return token;
      }
    } catch {
      // Valeur illisible : on l'efface ci-dessous.
    }
    write(PENDING_KEY, null);
    return null;
  },
  set(token: string) {
    write(PENDING_KEY, JSON.stringify({ token, at: Date.now() }));
  },
  clear() {
    write(PENDING_KEY, null);
  },
};

const lastAddKey = (userId: string) => `canapact.lastAddGroup.${userId}`;

/**
 * Dernier groupe dans lequel cet utilisateur a ajouté un titre : proposé en
 * tête de « Ajouter à quel groupe ? ».
 */
export const lastAddGroupMemory = {
  get: (userId: string) => read(lastAddKey(userId)),
  set: (userId: string, groupId: string) => write(lastAddKey(userId), groupId),
};

const SHARE_KEY = 'canapact.pendingShare';
/** Un partage oublié depuis plus d'un jour ne doit pas resurgir. */
const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Lien reçu par le menu « Partager » (ou à ajouter) avant d'être connecté :
 * gardé le temps de la connexion ou de l'inscription, même si le lien de
 * confirmation s'ouvre dans un autre onglet, puis on revient sur l'ajout.
 */
export const pendingShare = {
  get(): string | null {
    const raw = read(SHARE_KEY);
    if (!raw) return null;
    try {
      const { url, at } = JSON.parse(raw) as { url?: unknown; at?: unknown };
      if (
        typeof url === 'string' &&
        typeof at === 'number' &&
        Date.now() - at < SHARE_TTL_MS
      ) {
        return url;
      }
    } catch {
      // Valeur illisible : on l'efface ci-dessous.
    }
    write(SHARE_KEY, null);
    return null;
  },
  set(url: string) {
    write(SHARE_KEY, JSON.stringify({ url, at: Date.now() }));
  },
  clear() {
    write(SHARE_KEY, null);
  },
};

/**
 * Compte supprimé : on efface aussi ce que cet appareil retenait de lui
 * (groupe actif, dernier groupe d'ajout) et ce qui attendait d'être ajouté.
 */
export function forgetUser(userId: string) {
  write(activeKey(userId), null);
  write(lastAddKey(userId), null);
  pendingInvite.clear();
  pendingShare.clear();
}
