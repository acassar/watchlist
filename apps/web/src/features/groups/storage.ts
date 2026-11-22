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
