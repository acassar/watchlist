<script setup lang="ts">
import { mdiOpenInNew, mdiPlaylistPlay, mdiSync } from '@mdi/js';
import {
  GROUP_MAX_ACTIVE_TITLES,
  linkPlaylistRequestSchema,
  PLAYLIST_MAX_ITEMS_READ,
  mediaUrlSchema,
  type PlaylistSyncResult,
} from '@watchlist/shared';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiErrorMessage, zodRule } from '@/features/auth/validation';
import { useGroupsStore } from '@/features/groups/store';
import { usePlaylistsStore } from '../store';

const props = defineProps<{ groupId: string }>();
const playlists = usePlaylistsStore();
const groups = useGroupsStore();
const { t, d } = useI18n();

const state = computed(() =>
  playlists.groupId === props.groupId ? playlists.state : null,
);
const loadError = ref(false);
watch(
  () => props.groupId,
  (id) => {
    loadError.value = false;
    playlists.load(id).catch(() => (loadError.value = true));
  },
  { immediate: true },
);

/** Heure courante, pour réactiver le bouton « Synchroniser » à l'heure dite. */
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (now.value = Date.now()), 15_000)));
onBeforeUnmount(() => clearInterval(timer));

const freeSlots = computed(() => {
  const group = groups.groups.find((g) => g.id === props.groupId);
  return Math.max(0, GROUP_MAX_ACTIVE_TITLES - (group?.activeTitleCount ?? 0));
});

/* Lier ou changer de playlist */
const editing = ref(false);
const url = ref('');
const importExisting = ref(true);
const linking = ref(false);
const formError = ref<string | null>(null);
const showForm = computed(() => !state.value?.mine || editing.value);

async function link(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  linking.value = true;
  formError.value = null;
  try {
    const result = await playlists.link(
      props.groupId,
      linkPlaylistRequestSchema.parse({
        url: url.value,
        importExisting: importExisting.value,
      }),
    );
    editing.value = false;
    url.value = '';
    notify(result);
  } catch (e) {
    formError.value = apiErrorMessage(e);
  } finally {
    linking.value = false;
  }
}

function startEdit() {
  formError.value = null;
  editing.value = true;
}

/* Synchroniser */
const syncing = ref(false);
const message = ref<string | null>(null);
const syncError = ref<string | null>(null);
const nextSyncAt = computed(() => {
  const next = state.value?.nextManualSyncAt;
  return next && new Date(next).getTime() > now.value ? new Date(next) : null;
});

/** « Prochaine synchro à 21:40 » ou « Dernière synchro le… », puis le nombre de playlists. */
const syncLine = computed(() => {
  const s = state.value;
  if (!s) return '';
  const when = nextSyncAt.value
    ? t('playlists.nextSync', { time: d(nextSyncAt.value, 'time') })
    : s.lastSyncedAt
      ? t('playlists.lastSync', {
          date: d(new Date(s.lastSyncedAt), 'dateTime'),
        })
      : null;
  const count = t('playlists.linkedCount', s.linkedCount);
  return when ? `${when} ${count}.` : `${count}.`;
});

function notify(result: PlaylistSyncResult) {
  const parts = [
    result.added > 0
      ? t('playlists.added', result.added)
      : t('playlists.nothingNew'),
  ];
  if (result.waiting > 0) parts.push(t('playlists.waiting', result.waiting));
  message.value = parts.join(' ');
}

async function syncNow() {
  syncing.value = true;
  syncError.value = null;
  message.value = null;
  try {
    notify(await playlists.syncNow(props.groupId));
  } catch (e) {
    syncError.value = apiErrorMessage(e);
    // Le serveur a pu refuser (trop tôt) : on relit l'état pour l'heure.
    playlists.load(props.groupId).catch(() => undefined);
  } finally {
    syncing.value = false;
  }
}

/* Délier */
const unlinking = ref(false);
async function unlink() {
  unlinking.value = true;
  syncError.value = null;
  try {
    await playlists.unlink(props.groupId);
    message.value = null;
  } catch (e) {
    syncError.value = apiErrorMessage(e);
  } finally {
    unlinking.value = false;
  }
}
</script>

<template>
  <section
    v-if="state?.enabled"
    class="mb-8"
    :aria-label="$t('playlists.title')"
    data-test="playlist-section"
  >
    <h2 class="text-title-medium mb-1">{{ $t('playlists.title') }}</h2>
    <p class="text-body-medium text-medium-emphasis mb-4">
      {{ $t('playlists.intro') }}
    </p>

    <!-- Ma playlist liée -->
    <template v-if="state.mine && !editing">
      <v-alert
        v-if="state.mine.error === 'NOT_FOUND'"
        type="warning"
        variant="tonal"
        class="mb-4"
        :text="$t('playlists.notFound')"
        data-test="playlist-error"
      />
      <v-alert
        v-else-if="state.mine.error === 'TOO_LONG'"
        type="info"
        variant="tonal"
        class="mb-4"
        :text="$t('playlists.tooLong', { n: PLAYLIST_MAX_ITEMS_READ })"
        data-test="playlist-too-long"
      />
      <v-list-item class="px-0" :prepend-icon="mdiPlaylistPlay">
        <v-list-item-title>{{ $t('playlists.linked') }}</v-list-item-title>
        <v-list-item-subtitle>
          {{
            state.mine.importExisting
              ? $t('playlists.linkedAll')
              : $t('playlists.linkedNewOnly', {
                  date: d(new Date(state.mine.linkedAt), 'short'),
                })
          }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            :href="state.mine.url"
            target="_blank"
            rel="noopener noreferrer"
            :icon="mdiOpenInNew"
            variant="text"
            :aria-label="$t('playlists.open')"
          />
        </template>
      </v-list-item>
    </template>

    <!-- Tuto et formulaire -->
    <template v-if="showForm">
      <ol class="tuto text-body-medium mb-4" data-test="playlist-tuto">
        <li>{{ $t('playlists.tuto.create') }}</li>
        <li>{{ $t('playlists.tuto.visibility') }}</li>
        <li>{{ $t('playlists.tuto.copy') }}</li>
        <li>{{ $t('playlists.tuto.paste') }}</li>
      </ol>
      <p class="text-body-small text-medium-emphasis mb-4">
        {{ $t('playlists.tuto.watchLater') }}
      </p>
      <v-form validate-on="submit lazy" @submit.prevent="link">
        <v-text-field
          v-model="url"
          :label="$t('playlists.urlLabel')"
          placeholder="https://www.youtube.com/playlist?list=…"
          :rules="[zodRule(mediaUrlSchema)]"
          inputmode="url"
          autocomplete="off"
          variant="outlined"
          data-test="playlist-url"
        />
        <v-switch
          v-model="importExisting"
          color="primary"
          inset
          hide-details
          :label="$t('playlists.importExisting')"
          data-test="playlist-import"
        />
        <p
          class="text-body-small text-medium-emphasis mb-4"
          data-test="playlist-import-hint"
        >
          {{
            importExisting
              ? $t('playlists.importHint', { n: freeSlots })
              : $t('playlists.newOnlyHint')
          }}
        </p>
        <v-alert
          v-if="formError"
          type="error"
          variant="tonal"
          class="mb-4"
          :text="formError"
        />
        <div class="d-flex ga-2">
          <v-btn
            v-if="editing"
            variant="text"
            rounded="pill"
            @click="editing = false"
          >
            {{ $t('common.cancel') }}
          </v-btn>
          <v-btn
            type="submit"
            color="primary"
            rounded="pill"
            size="large"
            class="flex-grow-1"
            :loading="linking"
            data-test="playlist-link"
          >
            {{ $t('playlists.link') }}
          </v-btn>
        </div>
      </v-form>
    </template>

    <!-- Synchro du groupe -->
    <div v-if="(state?.linkedCount ?? 0) > 0 && !editing" class="mt-4">
      <v-alert
        v-if="message"
        type="success"
        variant="tonal"
        density="compact"
        class="mb-3"
        closable
        :text="message"
        @click:close="message = null"
      />
      <v-alert
        v-else-if="(state?.waiting ?? 0) > 0"
        type="info"
        variant="tonal"
        density="compact"
        class="mb-3"
        :text="$t('playlists.waiting', state?.waiting ?? 0)"
      />
      <v-alert
        v-if="syncError"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-3"
        :text="syncError"
      />
      <v-btn
        variant="tonal"
        color="primary"
        rounded="pill"
        size="large"
        block
        :prepend-icon="mdiSync"
        :loading="syncing"
        :disabled="!!nextSyncAt"
        data-test="playlist-sync"
        @click="syncNow"
      >
        {{ $t('playlists.sync') }}
      </v-btn>
      <p class="text-body-small text-medium-emphasis mt-2 text-center">
        {{ syncLine }}
      </p>
      <div v-if="state?.mine" class="d-flex ga-2 mt-2">
        <v-btn
          variant="text"
          rounded="pill"
          class="flex-grow-1 text-none"
          data-test="playlist-change"
          @click="startEdit"
        >
          {{ $t('playlists.change') }}
        </v-btn>
        <v-btn
          variant="text"
          color="error"
          rounded="pill"
          class="flex-grow-1 text-none"
          :loading="unlinking"
          data-test="playlist-unlink"
          @click="unlink"
        >
          {{ $t('playlists.unlink') }}
        </v-btn>
      </div>
    </div>
  </section>
  <v-alert
    v-else-if="loadError"
    type="warning"
    variant="tonal"
    class="mb-8"
    :text="$t('playlists.loadError')"
  />
</template>

<style scoped>
.tuto {
  padding-left: 1.25rem;
}
.tuto li + li {
  margin-top: 0.25rem;
}
</style>
