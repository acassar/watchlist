import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

/** Variables d'environnement validées au démarrage : l'API refuse de démarrer si une valeur manque. */
export const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    /** URL publique du front, utilisée dans les liens des emails (sans / final). */
    APP_URL: z
      .url()
      .default('http://localhost:5173')
      .transform((url) => url.replace(/\/+$/, '')),
    /** Secret de signature des JWT d'accès (HS256) : au moins 32 caractères aléatoires. */
    JWT_SECRET: z.string().min(32),
    /** Cookie de refresh en `Secure` : à laisser à true partout sauf en dev HTTP hors localhost. */
    COOKIE_SECURE: booleanFromEnv.default(true),
    /**
     * Réglage `trust proxy` d'Express, pour lire la vraie IP du client derrière
     * le reverse proxy (nécessaire au rate limiting). Ex. : `loopback`, `1`, `false`.
     */
    TRUST_PROXY: z.string().default('false'),
    /** Requêtes autorisées par IP et par minute sur les routes sensibles de l'auth. */
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    /** `console` (dev : emails affichés dans les logs), `memory` (tests), `brevo` (prod). */
    MAIL_TRANSPORT: z.enum(['console', 'memory', 'brevo']).default('console'),
    MAIL_FROM_EMAIL: z.email().default('bonjour@canapact.local'),
    MAIL_FROM_NAME: z.string().min(1).default('Canapact'),
    BREVO_API_KEY: z.string().optional(),
    /**
     * Emails envoyés au plus par jour (UTC). Brevo gratuit : 300 ; la marge
     * absorbe les envois faits hors de l'app (tests depuis Brevo, etc.). Une
     * fois atteint, inscription, renvoi du lien et mot de passe oublié
     * répondent « réessayez demain ».
     */
    MAIL_DAILY_LIMIT: z.coerce.number().int().positive().default(280),
    /**
     * Identifiants OAuth « Se connecter avec Google » (console Google Cloud, type
     * « Application Web »). Les deux ou aucun : sans eux, le bouton Google est masqué.
     * URI de redirection à déclarer : `${APP_URL}/api/auth/google/callback`.
     */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    /**
     * Clé API YouTube Data v3 (console Google Cloud), facultative : elle sert
     * à récupérer la durée des vidéos. Sans elle, l'ajout marche, sans durée.
     */
    YOUTUBE_API_KEY: z.string().min(1).optional(),
    /** Résolutions de liens (aperçu ou ajout) par utilisateur et par minute. */
    MEDIA_RATE_LIMIT: z.coerce.number().int().positive().default(30),
    /**
     * Unités de quota YouTube par jour (UTC) réservées à la synchro des
     * playlists, sur les 10 000 gratuites. Le reste couvre les ajouts de liens
     * (1 unité) et le rafraîchissement des 30 jours (2 000 par jour au plus).
     */
    PLAYLIST_SYNC_DAILY_UNITS: z.coerce.number().int().positive().default(6000),
    /**
     * Part de ces unités qu'un même groupe peut dépenser par jour (UTC) :
     * relier sa playlist en boucle n'épuise que la part de son groupe.
     */
    PLAYLIST_SYNC_GROUP_DAILY_UNITS: z.coerce
      .number()
      .int()
      .positive()
      .default(500),
    /**
     * Rafraîchissement périodique du cache des titres (CGU YouTube : 30 jours
     * de conservation au plus). Désactivé dans les tests e2e.
     */
    MEDIA_REFRESH_ENABLED: booleanFromEnv.default(true),
    /**
     * Purge quotidienne des données arrivées au bout de leur durée de
     * conservation (RGPD) : sessions et liens expirés, comptes jamais
     * confirmés. Désactivée dans les tests e2e (appelée à la main).
     */
    RETENTION_PURGE_ENABLED: booleanFromEnv.default(true),
  })
  .refine((env) => env.MAIL_TRANSPORT !== 'brevo' || !!env.BREVO_API_KEY, {
    message: 'BREVO_API_KEY est obligatoire quand MAIL_TRANSPORT=brevo',
    path: ['BREVO_API_KEY'],
  })
  .refine((env) => !!env.GOOGLE_CLIENT_ID === !!env.GOOGLE_CLIENT_SECRET, {
    message:
      'GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET vont ensemble : renseignez les deux ou aucun',
    path: ['GOOGLE_CLIENT_SECRET'],
  });
export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}

/** Valeur `trust proxy` d'Express à partir de la variable d'environnement. */
export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
