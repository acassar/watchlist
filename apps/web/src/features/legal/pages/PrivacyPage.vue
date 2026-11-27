<script setup lang="ts">
import LegalLayout from '../components/LegalLayout.vue';
import LegalValue from '../components/LegalValue.vue';
import { host, operations, publisher } from '../publisher';

/*
 * Chaque durée ici doit correspondre au code : sessions (REFRESH_TOKEN_TTL_MS),
 * liens par email (auth.constants.ts), comptes non confirmés, comptes
 * inactifs et purge (RetentionService), cache YouTube (MediaRefreshService).
 */
const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
const GOOGLE_PERMISSIONS = 'https://myaccount.google.com/permissions';
const YOUTUBE_TERMS = 'https://www.youtube.com/t/terms';
const BREVO_PRIVACY = 'https://www.brevo.com/fr/legal/privacypolicy/';
const CNIL_COMPLAINT = 'https://www.cnil.fr/fr/plaintes';
</script>

<template>
  <LegalLayout :title="$t('legal.privacyTitle')">
    <p>
      Canapact sert à tenir, à plusieurs, une liste de vidéos à regarder seul ou
      ensemble. Cette page explique quelles données nous gardons, pourquoi,
      combien de temps, et ce que vous pouvez en faire. En bref : le strict
      nécessaire pour faire marcher l'app, aucune publicité, aucun traceur, rien
      de revendu.
    </p>

    <h2>Responsable du traitement</h2>
    <p>
      <LegalValue :value="publisher.name" />, joignable à
      <LegalValue :value="publisher.email" /> pour toute question ou demande sur
      vos données.
    </p>

    <h2>Données que nous gardons</h2>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Données</th>
            <th>Pourquoi</th>
            <th>Combien de temps</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Adresse email, prénom ou pseudo affiché, mot de passe (jamais en
              clair : seulement une empreinte Argon2id), date de confirmation de
              l'adresse, langue choisie, date de votre dernière connexion
            </td>
            <td>
              Créer et sécuriser votre compte, vous écrire au sujet du compte,
              supprimer les comptes qui ne servent plus
            </td>
            <td>
              Jusqu'à la suppression du compte. Un compte jamais confirmé est
              supprimé au bout de 7 jours. Un compte sans aucune connexion
              pendant 3 ans est supprimé, comme si vous le faisiez depuis les
              réglages : nous vous prévenons par email un mois avant, et il
              suffit de vous connecter pour le garder.
            </td>
          </tr>
          <tr>
            <td>
              Identifiant de votre compte Google, si vous l'utilisez pour vous
              connecter
            </td>
            <td>Vous reconnaître à la connexion avec Google</td>
            <td>Jusqu'à la suppression du compte</td>
          </tr>
          <tr>
            <td>
              Sessions : une par appareil connecté, avec sa date et le nom du
              navigateur (« user agent »)
            </td>
            <td>Rester connecté, repérer un vol de session</td>
            <td>
              30 jours après la dernière utilisation, puis supprimées dans la
              journée. Une session fermée (déconnexion) ne sert plus, mais sa
              trace est gardée jusqu'à cette échéance pour repérer un vol.
            </td>
          </tr>
          <tr>
            <td>
              Liens envoyés par email (confirmation, mot de passe oublié,
              changement d'adresse) ; pour un changement d'adresse, la nouvelle
              adresse demandée, puis l'ancienne pour le lien « ce n'est pas moi
              »
            </td>
            <td>
              Confirmer que l'adresse est bien la vôtre, annuler un changement
              d'adresse que vous n'avez pas fait
            </td>
            <td>
              24 heures (1 heure pour le mot de passe oublié, 7 jours pour le
              lien « ce n'est pas moi »), puis supprimés dans la journée
            </td>
          </tr>
          <tr>
            <td>Dates de vos changements d'adresse email</td>
            <td>Limiter à 2 changements sur 30 jours (sécurité)</td>
            <td>30 jours, puis supprimées dans la journée</td>
          </tr>
          <tr>
            <td>
              Vos groupes, votre rôle, votre date d'arrivée ; les invitations
              que vous créez
            </td>
            <td>Partager une liste avec vos proches</td>
            <td>
              Jusqu'à ce que vous quittiez le groupe ou supprimiez votre compte.
              Le nom du groupe et ses titres restent pour les autres membres ;
              les invitations que vous avez créées restent liées à votre compte
              (désactivées) jusqu'à sa suppression.
            </td>
          </tr>
          <tr>
            <td>
              Titres ajoutés, vos avis (ensemble, sans moi, pas pour moi), ce
              que vous avez vu seul ou ensemble et quand
            </td>
            <td>
              Le cœur du service : savoir ce que chacun peut regarder sans les
              autres
            </td>
            <td>
              Vos avis : jusqu'à ce que vous quittiez le groupe ou supprimiez
              votre compte. Les titres que vous avez ajoutés restent dans le
              groupe, signés « ancien membre ».
            </td>
          </tr>
          <tr>
            <td>
              Informations publiques des vidéos (titre, chaîne, durée, adresse
              de la miniature)
            </td>
            <td>Afficher la liste</td>
            <td>
              Rafraîchies auprès de YouTube ou supprimées au plus tard 30 jours
              après leur obtention
            </td>
          </tr>
          <tr>
            <td>
              Journaux techniques du serveur : adresse IP, date, adresse
              demandée
            </td>
            <td>Sécurité, limiter les abus, diagnostiquer les pannes</td>
            <td><LegalValue :value="operations.serverLogsRetention" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Base légale : l'exécution du service que vous demandez en créant un compte
      (RGPD, art. 6.1.b) ; pour les sessions et les journaux, notre intérêt
      légitime à protéger les comptes et le service (art. 6.1.f).
    </p>
    <p>
      Sauvegardes : la base de données est sauvegardée chaque jour (<LegalValue
        :value="operations.backupsLocation"
      />). Une donnée supprimée disparaît des sauvegardes au bout de
      <LegalValue :value="operations.backupsRetention" />.
    </p>

    <h2>Qui voit vos données</h2>
    <p>
      Les autres membres de vos groupes voient votre prénom ou pseudo, vos avis
      sur les titres du groupe, ce que vous avez ajouté et si vous l'avez vu.
      Ils ne voient pas votre adresse email.
    </p>
    <p>Nous faisons appel à ces prestataires :</p>
    <ul>
      <li>
        <strong>Hébergement</strong> :
        <LegalValue :value="host.name" /> (serveurs en
        <LegalValue :value="host.location" />), qui stocke la base de données
        et, chiffrées avant l'envoi, ses sauvegardes (Swiss Backup).
      </li>
      <li>
        <strong>Brevo</strong> (Sendinblue SAS, France) envoie les emails du
        compte (confirmation, mot de passe oublié). Il reçoit votre adresse,
        votre prénom ou pseudo et le contenu de l'email.
        <a :href="BREVO_PRIVACY" target="_blank" rel="noopener"
          >Politique de Brevo</a
        >.
      </li>
      <li>
        <strong>Google</strong>, si vous choisissez « Continuer avec Google » :
        la connexion se fait chez Google, qui nous transmet votre identifiant
        Google, votre adresse email, le fait qu'elle soit vérifiée et votre nom.
        Nous ne demandons accès à rien d'autre de votre compte Google (ni
        YouTube, ni contacts). Vous pouvez retirer cet accès à tout moment dans
        les
        <a :href="GOOGLE_PERMISSIONS" target="_blank" rel="noopener"
          >paramètres de votre compte Google</a
        >.
      </li>
      <li><strong>YouTube (Google)</strong> : voir la section suivante.</li>
    </ul>
    <p>
      Google peut traiter des données aux États-Unis ; Google LLC est certifiée
      au Data Privacy Framework UE–États-Unis. Nous ne vendons ni ne louons
      aucune donnée, et nous ne faisons aucune publicité.
    </p>
    <p>
      Les dons passent par Liberapay, un site tiers : le bouton « Offrir un
      plaid » n'est qu'un lien vers sa page, sans widget ni traceur. Canapact ne
      lui transmet aucune donnée et ne sait pas qui a donné. Ce que vous
      saisissez sur Liberapay relève de sa propre politique de confidentialité.
    </p>

    <h2>Services d'API YouTube</h2>
    <p>
      Canapact utilise les services d'API YouTube pour afficher les vidéos que
      vous ajoutez. En utilisant Canapact, vous acceptez aussi les
      <a :href="YOUTUBE_TERMS" target="_blank" rel="noopener"
        >conditions d'utilisation de YouTube</a
      >. Les données traitées par YouTube le sont selon les
      <a :href="GOOGLE_PRIVACY" target="_blank" rel="noopener"
        >règles de confidentialité de Google</a
      >.
    </p>
    <ul>
      <li>
        Quand vous ajoutez un lien, notre serveur demande à YouTube le titre, la
        chaîne et la durée de la vidéo. Ces requêtes partent de notre serveur :
        elles contiennent l'identifiant de la vidéo, mais ni votre adresse IP ni
        votre identité.
      </li>
      <li>
        Les miniatures sont affichées directement depuis les serveurs de YouTube
        (i.ytimg.com), sans copie chez nous. Votre navigateur les télécharge
        donc chez Google, qui voit alors votre adresse IP et votre navigateur,
        comme pour toute image hébergée par YouTube.
      </li>
      <li>
        Ouvrir une vidéo vous emmène sur YouTube, où ses propres règles
        s'appliquent.
      </li>
      <li>
        Nous n'accédons à aucune donnée de votre compte YouTube : pas
        d'historique, pas de playlists, pas d'abonnements.
      </li>
      <li>
        Les informations des vidéos sont rafraîchies ou supprimées au plus tard
        30 jours après leur obtention.
      </li>
    </ul>

    <h2>Sur votre appareil</h2>
    <p>
      Canapact ne dépose aucun cookie publicitaire ni de mesure d'audience,
      c'est pourquoi aucun bandeau ne vous demande votre accord. Seuls sont
      utilisés, parce qu'ils sont indispensables :
    </p>
    <ul>
      <li>un cookie de session (30 jours), pour rester connecté ;</li>
      <li>
        un cookie temporaire (10 minutes) pendant la connexion avec Google, pour
        la sécuriser ;
      </li>
      <li>
        dans le stockage du navigateur : le dernier groupe ouvert, le dernier
        groupe où vous avez ajouté un titre, une invitation (7 jours) ou un lien
        partagé (24 heures) en attente de connexion, le fait d'avoir vu le tuto
        et la langue choisie ;
      </li>
      <li>
        le cache de l'app installée (interface seulement, aucune donnée
        personnelle).
      </li>
    </ul>
    <p>
      Les polices de caractères sont servies par Canapact lui-même : aucun appel
      à Google Fonts. La déconnexion efface l'invitation et le lien en attente ;
      la suppression du compte efface aussi le reste.
    </p>

    <h2>Vos droits</h2>
    <p>Vous pouvez, à tout moment :</p>
    <ul>
      <li>
        <strong>télécharger vos données</strong> (accès et portabilité) :
        Réglages › Télécharger mes données ;
      </li>
      <li>
        <strong>supprimer votre compte</strong> (effacement) : Réglages ›
        Supprimer mon compte. La suppression est immédiate et définitive :
        compte, sessions et avis sont effacés ; les titres que vous avez ajoutés
        restent dans vos groupes, signés « ancien membre » ; la propriété d'un
        groupe passe au membre arrivé le plus tôt ; un groupe dont vous étiez
        seul membre est supprimé ;
      </li>
      <li><strong>quitter un groupe</strong> : réglages du groupe ;</li>
      <li>
        demander la rectification de vos données, vous opposer à un traitement
        ou en demander la limitation, en écrivant à
        <LegalValue :value="publisher.email" />. Nous répondons sous un mois.
      </li>
    </ul>
    <p>
      Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser
      une réclamation à la CNIL (<a
        :href="CNIL_COMPLAINT"
        target="_blank"
        rel="noopener"
        >cnil.fr/fr/plaintes</a
      >).
    </p>

    <h2>Sécurité</h2>
    <p>
      Connexion chiffrée (HTTPS), mots de passe hachés avec Argon2id, liens par
      email et sessions stockés sous forme d'empreinte, limitation des
      tentatives de connexion.
    </p>

    <h2>Modifications</h2>
    <p>
      Si cette politique change de façon importante, nous vous prévenons dans
      l'app ou par email avant que le changement s'applique.
    </p>
  </LegalLayout>
</template>
