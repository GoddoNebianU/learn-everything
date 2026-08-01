import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";

import { prisma } from "../db";
import { createLogger } from "../logger";
import { checkIpLimit, recordFailedIp, clearIp, getRequestIp } from "../ip-limiter";
import { AUTH } from "@/config/app";
import { serverEnv } from "@/lib/env";
import { sendEmail, generateVerificationEmailHtml, generateResetPasswordEmailHtml } from "../email";
import type { EmailTemplateTranslations } from "../email";
import { recordAuthEvent } from "@/modules/auth-event/auth-event-service";
import { AUTH_EVENT_ACTIONS } from "@/modules/auth-event/auth-event-actions";

const log = createLogger("auth");

const { SIGNUP_MAX_PER_IP, SIGNUP_WINDOW_MS, LOGIN_MAX_FAILS, LOGIN_WINDOW_MS } = AUTH;

async function getVerificationEmailTranslations(): Promise<EmailTemplateTranslations> {
  const t = await getTranslations("email.verification");
  return {
    subject: t("subject"),
    greeting: t("greeting"),
    body: t("body"),
    buttonText: t("buttonText"),
    footer: t("footer"),
  };
}

async function getResetPasswordEmailTranslations(): Promise<EmailTemplateTranslations> {
  const t = await getTranslations("email.resetPassword");
  return {
    subject: t("subject"),
    greeting: t("greeting"),
    body: t("body"),
    buttonText: t("buttonText"),
    footer: t("footer"),
  };
}

export const auth = betterAuth({
  // ─── SSO triple (cross-subdomain session sharing) ────────────────────
  // secret must match every consumer (learn-languages, learn-together).
  // cookiePrefix stays at the default `better-auth` so the session cookie
  // name is identical across hosts. useSecureCookies is NOT hardcoded —
  // better-auth derives it from the baseURL protocol (https → __Secure-
  // prefixed cookie; http://localhost → plain). The three prod subdomains
  // are all https, so the cookie name is consistent across them.
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: serverEnv.BETTER_AUTH_URL,
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: "lernu.cc",
    },
  },
  trustedOrigins: ["https://lernu.cc", "https://lang.lernu.cc", "https://together.lernu.cc"],

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const translations = await getResetPasswordEmailTranslations();
      const result = await sendEmail({
        to: user.email,
        subject: translations.subject,
        html: generateResetPasswordEmailHtml(url, user.name || translations.greeting, translations),
      });
      if (!result.success) {
        log.error("Failed to send reset password email", { error: result.error });
      }
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await recordAuthEvent({
        userId: user.id,
        action: AUTH_EVENT_ACTIONS.EMAIL_VERIFY_SEND,
        entityType: "user",
        entityId: user.id,
      });
      const translations = await getVerificationEmailTranslations();
      const result = await sendEmail({
        to: user.email,
        subject: translations.subject,
        html: generateVerificationEmailHtml(url, user.name || translations.greeting, translations),
      });
      if (!result.success) {
        log.error("Failed to send verification email", { error: result.error });
      }
    },
  },

  plugins: [nextCookies(), username()],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" || ctx.path === "/update-user") {
        if (ctx.path === "/sign-up/email") {
          const ip = await getRequestIp();
          if (ip && !checkIpLimit(`signup:${ip}`, SIGNUP_MAX_PER_IP, SIGNUP_WINDOW_MS)) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Too many registrations from this IP. Please try again tomorrow.",
            });
          }
        }

        const body = ctx.body as { username?: string };
        if (!body.username || body.username.trim() === "") {
          throw new APIError("BAD_REQUEST", {
            message: "Username is required",
          });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
          throw new APIError("BAD_REQUEST", {
            message: "Username can only contain letters, numbers, and underscores",
          });
        }
      }

      if (ctx.path === "/sign-in/username" || ctx.path === "/sign-in/email") {
        const ip = await getRequestIp();
        if (ip && !checkIpLimit(`login:${ip}`, LOGIN_MAX_FAILS, LOGIN_WINDOW_MS)) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many login attempts. Please try again in 15 minutes.",
          });
        }

        const body = ctx.body as { username?: string; email?: string };
        const identifier = body.username || body.email;
        if (identifier) {
          const user = await prisma.user.findFirst({
            where: {
              OR: [{ username: identifier }, { email: identifier }],
            },
            select: { emailVerified: true, email: true },
          });

          if (user && !user.emailVerified) {
            if (ip) recordFailedIp(`login:${ip}`, LOGIN_WINDOW_MS);
            await recordAuthEvent({
              userId: null,
              action: AUTH_EVENT_ACTIONS.LOGIN_FAILED,
              entityType: "user",
              metadata: { email: user.email, reason: "email_not_verified" },
            });
            throw new APIError("FORBIDDEN", {
              message: "Please verify your email address before signing in",
            });
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/username" || ctx.path === "/sign-in/email") {
        const ip = await getRequestIp();
        if (ip) {
          const returned = ctx.context.returned;
          const status = (returned as Response | undefined)?.status;
          if (status && status < 400) {
            clearIp(`login:${ip}`);
          } else {
            recordFailedIp(`login:${ip}`, LOGIN_WINDOW_MS);
          }
        }
      }
    }),
  },

  // ─── Audit: write AuthEvent rows (NOT lang's activity_logs).
  // try/catch lives inside recordAuthEvent — a DB failure here can never
  // break the auth flow that triggered it.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await recordAuthEvent({
            userId: user.id,
            action: AUTH_EVENT_ACTIONS.SIGNUP,
            entityType: "user",
            entityId: user.id,
            metadata: { email: user.email },
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await recordAuthEvent({
            userId: session.userId,
            action: AUTH_EVENT_ACTIONS.LOGIN,
            entityType: "session",
            entityId: session.id,
            ip: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
          });
        },
      },
    },
  },
});
