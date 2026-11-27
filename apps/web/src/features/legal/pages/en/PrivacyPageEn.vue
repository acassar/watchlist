<script setup lang="ts">
import LegalLayout from '../../components/LegalLayout.vue';
import LegalValue from '../../components/LegalValue.vue';
import { host, operations, publisher } from '../../publisher';
import { hostEn, inEnglish, operationsEn } from '../../publisher.en';

/* Traduction de PrivacyPage.vue (la version française fait foi) : mêmes durées. */
const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
const GOOGLE_PERMISSIONS = 'https://myaccount.google.com/permissions';
const YOUTUBE_TERMS = 'https://www.youtube.com/t/terms';
const BREVO_PRIVACY = 'https://www.brevo.com/legal/privacypolicy/';
const CNIL_COMPLAINT = 'https://www.cnil.fr/fr/plaintes';
</script>

<template>
  <LegalLayout :title="$t('legal.privacyTitle')">
    <p>
      Canapact helps several people keep a list of videos to watch solo or
      together. This page explains what data we keep, why, for how long, and
      what you can do about it. In short: the bare minimum to make the app work,
      no advertising, no trackers, nothing sold.
    </p>

    <h2>Data controller</h2>
    <p>
      <LegalValue :value="publisher.name" />, reachable at
      <LegalValue :value="publisher.email" /> for any question or request about
      your data.
    </p>

    <h2>Data we keep</h2>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Why</th>
            <th>How long</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Email address, displayed first name or nickname, password (never
              in plain text: only an Argon2id hash), date the address was
              confirmed, chosen language, date of your last sign-in
            </td>
            <td>
              Create and secure your account, write to you about your account,
              delete accounts that are no longer used
            </td>
            <td>
              Until the account is deleted. An account that is never confirmed
              is deleted after 7 days. An account with no sign-in at all for 3
              years is deleted, just as if you did it from the settings: we
              email you a month before, and signing in is enough to keep it.
            </td>
          </tr>
          <tr>
            <td>Your Google account ID, if you use it to sign in</td>
            <td>Recognise you when you sign in with Google</td>
            <td>Until the account is deleted</td>
          </tr>
          <tr>
            <td>
              Sessions: one per signed-in device, with its date and the browser
              name (“user agent”)
            </td>
            <td>Keep you signed in, detect a stolen session</td>
            <td>
              30 days after last use, then deleted within the day. A closed
              session (sign-out) can no longer be used, but its trace is kept
              until that deadline to detect theft.
            </td>
          </tr>
          <tr>
            <td>
              Links sent by email (confirmation, forgotten password, change of
              address); for a change of address, the new address requested, then
              the old one for the “not me” link
            </td>
            <td>
              Confirm that the address really is yours, undo a change of address
              you didn't make
            </td>
            <td>
              24 hours (1 hour for a forgotten password, 7 days for the “not me”
              link), then deleted within the day
            </td>
          </tr>
          <tr>
            <td>Dates of your email address changes</td>
            <td>Limit to 2 changes in 30 days (security)</td>
            <td>30 days, then deleted within the day</td>
          </tr>
          <tr>
            <td>
              Your groups, your role, the date you joined; the invitations you
              create
            </td>
            <td>Share a list with the people close to you</td>
            <td>
              Until you leave the group or delete your account. The group name
              and its titles stay for the other members; the invitations you
              created stay linked to your account (disabled) until it is
              deleted.
            </td>
          </tr>
          <tr>
            <td>
              Titles added, your answers (together, go without me, not for me),
              what you watched solo or together and when
            </td>
            <td>
              The heart of the service: knowing what each person can watch
              without the others
            </td>
            <td>
              Your answers: until you leave the group or delete your account.
              The titles you added stay in the group, signed “former member”.
            </td>
          </tr>
          <tr>
            <td>
              Public video information (title, channel, duration, thumbnail
              address)
            </td>
            <td>Display the list</td>
            <td>
              Refreshed from YouTube or deleted at the latest 30 days after
              being obtained
            </td>
          </tr>
          <tr>
            <td>Server technical logs: IP address, date, requested address</td>
            <td>Security, limiting abuse, diagnosing outages</td>
            <td>
              <LegalValue
                :value="
                  inEnglish(
                    operations.serverLogsRetention,
                    operationsEn.serverLogsRetention,
                  )
                "
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Legal basis: performance of the service you request by creating an account
      (GDPR, art. 6.1.b); for sessions and logs, our legitimate interest in
      protecting accounts and the service (art. 6.1.f).
    </p>
    <p>
      Backups: the database is backed up every day (<LegalValue
        :value="
          inEnglish(operations.backupsLocation, operationsEn.backupsLocation)
        "
      />). Deleted data disappears from backups after
      <LegalValue
        :value="
          inEnglish(operations.backupsRetention, operationsEn.backupsRetention)
        "
      />.
    </p>

    <h2>Who sees your data</h2>
    <p>
      The other members of your groups see your first name or nickname, your
      answers on the group’s titles, what you added and whether you have watched
      it. They do not see your email address.
    </p>
    <p>We use these service providers:</p>
    <ul>
      <li>
        <strong>Hosting</strong>: <LegalValue :value="host.name" /> (servers in
        <LegalValue :value="inEnglish(host.location, hostEn.location)" />),
        which stores the database and, encrypted before sending, its backups
        (Swiss Backup).
      </li>
      <li>
        <strong>Brevo</strong> (Sendinblue SAS, France) sends account emails
        (confirmation, forgotten password). It receives your address, your first
        name or nickname and the content of the email.
        <a :href="BREVO_PRIVACY" target="_blank" rel="noopener"
          >Brevo’s policy</a
        >.
      </li>
      <li>
        <strong>Google</strong>, if you choose “Continue with Google”: sign-in
        happens at Google, which sends us your Google ID, your email address,
        whether it is verified, and your name. We ask for access to nothing else
        in your Google account (no YouTube, no contacts). You can withdraw this
        access at any time in your
        <a :href="GOOGLE_PERMISSIONS" target="_blank" rel="noopener"
          >Google account settings</a
        >.
      </li>
      <li><strong>YouTube (Google)</strong>: see the next section.</li>
    </ul>
    <p>
      Google may process data in the United States; Google LLC is certified
      under the EU–US Data Privacy Framework. We do not sell or rent any data,
      and we do not advertise.
    </p>
    <p>
      Donations go through Liberapay, a third-party site: the “Buy a blanket”
      button is just a link to its page, with no widget or tracker. Canapact
      sends it no data and does not know who donated. What you enter on
      Liberapay is covered by its own privacy policy.
    </p>

    <h2>YouTube API Services</h2>
    <p>
      Canapact uses the YouTube API Services to display the videos you add. By
      using Canapact, you also agree to the
      <a :href="YOUTUBE_TERMS" target="_blank" rel="noopener"
        >YouTube Terms of Service</a
      >. Data processed by YouTube is handled under the
      <a :href="GOOGLE_PRIVACY" target="_blank" rel="noopener"
        >Google Privacy Policy</a
      >.
    </p>
    <ul>
      <li>
        When you add a link, our server asks YouTube for the video’s title,
        channel and duration. These requests come from our server: they contain
        the video ID, but neither your IP address nor your identity.
      </li>
      <li>
        Thumbnails are displayed straight from YouTube’s servers (i.ytimg.com),
        with no copy on our side. Your browser therefore downloads them from
        Google, which then sees your IP address and browser, as with any image
        hosted by YouTube.
      </li>
      <li>Opening a video takes you to YouTube, where its own rules apply.</li>
      <li>
        We access no data from your YouTube account: no history, no playlists,
        no subscriptions.
      </li>
      <li>
        Video information is refreshed or deleted at the latest 30 days after
        being obtained.
      </li>
    </ul>

    <h2>On your device</h2>
    <p>
      Canapact sets no advertising or audience-measurement cookies, which is why
      no banner asks for your consent. Only the following are used, because they
      are essential:
    </p>
    <ul>
      <li>a session cookie (30 days), to keep you signed in;</li>
      <li>
        a temporary cookie (10 minutes) during sign-in with Google, to secure
        it;
      </li>
      <li>
        in the browser’s storage: the last group opened, the last group you
        added a title to, an invitation (7 days) or a shared link (24 hours)
        waiting for you to sign in, whether you have seen the tutorial, and the
        chosen language;
      </li>
      <li>the installed app’s cache (interface only, no personal data).</li>
    </ul>
    <p>
      Fonts are served by Canapact itself: no calls to Google Fonts. Signing out
      clears the pending invitation and link; deleting your account clears the
      rest too.
    </p>

    <h2>Your rights</h2>
    <p>At any time, you can:</p>
    <ul>
      <li>
        <strong>download your data</strong> (access and portability): Settings ›
        Download my data;
      </li>
      <li>
        <strong>delete your account</strong> (erasure): Settings › Delete my
        account. Deletion is immediate and final: account, sessions and answers
        are erased; the titles you added stay in your groups, signed “former
        member”; ownership of a group passes to the longest-standing member; a
        group where you were the only member is deleted;
      </li>
      <li><strong>leave a group</strong>: from the group settings;</li>
      <li>
        ask for your data to be corrected, object to processing or ask for it to
        be restricted, by writing to
        <LegalValue :value="publisher.email" />. We reply within a month.
      </li>
    </ul>
    <p>
      If you believe your rights are not respected, you can lodge a complaint
      with the CNIL, the French data protection authority (<a
        :href="CNIL_COMPLAINT"
        target="_blank"
        rel="noopener"
        >cnil.fr/fr/plaintes</a
      >, in French).
    </p>

    <h2>Security</h2>
    <p>
      Encrypted connection (HTTPS), passwords hashed with Argon2id, email links
      and sessions stored as hashes, limited sign-in attempts.
    </p>

    <h2>Changes</h2>
    <p>
      If this policy changes significantly, we will let you know in the app or
      by email before the change applies.
    </p>
  </LegalLayout>
</template>
