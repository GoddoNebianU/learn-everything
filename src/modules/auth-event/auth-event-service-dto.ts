export type AuthEventMetadata = Record<string, unknown> | undefined;

export interface RecordAuthEventParams {
  userId: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: AuthEventMetadata;
}
