<script setup lang="ts">
import LegalLayout from '../../components/LegalLayout.vue';
import LegalValue from '../../components/LegalValue.vue';
import { publisher } from '../../publisher';

const YOUTUBE_TERMS = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
</script>

<template>
  <!-- Traduction de TermsPage.vue (la version française fait foi). -->
  <LegalLayout :title="$t('legal.termsTitle')">
    <p>
      These terms govern the use of Canapact, published by
      <LegalValue :value="publisher.name" /> (see the
      <router-link :to="{ name: 'legal-notice' }">legal notice</router-link>).
      Creating an account, including with Google, means you accept these terms.
    </p>

    <h2>1. The service</h2>
    <p>
      Canapact lets a group (a couple, friends, flatmates) share a list of
      videos and say, for each one, whether the others can watch it without you.
      The service is free. It is provided as is, with no guarantee of
      availability: it may be interrupted for maintenance, changed or shut down.
      If it shuts down for good, you will be told in advance so you can download
      your data.
    </p>

    <h2>2. YouTube API Services</h2>
    <p>
      Canapact uses the YouTube API Services to display the videos you add. By
      using Canapact, you agree to be bound by the
      <a :href="YOUTUBE_TERMS" target="_blank" rel="noopener"
        >YouTube Terms of Service</a
      >. Data processed by Google is handled under the
      <a :href="GOOGLE_PRIVACY" target="_blank" rel="noopener"
        >Google Privacy Policy</a
      >. Canapact is not affiliated with, or endorsed by, YouTube or Google.
    </p>

    <h2>3. Your account</h2>
    <ul>
      <li>Canapact is for people aged 15 and over.</li>
      <li>
        You provide a valid email address that is yours, and you keep your
        password to yourself. You are responsible for what is done from your
        account.
      </li>
      <li>
        You can delete your account at any time from the settings. What then
        happens to your data is described in the
        <router-link :to="{ name: 'privacy' }">privacy policy</router-link>.
      </li>
    </ul>

    <h2>4. Groups and invitations</h2>
    <ul>
      <li>
        Any member can add titles and invite someone with a link or a code. Only
        share an invitation with people you want in the group.
      </li>
      <li>
        The owner can rename the group and remove a member. Anyone can leave a
        group whenever they like; the titles they added stay, signed “former
        member”.
      </li>
    </ul>

    <h2>5. Good conduct</h2>
    <p>
      Names (yours, the groups’) and the links you add are visible to the
      members of your groups. You agree not to:
    </p>
    <ul>
      <li>
        use names that are insulting, hateful, or that impersonate someone;
      </li>
      <li>add illegal content, or use Canapact to harass anyone;</li>
      <li>
        try to get around technical limits, access other people’s data or
        disrupt the service (bots, mass sending).
      </li>
    </ul>
    <p>
      In case of a breach, the account concerned may be suspended or deleted,
      after you have been asked to explain yourself, except in an emergency. To
      report content or abuse: <LegalValue :value="publisher.email" />.
    </p>

    <h2>6. Video content</h2>
    <p>
      Canapact hosts no videos: it shows links to YouTube with their title and
      thumbnail. Videos remain the responsibility of their authors and of
      YouTube. A video deleted or made private on YouTube may no longer display
      properly.
    </p>

    <h2>7. Liability</h2>
    <p>
      The publisher does their best to keep Canapact running and to protect your
      data, but cannot be held liable for downtime, for data loss caused by an
      event beyond their control, or for a disagreement about what you are
      allowed to watch without the other.
    </p>

    <h2>8. Changes</h2>
    <p>
      These terms may change. In case of a significant change, you will be told
      in the app or by email before it applies; continuing to use Canapact
      afterwards means you accept it. Otherwise, you can delete your account.
    </p>

    <h2>9. Governing law</h2>
    <p>
      These terms are governed by French law. In case of a dispute, we will
      first seek an amicable solution; failing that, the French courts have
      jurisdiction, subject to the protective rules you benefit from as a
      consumer.
    </p>
  </LegalLayout>
</template>
