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

/** Mise en page commune, sobre et lisible dans tous les clients mail (tons « Cocon du soir »). */
function layout(opts: {
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
}): Pick<Template, 'html' | 'text'> {
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#1d1520;font-family:Inter,Arial,sans-serif;color:#f3e9e4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#2a1f2d;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 28px">
<p style="margin:0 0 24px;font-family:Fraunces,Georgia,serif;font-size:22px;color:#f5b971">Canapact</p>
<p style="margin:0 0 16px;font-size:16px">${escapeHtml(opts.greeting)}</p>
${opts.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n')}
${
  opts.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.action.url)}" style="display:inline-block;background:#f5b971;color:#2a1f2d;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${escapeHtml(opts.action.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#bfaeb6;word-break:break-all">Le bouton ne marche pas ? Copiez ce lien : ${escapeHtml(opts.action.url)}</p>`
    : ''
}
<p style="margin:24px 0 0;font-size:13px;color:#bfaeb6">${escapeHtml(opts.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    opts.greeting,
    '',
    ...opts.paragraphs.flatMap((p) => [p, '']),
    ...(opts.action ? [`${opts.action.label} : ${opts.action.url}`, ''] : []),
    opts.footer,
    '',
    '— Canapact',
  ].join('\n');

  return { html, text };
}

export function verifyEmailTemplate(name: string, url: string): Template {
  return {
    subject: 'Confirmez votre adresse email',
    ...layout({
      greeting: `Bonsoir ${name},`,
      paragraphs: [
        'Plus qu’un clic et le canapé est à vous : confirmez votre adresse pour activer votre compte Canapact.',
      ],
      action: { label: 'Confirmer mon adresse', url },
      footer:
        'Ce lien est valable 24 heures. Vous n’êtes pas à l’origine de cette inscription ? Ignorez simplement cet email.',
    }),
  };
}

export function resetPasswordTemplate(name: string, url: string): Template {
  return {
    subject: 'Réinitialisez votre mot de passe',
    ...layout({
      greeting: `Bonsoir ${name},`,
      paragraphs: [
        'Un trou de mémoire ? Ça arrive aux meilleurs. Choisissez un nouveau mot de passe avec le lien ci-dessous.',
      ],
      action: { label: 'Choisir un nouveau mot de passe', url },
      footer:
        'Ce lien est valable 1 heure et ne sert qu’une fois. Vous n’avez rien demandé ? Ignorez cet email, votre mot de passe ne change pas.',
    }),
  };
}

export function linkPasswordTemplate(name: string, url: string): Template {
  return {
    subject: 'Ajouter un mot de passe à votre compte',
    ...layout({
      greeting: `Bonsoir ${name},`,
      paragraphs: [
        'Quelqu’un (vous, on espère) vient de s’inscrire avec votre adresse, qui est déjà liée à votre compte Google sur Canapact.',
        'Confirmez pour pouvoir aussi vous connecter avec ce mot de passe. Votre compte et vos groupes restent les mêmes.',
      ],
      action: { label: 'Oui, ajouter ce mot de passe', url },
      footer:
        'Ce lien est valable 24 heures. Ce n’est pas vous ? Ignorez cet email : rien ne change et personne n’aura accès à votre compte.',
    }),
  };
}

export function alreadyRegisteredTemplate(
  name: string,
  loginUrl: string,
  forgotUrl: string,
): Template {
  return {
    subject: 'Vous avez déjà un compte Canapact',
    ...layout({
      greeting: `Bonsoir ${name},`,
      paragraphs: [
        'Quelqu’un vient d’essayer de créer un compte avec votre adresse, mais vous en avez déjà un. Promis, on ne vous en fait pas un deuxième.',
        `Mot de passe oublié ? Réinitialisez-le ici : ${forgotUrl}`,
      ],
      action: { label: 'Me connecter', url: loginUrl },
      footer:
        'Ce n’est pas vous ? Ignorez cet email, votre compte n’a pas changé.',
    }),
  };
}
