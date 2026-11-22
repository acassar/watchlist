import { mdiAccount, mdiAccountMultiple, mdiClose } from '@mdi/js';
import { WatchStatus } from '@watchlist/shared';

/**
 * Apparence de chaque avis (maquette validée) : une couleur du thème ET une
 * icône, jamais la couleur seule (accessibilité).
 */
export const statusAppearance: Record<
  WatchStatus,
  { icon: string; color: string }
> = {
  [WatchStatus.OK_ALONE]: { icon: mdiAccount, color: 'alone' },
  [WatchStatus.TOGETHER]: { icon: mdiAccountMultiple, color: 'together' },
  [WatchStatus.NOT_INTERESTED]: { icon: mdiClose, color: 'not-interested' },
};

/** Ordre d'affichage des choix. */
export const statusChoices = [
  WatchStatus.OK_ALONE,
  WatchStatus.TOGETHER,
  WatchStatus.NOT_INTERESTED,
] as const;
