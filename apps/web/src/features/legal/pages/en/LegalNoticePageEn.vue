<script setup lang="ts">
import LegalLayout from '../../components/LegalLayout.vue';
import LegalValue from '../../components/LegalValue.vue';
import { host, publisher } from '../../publisher';
import { hostEn, inEnglish, publisherEn } from '../../publisher.en';
</script>

<template>
  <!-- Traduction de LegalNoticePage.vue (la version française fait foi). -->
  <LegalLayout :title="$t('legal.notice')">
    <h2>Publisher</h2>
    <p>
      Canapact is a service published by
      <LegalValue :value="publisher.name" />.<br />
      Address:
      <LegalValue
        :value="inEnglish(publisher.address, publisherEn.address)"
      /><br />
      Contact: <LegalValue :value="publisher.email" />
      <template v-if="publisher.siret">
        <br />SIRET: <LegalValue :value="publisher.siret" />
      </template>
    </p>
    <p>Publication director: <LegalValue :value="publisher.director" /></p>

    <h2>Hosting</h2>
    <p>
      <LegalValue :value="host.name" /><br />
      <LegalValue :value="host.address" /><br />
      Phone: <LegalValue :value="host.phone" /><br />
      Servers located in:
      <LegalValue :value="inEnglish(host.location, hostEn.location)" />
    </p>

    <h2>Third-party content</h2>
    <p>
      Video titles, thumbnails and channel names shown in Canapact come from
      YouTube and belong to their authors. They are obtained through the YouTube
      API Services and displayed as is. Canapact is not affiliated with, or
      endorsed by, YouTube or Google.
    </p>

    <h2>Intellectual property</h2>
    <p>
      The Canapact name, its logo, its interface and its texts are protected.
      Any reproduction without permission is prohibited.
    </p>

    <h2>Personal data</h2>
    <p>
      See the
      <router-link :to="{ name: 'privacy' }">privacy policy</router-link>.
    </p>
  </LegalLayout>
</template>
