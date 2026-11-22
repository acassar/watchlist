<script setup lang="ts">
import { mdiContentPaste } from '@mdi/js';
import {
  formatDuration,
  mediaUrlSchema,
  WatchStatus,
  type MediaInfo,
} from '@watchlist/shared';
import type { GroupSummary } from '@watchlist/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiErrorMessage } from '@/features/auth/validation';
import { titlesApi } from '../api';
import { useTitlesStore } from '../store';
import MediaThumb from './MediaThumb.vue';
import StatusPicker from './StatusPicker.vue';

/**
 * Formulaire d'ajout d'un titre dans un groupe : lien (collé ou partagé),
 * aperçu, puis mon avis. Utilisé par le panneau « + » et par la page d'ajout
 * (partage Android, iOS). Un nouveau montage = un formulaire vierge.
 */
const props = defineProps<{
  group: GroupSummary;
  /** Lien reçu d'un partage : l'aperçu se charge tout de suite. */
  initialLink?: string | null;
}>();
const emit = defineEmits<{ added: [groupName: string]; cancel: [] }>();
const { t } = useI18n();
const titles = useTitlesStore();

const link = ref(props.initialLink ?? '');
const preview = ref<MediaInfo | null>(null);
/** Celui qui ajoute donne son avis tout de suite ; « Sans moi, ok » présélectionné. */
const status = ref<WatchStatus>(WatchStatus.OK_ALONE);
const error = ref<string | null>(null);
const resolving = ref(false);
const adding = ref(false);
const field = ref<{ focus(): void } | null>(null);
/** Lien de l'aperçu affiché ou en cours de chargement. */
let requested: string | null = null;
/** Numéro de la dernière demande : une réponse arrivée en retard est ignorée. */
let sequence = 0;

const canReadClipboard =
  typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
const meta = computed(() =>
  preview.value
    ? [
        preview.value.author,
        preview.value.durationSec !== null
          ? formatDuration(preview.value.durationSec)
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '',
);

async function resolve() {
  const parsed = mediaUrlSchema.safeParse(link.value);
  if (!parsed.success) {
    preview.value = null;
    error.value = t('titles.add.noLink');
    return;
  }
  const url = parsed.data;
  if (url === requested) return;
  requested = url;
  const mine = ++sequence;
  preview.value = null;
  error.value = null;
  resolving.value = true;
  try {
    const media = await titlesApi.resolve(url);
    if (mine === sequence) preview.value = media;
  } catch (e) {
    if (mine === sequence) {
      error.value = apiErrorMessage(e);
      requested = null;
    }
  } finally {
    if (mine === sequence) resolving.value = false;
  }
}

onMounted(() => {
  if (link.value) resolve();
});

// Lien modifié après l'aperçu : l'aperçu ne correspond plus.
watch(link, (value) => {
  const parsed = mediaUrlSchema.safeParse(value ?? '');
  if (requested && (!parsed.success || parsed.data !== requested)) {
    requested = null;
    sequence++;
    preview.value = null;
    resolving.value = false;
  }
});

/** iOS n'a pas de partage vers une PWA : on lit le presse-papiers sur un appui. */
async function pasteFromClipboard() {
  try {
    link.value = await navigator.clipboard.readText();
  } catch {
    // Refusé ou indisponible : collage à la main dans le champ.
    error.value = t('titles.add.clipboardDenied');
    field.value?.focus();
    return;
  }
  await resolve();
}

/**
 * Collage direct dans le champ : aperçu sans appuyer sur un bouton.
 * L'événement paste part avant que le texte soit inséré (et avant le v-model) :
 * un nextTick (microtâche) passerait trop tôt, on attend la tâche suivante.
 */
async function onPaste() {
  await new Promise((done) => setTimeout(done));
  await resolve();
}

async function submit() {
  if (!preview.value) return;
  adding.value = true;
  error.value = null;
  try {
    await titles.add(props.group.id, {
      url: preview.value.url,
      status: status.value,
    });
    emit('added', props.group.name);
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <div>
    <v-card-text class="pt-4">
      <v-btn
        v-if="canReadClipboard && !initialLink"
        color="primary"
        size="x-large"
        rounded="pill"
        block
        class="mb-4"
        :prepend-icon="mdiContentPaste"
        :loading="resolving"
        data-test="paste"
        @click="pasteFromClipboard"
      >
        {{ $t('titles.add.paste') }}
      </v-btn>

      <v-text-field
        ref="field"
        v-model="link"
        :label="$t('titles.add.link')"
        :placeholder="$t('titles.add.placeholder')"
        variant="outlined"
        type="url"
        inputmode="url"
        autocomplete="off"
        hide-details
        clearable
        class="mb-2"
        data-test="link"
        @paste="onPaste"
        @keydown.enter.prevent="resolve"
      >
        <template v-if="link && !preview" #append-inner>
          <v-btn
            variant="text"
            size="small"
            :loading="resolving"
            data-test="preview-btn"
            @click="resolve"
          >
            {{ $t('titles.add.preview') }}
          </v-btn>
        </template>
      </v-text-field>

      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-3"
        :text="error"
        data-test="add-error"
      />

      <template v-if="preview">
        <div class="d-flex ga-3 mt-4 mb-5" data-test="preview">
          <MediaThumb :src="preview.thumbnailUrl" :width="144" />
          <div class="d-flex flex-column overflow-hidden">
            <span class="text-title-medium preview-title">{{
              preview.title
            }}</span>
            <span class="text-body-small text-medium-emphasis">{{ meta }}</span>
          </div>
        </div>

        <p class="text-title-small mb-2">{{ $t('titles.add.yourStatus') }}</p>
        <StatusPicker v-model="status" :label="$t('titles.add.yourStatus')" />
      </template>
    </v-card-text>

    <v-card-actions class="px-4">
      <v-btn variant="text" data-test="add-cancel" @click="emit('cancel')">
        {{ $t('common.cancel') }}
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        variant="flat"
        rounded="pill"
        :disabled="!preview"
        :loading="adding"
        data-test="add-submit"
        @click="submit"
      >
        {{ $t('titles.add.submit') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>

<style scoped>
.preview-title {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
