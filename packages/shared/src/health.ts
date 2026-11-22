import { z } from 'zod';

/** Réponse de GET /api/health (200 si tout va bien, 503 si la base est injoignable). */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  db: z.enum(['up', 'down']),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
