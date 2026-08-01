import { headers } from "next/headers";
import { createLogger } from "@/lib/logger";
import { errorMessage } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { Prisma } from "../../../generated/prisma/client";
import type { RecordAuthEventParams } from "./auth-event-service-dto";

const log = createLogger("auth-event-service");

/**
 * Resolve the client IP from common proxy headers. Returns the leftmost
 * address from `x-forwarded-for`, falling back to `x-real-ip`.
 */
function resolveIp(forwardedFor: string | null, realIp: string | null): string | null {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return realIp ?? null;
}

/**
 * Record an auth-domain event to the auth.authevent audit table.
 *
 * Captures request context (IP, user-agent) from the current request headers.
 * ALWAYS resolves successfully: any internal error is logged and swallowed
 * so that audit logging can never break the auth flow it is observing
 * (called from inside better-auth databaseHooks and the forgot-password
 * server action).
 */
export async function recordAuthEvent(params: RecordAuthEventParams): Promise<void> {
  let headerIp: string | null = null;
  let headerUserAgent: string | null = null;
  try {
    const h = await headers();
    headerIp = resolveIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
    headerUserAgent = h.get("user-agent");
  } catch {
    log.debug("No request context available for auth-event logging");
  }

  const ip = params.ip !== undefined ? params.ip : headerIp;
  const userAgent = params.userAgent !== undefined ? params.userAgent : headerUserAgent;

  try {
    await prisma.authEvent.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType ?? null,
        ip,
        userAgent,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (e) {
    log.error("Failed to record auth event", {
      error: errorMessage(e),
      action: params.action,
    });
  }
}
