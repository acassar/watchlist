<script setup lang="ts">
import LegalLayout from '../components/LegalLayout.vue';
import LegalValue from '../components/LegalValue.vue';
import { host, publisher } from '../publisher';
</script>

<template>
  <!-- Mentions obligatoires (LCEN, art. 6 III). -->
  <LegalLayout :title="$t('legal.notice')">
    <h2>Éditeur</h2>
    <p>
      Canapact est un service édité par
      <LegalValue :value="publisher.name" />.<br />
      Adresse : <LegalValue :value="publisher.address" /><br />
      Contact : <LegalValue :value="publisher.email" />
      <template v-if="publisher.siret">
        <br />SIRET : <LegalValue :value="publisher.siret" />
      </template>
    </p>
    <p>
      Directeur de la publication : <LegalValue :value="publisher.director" />
    </p>

    <h2>Hébergement</h2>
    <p>
      <LegalValue :value="host.name" /><br />
      <LegalValue :value="host.address" /><br />
      Téléphone : <LegalValue :value="host.phone" /><br />
      Serveurs situés en : <LegalValue :value="host.location" />
    </p>

    <h2>Contenus de tiers</h2>
    <p>
      Les titres, miniatures et noms de chaînes des vidéos affichés dans
      Canapact proviennent de YouTube et appartiennent à leurs auteurs. Ils sont
      obtenus grâce aux services d'API YouTube et affichés tels quels. Canapact
      n'est ni affilié à YouTube ou Google, ni approuvé par eux.
    </p>

    <h2>Propriété intellectuelle</h2>
    <p>
      Le nom Canapact, son logo, son interface et ses textes sont protégés.
      Toute reproduction sans autorisation est interdite.
    </p>

    <h2>Données personnelles</h2>
    <p>
      Voir la
      <router-link :to="{ name: 'privacy' }"
        >politique de confidentialité</router-link
      >.
    </p>
  </LegalLayout>
</template>
