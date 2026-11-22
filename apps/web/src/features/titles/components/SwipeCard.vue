<script setup lang="ts">
import {
  formatDuration,
  type GroupTitle,
  type WatchStatus,
} from '@watchlist/shared';
import { mdiOpenInNew } from '@mdi/js';
import { computed, ref } from 'vue';
import { statusAppearance, statusChoices } from '../status';
import { swipeChoice, swipeHint } from '../swipe';
import MediaThumb from './MediaThumb.vue';
import MemberStatuses from './MemberStatuses.vue';

const props = defineProps<{ title: GroupTitle }>();
const emit = defineEmits<{ decide: [status: WatchStatus] }>();

const dx = ref(0);
const dy = ref(0);
const dragging = ref(false);
/** La carte s'envole après un choix : on ignore les gestes suivants. */
const leaving = ref(false);
let start: { x: number; y: number } | null = null;

const hint = computed(() => swipeHint(dx.value, dy.value));
const meta = computed(() =>
  [
    props.title.media.author,
    props.title.media.durationSec !== null
      ? formatDuration(props.title.media.durationSec)
      : null,
  ]
    .filter(Boolean)
    .join(' · '),
);
const cardStyle = computed(() => ({
  transform: `translate(${dx.value}px, ${dy.value}px) rotate(${dx.value / 18}deg)`,
  transition: dragging.value ? 'none' : 'transform 220ms ease-out',
}));

function onDown(event: PointerEvent) {
  if (leaving.value || event.button !== 0) return;
  start = { x: event.clientX, y: event.clientY };
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onMove(event: PointerEvent) {
  if (!dragging.value || !start) return;
  dx.value = event.clientX - start.x;
  dy.value = Math.min(event.clientY - start.y, 40);
}

function onUp() {
  if (!dragging.value) return;
  dragging.value = false;
  start = null;
  const choice = swipeChoice(dx.value, dy.value);
  if (choice) decide(choice);
  else {
    dx.value = 0;
    dy.value = 0;
  }
}

/** Fait partir la carte dans la direction du choix, puis le transmet. */
function decide(choice: WatchStatus) {
  if (leaving.value) return;
  leaving.value = true;
  dx.value =
    choice === 'OK_ALONE' ? 600 : choice === 'NOT_INTERESTED' ? -600 : 0;
  dy.value = choice === 'TOGETHER' ? -900 : dy.value;
  setTimeout(() => emit('decide', choice), 180);
}
</script>

<template>
  <div class="swipe-area">
    <v-card
      class="swipe-card pa-3"
      rounded="xl"
      color="surface"
      :style="cardStyle"
      data-test="swipe-card"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div class="position-relative">
        <MediaThumb :src="title.media.thumbnailUrl" width="100%" />
        <div
          v-if="hint"
          class="hint text-title-medium"
          :class="`bg-${statusAppearance[hint].color}`"
          data-test="swipe-hint"
        >
          <v-icon :icon="statusAppearance[hint].icon" start />
          {{ $t(`titles.status.${hint}`) }}
        </div>
      </div>
      <h2 class="text-title-large font-display mt-3 title-text">
        {{ title.media.title }}
      </h2>
      <p class="text-body-medium text-medium-emphasis">{{ meta }}</p>
      <p class="text-body-small text-medium-emphasis mt-1">
        {{
          title.addedBy
            ? $t('titles.addedBy', {
                name: title.addedBy.formerMember
                  ? $t('titles.formerMember')
                  : title.addedBy.displayName,
              })
            : $t('titles.addedByDeleted')
        }}
      </p>
      <div class="d-flex align-center justify-space-between mt-2">
        <MemberStatuses :title="title" />
        <v-btn
          :href="title.media.url"
          target="_blank"
          rel="noopener noreferrer"
          variant="text"
          size="small"
          :append-icon="mdiOpenInNew"
          class="text-none"
          @pointerdown.stop
        >
          {{ $t('titles.watchOnYoutube') }}
        </v-btn>
      </div>
    </v-card>

    <!-- Les trois gros boutons, pour qui ne glisse pas (ou au clavier). -->
    <div
      class="d-flex ga-2 mt-4"
      role="group"
      :aria-label="$t('titles.yourStatus')"
    >
      <v-btn
        v-for="choice in statusChoices"
        :key="choice"
        :color="statusAppearance[choice].color"
        variant="tonal"
        :prepend-icon="statusAppearance[choice].icon"
        rounded="lg"
        size="large"
        stacked
        class="flex-1-1 text-none choice"
        :disabled="leaving"
        :data-test="`decide-${choice}`"
        @click="decide(choice)"
      >
        {{ $t(`titles.status.${choice}`) }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.swipe-card {
  touch-action: none;
  user-select: none;
  cursor: grab;
  will-change: transform;
}
.title-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 999px;
  white-space: nowrap;
}
.choice {
  min-width: 0;
  letter-spacing: normal;
}
</style>
