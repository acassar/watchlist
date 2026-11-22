import type { GroupTitle, WatchStatus } from '@watchlist/shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiErrorMessage } from '@/features/auth/validation';
import { useTitlesStore } from './store';

/** Message de confirmation, avec éventuellement « Annuler ». */
export interface Notice {
  text: string;
  undo?: () => void;
  error?: boolean;
}

/** Actions sur un titre depuis une liste, avec leur message et leur annulation. */
export function useTitleActions() {
  const { t } = useI18n();
  const titles = useTitlesStore();
  const notice = ref<Notice | null>(null);
  /** Titre dont la feuille « mon avis » est ouverte. */
  const editing = ref<GroupTitle | null>(null);

  async function run(action: () => Promise<unknown>, success?: Notice) {
    try {
      await action();
      if (success) notice.value = success;
    } catch (error) {
      notice.value = { text: apiErrorMessage(error), error: true };
    }
  }

  function watchedAlone(title: GroupTitle, watched: boolean) {
    return run(
      () => titles.setWatchedAlone(title, watched),
      watched
        ? {
            text: t('titles.notices.watchedAlone'),
            undo: () => void run(() => titles.setWatchedAlone(title, false)),
          }
        : { text: t('titles.notices.backInList') },
    );
  }

  function watchedTogether(title: GroupTitle, watched: boolean) {
    return run(
      () => titles.setWatchedTogether(title, watched),
      watched
        ? {
            text: t('titles.notices.watchedTogether'),
            undo: () => void run(() => titles.setWatchedTogether(title, false)),
          }
        : { text: t('titles.notices.backInList') },
    );
  }

  function setStatus(title: GroupTitle, status: WatchStatus) {
    return run(() => titles.setStatus(title, status));
  }

  return { notice, editing, watchedAlone, watchedTogether, setStatus };
}
