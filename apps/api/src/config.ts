import { z } from 'zod';

/** Variables d'environnement validées au démarrage : l'API refuse de démarrer si une valeur manque. */
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
});
export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return envSchema.parse(config);
}
