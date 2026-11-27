import type { Locale } from '@watchlist/shared';
import type { MailMessage } from './mail-transport.js';

type Template = Omit<MailMessage, 'to'>;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const COMMON: Record<Locale, { copyLink: string; colon: string }> = {
  fr: { copyLink: 'Le bouton ne marche pas ? Copiez ce lien :', colon: ' : ' },
  en: { copyLink: 'Button not working? Copy this link:', colon: ': ' },
};

/** Salutation du soir, ton « Cocon du soir ». */
function greeting(locale: Locale, name: string): string {
  return locale === 'en' ? `Good evening ${name},` : `Bonsoir ${name},`;
}

/** « 23 décembre 2026 » / « 23 December 2026 », à l'heure de Paris. */
export function formatMailDate(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

/** Mise en page commune, sobre et lisible dans tous les clients mail (tons « Cocon du soir »). */
function layout(opts: {
  locale: Locale;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
}): Pick<Template, 'html' | 'text'> {
  const html = `<!doctype html>
<html lang="${opts.locale}"><body style="margin:0;background:#1d1520;font-family:Inter,Arial,sans-serif;color:#f3e9e4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#2a1f2d;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 28px">
<p style="margin:0 0 24px;font-family:Fraunces,Georgia,serif;font-size:22px;color:#f5b971">Canapact</p>
<p style="margin:0 0 16px;font-size:16px">${escapeHtml(opts.greeting)}</p>
${opts.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n')}
${
  opts.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.action.url)}" style="display:inline-block;background:#f5b971;color:#2a1f2d;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${escapeHtml(opts.action.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#bfaeb6;word-break:break-all">${escapeHtml(COMMON[opts.locale].copyLink)} ${escapeHtml(opts.action.url)}</p>`
    : ''
}
<p style="margin:24px 0 0;font-size:13px;color:#bfaeb6">${escapeHtml(opts.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    opts.greeting,
    '',
    ...opts.paragraphs.flatMap((p) => [p, '']),
    ...(opts.action
      ? [
          `${opts.action.label}${COMMON[opts.locale].colon}${opts.action.url}`,
          '',
        ]
      : []),
    opts.footer,
    '',
    '— Canapact',
  ].join('\n');

  return { html, text };
}

export function verifyEmailTemplate(
  locale: Locale,
  name: string,
  url: string,
): Template {
  const copy = {
    fr: {
      subject: 'Confirmez votre adresse email',
      paragraph:
        'Plus qu’un clic et le canapé est à vous : confirmez votre adresse pour activer votre compte Canapact.',
      action: 'Confirmer mon adresse',
      footer:
        'Ce lien est valable 24 heures. Vous n’êtes pas à l’origine de cette inscription ? Ignorez simplement cet email.',
    },
    en: {
      subject: 'Confirm your email address',
      paragraph:
        'One click and the couch is all yours: confirm your address to activate your Canapact account.',
      action: 'Confirm my address',
      footer:
        'This link is valid for 24 hours. Didn’t sign up? Just ignore this email.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: [copy.paragraph],
      action: { label: copy.action, url },
      footer: copy.footer,
    }),
  };
}

export function resetPasswordTemplate(
  locale: Locale,
  name: string,
  url: string,
): Template {
  const copy = {
    fr: {
      subject: 'Réinitialisez votre mot de passe',
      paragraph:
        'Un trou de mémoire ? Ça arrive aux meilleurs. Choisissez un nouveau mot de passe avec le lien ci-dessous.',
      action: 'Choisir un nouveau mot de passe',
      footer:
        'Ce lien est valable 1 heure et ne sert qu’une fois. Vous n’avez rien demandé ? Ignorez cet email, votre mot de passe ne change pas.',
    },
    en: {
      subject: 'Reset your password',
      paragraph:
        'Mind gone blank? Happens to the best of us. Pick a new password with the link below.',
      action: 'Choose a new password',
      footer:
        'This link is valid for 1 hour and works only once. Didn’t ask for anything? Ignore this email, your password stays the same.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: [copy.paragraph],
      action: { label: copy.action, url },
      footer: copy.footer,
    }),
  };
}

export function linkPasswordTemplate(
  locale: Locale,
  name: string,
  url: string,
): Template {
  const copy = {
    fr: {
      subject: 'Ajouter un mot de passe à votre compte',
      paragraphs: [
        'Quelqu’un (vous, on espère) vient de s’inscrire avec votre adresse, qui est déjà liée à votre compte Google sur Canapact.',
        'Pour pouvoir aussi vous connecter par email, choisissez votre mot de passe avec le lien ci-dessous. Votre compte et vos groupes restent les mêmes.',
      ],
      action: 'Choisir mon mot de passe',
      footer:
        'Ce lien est valable 24 heures. Ce n’est pas vous ? Ignorez cet email : rien ne change et personne n’aura accès à votre compte.',
    },
    en: {
      subject: 'Add a password to your account',
      paragraphs: [
        'Someone (you, we hope) just signed up with your address, which is already linked to your Google account on Canapact.',
        'To also sign in by email, choose your password with the link below. Your account and your groups stay the same.',
      ],
      action: 'Choose my password',
      footer:
        'This link is valid for 24 hours. Not you? Ignore this email: nothing changes and nobody gets into your account.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: copy.paragraphs,
      action: { label: copy.action, url },
      footer: copy.footer,
    }),
  };
}

export function googleLinkedTemplate(
  locale: Locale,
  name: string,
  forgotUrl: string,
): Template {
  const copy = {
    fr: {
      subject: 'Votre compte Google est lié à Canapact',
      paragraphs: [
        'Vous venez de vous connecter à Canapact avec Google pour la première fois. Les deux sont maintenant liés : Google ou votre mot de passe, au choix, vous retrouvez le même compte et les mêmes groupes.',
        `Ce n’est pas vous ? Changez votre mot de passe sans attendre : ${forgotUrl}, et vérifiez la sécurité de votre compte Google.`,
      ],
      footer:
        'Cet email est envoyé pour votre sécurité, aucune action n’est nécessaire si c’était bien vous.',
    },
    en: {
      subject: 'Your Google account is linked to Canapact',
      paragraphs: [
        'You just signed in to Canapact with Google for the first time. The two are now linked: Google or your password, your pick, you get the same account and the same groups.',
        `Not you? Change your password right away: ${forgotUrl}, and check the security of your Google account.`,
      ],
      footer:
        'This email is sent for your security, nothing to do if it was you.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: copy.paragraphs,
      footer: copy.footer,
    }),
  };
}

export function inactivityWarningTemplate(
  locale: Locale,
  name: string,
  deletionAt: Date,
  loginUrl: string,
): Template {
  const date = formatMailDate(locale, deletionAt);
  const copy = {
    fr: {
      subject: `Votre compte Canapact sera supprimé le ${date}`,
      paragraphs: [
        'Le canapé est vide depuis un moment : votre compte Canapact n’a pas servi depuis bientôt trois ans.',
        `Pour ne pas garder vos données sans raison, votre compte sera supprimé le ${date}, avec vos avis et votre place dans vos groupes. Les titres que vous avez ajoutés restent pour les autres membres, signés « ancien membre ».`,
        'Vous voulez le garder ? Connectez-vous simplement avant cette date, rien d’autre à faire.',
      ],
      action: 'Garder mon compte',
      footer:
        'Vous pouvez aussi récupérer vos données depuis les réglages avant la suppression. Sans nouvelle de votre part, c’est la seule fois que nous vous écrivons à ce sujet.',
    },
    en: {
      subject: `Your Canapact account will be deleted on ${date}`,
      paragraphs: [
        'The couch has been empty for a while: your Canapact account hasn’t been used in almost three years.',
        `So we don’t keep your data for no reason, your account will be deleted on ${date}, along with your answers and your place in your groups. Titles you added stay for the other members, signed “former member”.`,
        'Want to keep it? Just sign in before that date, nothing else to do.',
      ],
      action: 'Keep my account',
      footer:
        'You can also download your data from the settings before the deletion. If we don’t hear from you, this is the only time we’ll write about it.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: copy.paragraphs,
      action: { label: copy.action, url: loginUrl },
      footer: copy.footer,
    }),
  };
}

/** Avis après un changement de mot de passe depuis les réglages. */
export function passwordChangedTemplate(
  locale: Locale,
  name: string,
  forgotUrl: string,
): Template {
  const copy = {
    fr: {
      subject: 'Votre mot de passe a changé',
      paragraphs: [
        'Le mot de passe de votre compte Canapact vient d’être changé depuis les réglages. Vos autres appareils ont été déconnectés.',
        'C’était bien vous ? Tout va bien, rien à faire.',
      ],
      action: 'Ce n’est pas moi : choisir un nouveau mot de passe',
      footer:
        'Cet email est envoyé pour votre sécurité. Si ce n’est pas vous, changez aussi le mot de passe de votre boîte mail.',
    },
    en: {
      subject: 'Your password has changed',
      paragraphs: [
        'The password of your Canapact account was just changed from the settings. Your other devices have been signed out.',
        'Was it you? All good, nothing to do.',
      ],
      action: 'Not me: choose a new password',
      footer:
        'This email is sent for your security. If it wasn’t you, also change the password of your mailbox.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: copy.paragraphs,
      action: { label: copy.action, url: forgotUrl },
      footer: copy.footer,
    }),
  };
}

/** Lien de confirmation envoyé à la nouvelle adresse. */
export function changeEmailTemplate(
  locale: Locale,
  name: string,
  url: string,
): Template {
  const copy = {
    fr: {
      subject: 'Confirmez votre nouvelle adresse',
      paragraphs: [
        'Vous avez demandé à utiliser cette adresse pour votre compte Canapact.',
        'Confirmez-la avec le lien ci-dessous. D’ici là, rien ne change : vous vous connectez toujours avec l’ancienne.',
      ],
      action: 'Confirmer cette adresse',
      footer:
        'Ce lien est valable 24 heures. Vous n’avez rien demandé ? Ignorez cet email, aucun compte ne sera lié à votre adresse.',
    },
    en: {
      subject: 'Confirm your new address',
      paragraphs: [
        'You asked to use this address for your Canapact account.',
        'Confirm it with the link below. Until then nothing changes: you still sign in with the old one.',
      ],
      action: 'Confirm this address',
      footer:
        'This link is valid for 24 hours. Didn’t ask for anything? Ignore this email, no account will be linked to your address.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: copy.paragraphs,
      action: { label: copy.action, url },
      footer: copy.footer,
    }),
  };
}

/** Avis envoyé à l'ancienne adresse, avec le lien « ce n'est pas moi ». */
export function emailChangedTemplate(
  locale: Locale,
  name: string,
  newEmail: string,
  revertUrl: string,
): Template {
  const copy = {
    fr: {
      subject: 'L’adresse de votre compte a changé',
      paragraphs: [
        `Votre compte Canapact utilise désormais l’adresse ${newEmail}. Cette adresse-ci ne sert plus à vous connecter.`,
        'C’était bien vous ? Tout va bien, rien à faire.',
        'Ce n’est pas vous ? Le lien ci-dessous remet cette adresse sur votre compte, vous fait choisir un nouveau mot de passe et déconnecte tous les appareils.',
      ],
      action: 'Ce n’est pas moi',
      footer: 'Ce lien est valable 7 jours.',
    },
    en: {
      subject: 'The address of your account has changed',
      paragraphs: [
        `Your Canapact account now uses the address ${newEmail}. This address no longer signs you in.`,
        'Was it you? All good, nothing to do.',
        'Not you? The link below puts this address back on your account, has you choose a new password and signs out every device.',
      ],
      action: 'Not me',
      footer: 'This link is valid for 7 days.',
    },
  }[locale];
  return {
    subject: copy.subject,
    ...layout({
      locale,
      greeting: greeting(locale, name),
      paragraphs: copy.paragraphs,
      action: { label: copy.action, url: revertUrl },
      footer: copy.footer,
    }),
  };
}
