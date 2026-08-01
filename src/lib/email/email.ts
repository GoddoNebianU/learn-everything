function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validateUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Invalid URL: must start with http:// or https://");
  }
  return url;
}

export interface EmailTemplateTranslations {
  subject: string;
  greeting: string;
  body: string;
  buttonText: string;
  footer: string;
}

function renderEmailHtml(userName: string, url: string, t: EmailTemplateTranslations): string {
  const safeSubject = escapeHtml(t.subject);
  const safeUserName = escapeHtml(userName);
  const safeUrl = escapeHtml(validateUrl(url));
  const safeGreeting = escapeHtml(t.greeting);
  const safeBody = escapeHtml(t.body);
  const safeButtonText = escapeHtml(t.buttonText);
  const safeFooter = escapeHtml(t.footer);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${safeSubject}</h1>
        <p>${safeGreeting}, ${safeUserName}!</p>
        <p>${safeBody}</p>
        <p>
          <a href="${safeUrl}" class="button">${safeButtonText}</a>
        </p>
        <p style="word-break: break-all; color: #666;">${safeUrl}</p>
        <div class="footer">
          <p>${safeFooter}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateVerificationEmailHtml(
  url: string,
  userName: string,
  t: EmailTemplateTranslations
): string {
  return renderEmailHtml(userName, url, t);
}

export function generateResetPasswordEmailHtml(
  url: string,
  userName: string,
  t: EmailTemplateTranslations
): string {
  return renderEmailHtml(userName, url, t);
}
