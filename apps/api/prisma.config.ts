import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Pas besoin d'URL pour `prisma generate` (CI, build) : seules les migrations en ont besoin.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
