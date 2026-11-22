import { ref } from 'vue';

const SEEN_KEY = 'canapact.swipeTutorialSeen';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Tuto des gestes de « Mon avis » : montré au premier usage sur cet appareil,
 * relançable depuis le menu du compte.
 */
export const swipeTutorial = {
  open: ref(false),
  /** À appeler quand des cartes s'affichent : ouvre le tuto la première fois. */
  showIfNew() {
    if (!seen()) swipeTutorial.open.value = true;
  },
  show() {
    swipeTutorial.open.value = true;
  },
  close() {
    swipeTutorial.open.value = false;
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Stockage indisponible : le tuto reviendra, tant pis.
    }
  },
};
