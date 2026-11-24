import { isTodo } from './publisher';

/**
 * Valeur anglaise, sauf si la valeur française est encore « à compléter » :
 * les deux versions restent alors marquées pareil.
 */
export function inEnglish(fr: string, en: string): string {
  return isTodo(fr) ? fr : en;
}

/**
 * Version anglaise des valeurs de publisher.ts qui sont du texte (et non des
 * noms, adresses ou numéros, repris tels quels). À tenir alignée : changer une
 * valeur là-bas, c'est la changer ici.
 */
export const hostEn = {
  location: 'Switzerland',
} as const;

export const publisherEn = {
  address:
    'not published: the publisher, a private individual, has given their address to the host (French LCEN act, art. 6 III-2)',
} as const;

export const operationsEn = {
  serverLogsRetention: '14 days',
  backupsRetention: '30 days (7 days for the copy kept on our server)',
  backupsLocation:
    'on our server and, encrypted, in Infomaniak’s Swiss Backup service, in Switzerland',
} as const;
