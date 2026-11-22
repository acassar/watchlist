import { execSync } from 'node:child_process';

/** Applique les migrations avant les tests e2e (base fournie par `pnpm db:up` ou la CI). */
export default function setup() {
  execSync('prisma migrate deploy', { stdio: 'inherit' });
}
