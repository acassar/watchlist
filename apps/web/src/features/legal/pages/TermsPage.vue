<script setup lang="ts">
import LegalLayout from '../components/LegalLayout.vue';
import LegalValue from '../components/LegalValue.vue';
import { publisher } from '../publisher';

const YOUTUBE_TERMS = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
</script>

<template>
  <LegalLayout :title="$t('legal.termsTitle')">
    <p>
      Ces conditions encadrent l'utilisation de Canapact, édité par
      <LegalValue :value="publisher.name" /> (voir les
      <router-link :to="{ name: 'legal-notice' }">mentions légales</router-link
      >). Créer un compte, y compris avec Google, vaut acceptation de ces
      conditions.
    </p>

    <h2>1. Le service</h2>
    <p>
      Canapact permet de partager, au sein d'un groupe (couple, amis, colocs),
      une liste de vidéos et d'indiquer pour chacune si les autres peuvent la
      regarder sans vous. Le service est gratuit. Il est fourni tel quel, sans
      garantie de disponibilité : il peut être interrompu pour maintenance,
      modifié ou arrêté. En cas d'arrêt définitif, vous serez prévenu à l'avance
      pour pouvoir télécharger vos données.
    </p>

    <h2>2. Services d'API YouTube</h2>
    <p>
      Canapact utilise les services d'API YouTube pour afficher les vidéos
      ajoutées. En utilisant Canapact, vous acceptez d'être lié par les
      <a :href="YOUTUBE_TERMS" target="_blank" rel="noopener"
        >conditions d'utilisation de YouTube</a
      >. Les données traitées par Google le sont selon les
      <a :href="GOOGLE_PRIVACY" target="_blank" rel="noopener"
        >règles de confidentialité de Google</a
      >. Canapact n'est ni affilié à YouTube ou Google, ni approuvé par eux.
    </p>

    <h2>3. Votre compte</h2>
    <ul>
      <li>Canapact est réservé aux personnes âgées d'au moins 15 ans.</li>
      <li>
        Vous donnez une adresse email valide qui est la vôtre, et vous gardez
        votre mot de passe pour vous. Vous êtes responsable de ce qui est fait
        depuis votre compte.
      </li>
      <li>
        Vous pouvez supprimer votre compte à tout moment depuis les réglages. Ce
        qui arrive alors à vos données est décrit dans la
        <router-link :to="{ name: 'privacy' }"
          >politique de confidentialité</router-link
        >.
      </li>
    </ul>

    <h2>4. Groupes et invitations</h2>
    <ul>
      <li>
        Tout membre peut ajouter des titres et inviter quelqu'un par lien ou par
        code. Ne partagez une invitation qu'avec les personnes que vous voulez
        dans le groupe.
      </li>
      <li>
        Le propriétaire peut renommer le groupe et en retirer un membre. Chacun
        peut quitter un groupe quand il veut ; les titres qu'il a ajoutés
        restent, signés « ancien membre ».
      </li>
    </ul>

    <h2>5. Bonne conduite</h2>
    <p>
      Les noms (le vôtre, celui des groupes) et les liens que vous ajoutez sont
      visibles des membres de vos groupes. Vous vous engagez à ne pas :
    </p>
    <ul>
      <li>
        utiliser des noms injurieux, haineux, ou qui usurpent l'identité de
        quelqu'un ;
      </li>
      <li>
        ajouter des contenus illicites, ou utiliser Canapact pour harceler qui
        que ce soit ;
      </li>
      <li>
        tenter de contourner les limites techniques, d'accéder aux données
        d'autres personnes ou de perturber le service (robots, envoi massif).
      </li>
    </ul>
    <p>
      En cas de manquement, le compte concerné peut être suspendu ou supprimé,
      après vous avoir demandé de vous expliquer sauf urgence. Pour signaler un
      contenu ou un abus : <LegalValue :value="publisher.email" />.
    </p>

    <h2>6. Contenus des vidéos</h2>
    <p>
      Canapact n'héberge aucune vidéo : il affiche des liens vers YouTube avec
      leur titre et leur miniature. Les vidéos restent sous la responsabilité de
      leurs auteurs et de YouTube. Une vidéo supprimée ou rendue privée sur
      YouTube peut ne plus s'afficher correctement.
    </p>

    <h2>7. Responsabilité</h2>
    <p>
      L'éditeur fait de son mieux pour que Canapact fonctionne et protège vos
      données, mais ne peut être tenu responsable d'une indisponibilité, d'une
      perte de données liée à un événement hors de son contrôle, ni d'un
      désaccord sur ce qu'on a le droit de regarder sans l'autre.
    </p>

    <h2>8. Modifications</h2>
    <p>
      Ces conditions peuvent évoluer. En cas de changement important, vous serez
      prévenu dans l'app ou par email avant qu'il s'applique ; continuer à
      utiliser Canapact ensuite vaut acceptation. Sinon, vous pouvez supprimer
      votre compte.
    </p>

    <h2>9. Droit applicable</h2>
    <p>
      Ces conditions sont soumises au droit français. En cas de litige, nous
      chercherons d'abord une solution amiable ; à défaut, les tribunaux
      français sont compétents, sous réserve des règles protectrices dont vous
      bénéficiez comme consommateur.
    </p>
  </LegalLayout>
</template>
