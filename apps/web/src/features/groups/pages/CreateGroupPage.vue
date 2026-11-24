<script setup lang="ts">
import { groupNameSchema } from '@watchlist/shared';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiErrorMessage, zodRule } from '@/features/auth/validation';
import PageHeader from '../components/PageHeader.vue';
import { useGroupsStore } from '../store';

const groups = useGroupsStore();
const router = useRouter();
const name = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

async function submit(event: Promise<{ valid: boolean }>) {
  if (!(await event).valid) return;
  loading.value = true;
  error.value = null;
  try {
    const group = await groups.create(groupNameSchema.parse(name.value));
    // Tout de suite sur la page du groupe : l'étape suivante, c'est d'inviter.
    await router.replace({
      name: 'group',
      params: { groupId: group.id },
      query: { created: '1' },
    });
  } catch (e) {
    error.value = apiErrorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container class="page pa-4">
    <PageHeader :title="$t('groups.create.title')" />
    <template v-if="groups.atGroupLimit">
      <v-alert
        variant="tonal"
        class="mb-6"
        :title="$t('groups.limit.title')"
        :text="$t('groups.limit.body')"
      />
      <p class="text-body-medium text-medium-emphasis mb-6">
        {{ $t('groups.limit.leaveHint') }}
      </p>
      <v-btn color="primary" size="large" rounded="pill" block to="/">
        {{ $t('groups.join.back') }}
      </v-btn>
    </template>
    <template v-else>
      <p class="text-body-medium text-medium-emphasis mb-6">
        {{ $t('groups.create.body') }}
      </p>
      <v-form validate-on="submit lazy" @submit.prevent="submit">
        <v-text-field
          v-model="name"
          :label="$t('groups.name')"
          :placeholder="$t('groups.create.placeholder')"
          :rules="[zodRule(groupNameSchema)]"
          :counter="50"
          maxlength="50"
          autocomplete="off"
          variant="outlined"
          autofocus
          class="mb-2"
        />
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          :text="error"
        />
        <v-btn
          type="submit"
          color="primary"
          size="large"
          rounded="pill"
          block
          :loading="loading"
        >
          {{ $t('groups.create.submit') }}
        </v-btn>
      </v-form>
    </template>
  </v-container>
</template>

<style scoped>
.page {
  max-width: 560px;
}
</style>
