import nodemailer from "nodemailer";
import { createLogger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";

const log = createLogger("smtp");

// Module-level singleton: created lazily on first use. Env is static (read
// from serverEnv at startup, not from DB), so there is no need for a
// cache-invalidation hook like learn-languages' clearSmtpTransporter —
// changing SMTP credentials requires a redeploy, by design.
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    log.info("Initializing SMTP transporter", { host: serverEnv.SMTP_HOST });
    _transporter = nodemailer.createTransport({
      host: serverEnv.SMTP_HOST,
      port: serverEnv.SMTP_PORT,
      secure: serverEnv.SMTP_SECURE,
      auth: {
        user: serverEnv.SMTP_USER,
        pass: serverEnv.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const info = await getTransporter().sendMail({
      from: serverEnv.SMTP_FROM,
      to,
      subject,
      html,
      text,
    });
    log.info("Email sent", { to, subject, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    log.error("Failed to send email", { to, subject, error });
    return { success: false, error };
  }
}
