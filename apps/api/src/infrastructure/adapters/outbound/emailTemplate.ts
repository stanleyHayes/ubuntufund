/**
 * The one Ujimora email template. Every message gets a branded HTML part and
 * a plain-text part built from the same content, so they never drift apart and
 * text-only mail clients still read well.
 *
 * Every dynamic value is HTML-escaped. Only http(s) and mailto links become
 * buttons or links, and author-written text (a thank-you message, a contact
 * message) is shown as escaped text, never as markup. No web fonts or tracking
 * pixels are loaded; the only image is the static logo on our own domain.
 */

export interface EmailLink {
  label: string;
  url: string;
}

export interface EmailContent {
  /** Hidden line most inboxes show next to the subject. */
  preheader: string;
  /** Small label above the heading, e.g. "Account security". */
  eyebrow?: string;
  heading: string;
  /** Paragraphs before the button. Plain text; line breaks are kept. */
  intro?: string[];
  /** Label/value rows shown in a soft panel. */
  details?: { label: string; value: string }[];
  /** Someone else's words (a thank-you, a contact message), shown as a quote. */
  message?: { body: string; signature?: string };
  button?: EmailLink;
  /**
   * Also print the button's address as a plain link, for clients that block
   * buttons. Worth it for one-time links (verification, reset, invitations).
   */
  showLinkFallback?: boolean;
  /** Smaller paragraphs after the button: expiry, safety notes. */
  after?: string[];
  /** Why the recipient got this email. */
  footer: string[];
  footerLinks?: EmailLink[];
}

export interface EmailBrand {
  /** The web app origin; the logo is served from it. */
  webUrl: string;
  supportEmail?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const FONT = "'Outfit','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const COLORS = {
  ground: '#F2EFEA',
  banner: '#233126',
  gold: '#C7A24A',
  card: '#FFFFFF',
  ink: '#1C261D',
  body: '#3B4A40',
  muted: '#5B6B60',
  eyebrow: '#7F5E1C',
  link: '#2F6B46',
  panel: '#F6F4EF',
  cream: '#F2EFEA',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped text with its line breaks kept. */
function textToHtml(value: string): string {
  return escapeHtml(value.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');
}

/** Only our own kinds of links: anything else renders as a harmless '#'. */
export function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') return escapeHtml(url);
  } catch { /* not a URL */ }
  return '#';
}

const type = (size: number, weight: number, lineHeight: number, color: string) =>
  `font-family:${FONT};font-size:${size}px;font-weight:${weight};line-height:${lineHeight};color:${color};`;

function paragraph(value: string, className: string, style: string): string {
  return `<p class="${className}" style="margin:0 0 14px;${style}">${textToHtml(value)}</p>`;
}

function renderHtml(content: EmailContent, brand: EmailBrand): string {
  const webUrl = brand.webUrl.replace(/\/+$/, '');
  const parts: string[] = [];
  if (content.eyebrow) {
    parts.push(`<p class="eyebrow" style="margin:0 0 8px;${type(12, 700, 1.4, COLORS.eyebrow)}letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(content.eyebrow)}</p>`);
  }
  parts.push(`<h1 class="ink" style="margin:0 0 16px;${type(24, 700, 1.3, COLORS.ink)}">${escapeHtml(content.heading)}</h1>`);
  for (const text of content.intro ?? []) parts.push(paragraph(text, 'body', type(16, 400, 1.6, COLORS.body)));
  if (content.details?.length) {
    const rows = content.details.map((row, index) => `<tr><td style="padding:${index ? '12px' : '0'} 0 0;">
<p class="muted" style="margin:0 0 2px;${type(11, 700, 1.4, COLORS.muted)}letter-spacing:1px;text-transform:uppercase;">${escapeHtml(row.label)}</p>
<p class="ink" style="margin:0;${type(15, 600, 1.5, COLORS.ink)}word-break:break-word;">${textToHtml(row.value)}</p>
</td></tr>`).join('');
    parts.push(`<table role="presentation" class="panel" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;background-color:${COLORS.panel};border-radius:12px;"><tr><td style="padding:16px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr></table>`);
  }
  if (content.message) {
    const signature = content.message.signature
      ? `<p class="ink" style="margin:14px 0 0;${type(15, 600, 1.5, COLORS.ink)}">— ${escapeHtml(content.message.signature)}</p>`
      : '';
    // The brand's diamond-cut corners mark someone else's words.
    parts.push(`<table role="presentation" class="panel" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;background-color:${COLORS.panel};border-radius:4px 16px 4px 16px;"><tr><td style="padding:20px 22px;">
<p class="body" style="margin:0;${type(16, 400, 1.7, COLORS.body)}word-break:break-word;">${textToHtml(content.message.body)}</p>${signature}
</td></tr></table>`);
  }
  if (content.button) {
    const href = safeHref(content.button.url);
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;"><tr>
<td align="center" bgcolor="${COLORS.gold}" style="border-radius:9px;background-color:${COLORS.gold};">
<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 28px;${type(16, 700, 1.2, COLORS.ink)}text-decoration:none;border-radius:9px;">${escapeHtml(content.button.label)}</a>
</td></tr></table>`);
    if (content.showLinkFallback) {
      parts.push(`<p class="muted" style="margin:0 0 18px;${type(13, 400, 1.5, COLORS.muted)}">Button not working? Copy this link into your browser:<br><a class="link" href="${href}" target="_blank" rel="noopener" style="color:${COLORS.link};word-break:break-all;">${escapeHtml(content.button.url)}</a></p>`);
    }
  }
  for (const text of content.after ?? []) parts.push(paragraph(text, 'muted', type(14, 400, 1.6, COLORS.muted)));

  const footerLinks = (content.footerLinks ?? [])
    .map((link) => `<a class="link" href="${safeHref(link.url)}" target="_blank" rel="noopener" style="color:${COLORS.link};text-decoration:underline;">${escapeHtml(link.label)}</a>`)
    .join(' &nbsp;·&nbsp; ');
  const support = brand.supportEmail
    ? `Questions? <a class="link" href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${COLORS.link};text-decoration:underline;">${escapeHtml(brand.supportEmail)}</a>`
    : '';
  const footer = [
    ...content.footer.map((line) => `<p class="muted" style="margin:0 0 8px;${type(12, 400, 1.6, COLORS.muted)}">${textToHtml(line)}</p>`),
    footerLinks ? `<p style="margin:0 0 8px;${type(12, 600, 1.6, COLORS.muted)}">${footerLinks}</p>` : '',
    `<p class="muted" style="margin:0;${type(12, 400, 1.6, COLORS.muted)}">Ujimora · Ghana’s trust infrastructure for giving${support ? `<br>${support}` : ''}</p>`,
  ].join('');

  // Keeps the rest of the email out of the inbox preview line.
  const previewPad = '&#8199;&#65279;&#847;'.repeat(40);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.heading)}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
@media (max-width:620px){.container{width:100%!important;}.px{padding-left:20px!important;padding-right:20px!important;}h1{font-size:22px!important;}}
@media (prefers-color-scheme:dark){
.bg{background-color:#0F1511!important;}
.card{background-color:#172019!important;}
.panel{background-color:#1E2A21!important;}
.ink{color:#F2EFEA!important;}
.body{color:#CFD7D0!important;}
.muted{color:#A3B1A7!important;}
.link{color:#8DC9A1!important;}
.eyebrow{color:#DCC07E!important;}
}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:${COLORS.ground};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}${previewPad}</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.ground};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td class="px" style="background-color:${COLORS.banner};border-radius:16px 16px 0 0;padding:20px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:12px;"><img src="${escapeHtml(webUrl)}/favicon-192x192.png" width="40" height="40" alt="" style="display:block;border:0;outline:none;border-radius:10px;"></td>
<td style="vertical-align:middle;">
<p style="margin:0;${type(22, 700, 1.1, COLORS.cream)}letter-spacing:.2px;">Ujimora</p>
<p style="margin:0;padding-top:3px;${type(10, 600, 1.4, COLORS.gold)}letter-spacing:2px;text-transform:uppercase;">One chain · Many hands</p>
</td></tr></table>
</td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background-color:${COLORS.gold};">&nbsp;</td></tr>
<tr><td class="card px" style="background-color:${COLORS.card};border-radius:0 0 16px 16px;padding:32px 28px 26px;">
${parts.join('\n')}
</td></tr>
<tr><td class="px" style="padding:20px 28px 8px;text-align:center;">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderText(content: EmailContent, brand: EmailBrand): string {
  const blocks: string[] = [content.heading];
  blocks.push(...(content.intro ?? []));
  if (content.details?.length) blocks.push(content.details.map((row) => `${row.label}: ${row.value}`).join('\n'));
  if (content.message) blocks.push(content.message.signature ? `${content.message.body}\n\n— ${content.message.signature}` : content.message.body);
  if (content.button) blocks.push(`${content.button.label}: ${content.button.url}`);
  blocks.push(...(content.after ?? []));
  const footer = [
    ...content.footer,
    ...(content.footerLinks ?? []).map((link) => `${link.label}: ${link.url}`),
    ...(brand.supportEmail ? [`Support: ${brand.supportEmail}`] : []),
  ];
  if (footer.length) blocks.push(footer.join('\n'));
  return blocks.join('\n\n');
}

export function renderEmail(content: EmailContent, brand: EmailBrand): RenderedEmail {
  return { html: renderHtml(content, brand), text: renderText(content, brand) };
}
