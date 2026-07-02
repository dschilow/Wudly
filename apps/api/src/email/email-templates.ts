/**
 * Minimal, inline-styled HTML shell for transactional emails — inline CSS only
 * (many mail clients strip <style> blocks), single accent color matching the
 * web app's indigo, no external assets so it renders identically everywhere.
 */
function shell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f4f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 4px;">
                <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6a5acd;">Wudly</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;color:#1a1a1a;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#9a978c;">Wudly — Echte Besitzer. Echte Nutzung. Bessere Käufe.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#6a5acd;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${label}</a>`;
}

export function passwordResetEmail(resetUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Passwort zurücksetzen',
    html: shell(
      `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">Passwort zurücksetzen</p>
       <p style="margin:12px 0 0;color:#4a4a4a;">Du hast angefordert, dein Wudly-Passwort zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu vergeben. Der Link ist 1 Stunde gültig.</p>
       ${button(resetUrl, 'Neues Passwort vergeben')}
       <p style="margin:24px 0 0;font-size:13px;color:#9a978c;">Hast du das nicht angefordert, kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert.</p>`,
    ),
    text: `Passwort zurücksetzen\n\nDu hast angefordert, dein Wudly-Passwort zurückzusetzen. Öffne diesen Link (1 Stunde gültig), um ein neues Passwort zu vergeben:\n${resetUrl}\n\nHast du das nicht angefordert, kannst du diese E-Mail ignorieren.`,
  };
}

export function questionAnsweredEmail(params: {
  productName: string;
  questionText: string;
  answerText: string;
  questionUrl: string;
}): { subject: string; html: string; text: string } {
  const { productName, questionText, answerText, questionUrl } = params;
  return {
    subject: `Deine Frage zu ${productName} wurde beantwortet`,
    html: shell(
      `<p style="margin:0 0 4px;font-size:20px;font-weight:700;">Neue Antwort erhalten</p>
       <p style="margin:12px 0 0;color:#4a4a4a;">Ein echter Besitzer hat deine Frage zu <strong>${escapeHtml(productName)}</strong> beantwortet.</p>
       <div style="margin-top:16px;padding:14px 16px;background:#f4f3ee;border-radius:12px;">
         <p style="margin:0;font-size:13px;color:#6a6a6a;">Deine Frage</p>
         <p style="margin:4px 0 0;font-weight:600;">${escapeHtml(questionText)}</p>
       </div>
       <div style="margin-top:10px;padding:14px 16px;background:#eef0ff;border-radius:12px;">
         <p style="margin:0;font-size:13px;color:#6a6a6a;">Antwort</p>
         <p style="margin:4px 0 0;">${escapeHtml(answerText)}</p>
       </div>
       ${button(questionUrl, 'Antwort ansehen')}`,
    ),
    text: `Neue Antwort erhalten\n\nEin echter Besitzer hat deine Frage zu ${productName} beantwortet.\n\nDeine Frage: ${questionText}\nAntwort: ${answerText}\n\nAnsehen: ${questionUrl}`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
