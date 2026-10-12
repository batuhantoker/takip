import type { Access } from '@takip/core/entitlements';
import type { ApiKey } from '@/lib/api-keys';

/* Response shapes of apps/api/src/admin/routes.ts. */

export type AuditEvent = {
  id: number;
  at: number;
  actorType: string;
  actorId: string | null;
  actorEmail: string | null;
  /** The admin acting through an impersonated session, when there was one. */
  impersonator: string | null;
  impersonatorEmail: string | null;
  action: string;
  subjectId: string | null;
  subjectEmail: string | null;
  data: Record<string, unknown>;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string | null;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
};

export type UserList = { total: number; users: (AdminUser & { plan: string })[] };

export type UserDetail = {
  user: AdminUser;
  access: Access;
  accounts: { providerId: string; createdAt: string }[];
  sessions: { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; updatedAt: string; impersonatedBy: string | null }[];
  overrides: { key: string; value: string; expiresAt: number | null; grantedBy: string; reason: string | null }[];
  subscriptions: { provider: string; planId: string; status: string; periodEnd: number | null }[];
  audit: AuditEvent[];
};

export type Overview = {
  users: number;
  newThisWeek: number;
  unverified: number;
  admins: number;
  banned: number;
  signedInNow: number;
  onPaidOrGrantedPlans: Record<string, number>;
  recent: AuditEvent[];
};

export type PlansResponse = {
  catalogue: { key: string; type: 'bool' | 'int' | 'enum'; values?: string[]; fallback: unknown }[];
  plans: { id: string; name: string; public: number; values: Record<string, string> }[];
};

export type AdminApiKey = ApiKey & { revokedAt: number | null };

export type KeyState = 'active' | 'expired' | 'revoked';

export type KeyList = {
  counts: Record<'all' | KeyState, number>;
  total: number;
  keys: (AdminApiKey & { userId: string; email: string | null; ownerName: string | null })[];
};

type Counts = { requests: number; denied: number };

export type UsageSeries = { today: string; groups: string[]; days: (Counts & { day: string; groups: Record<string, Counts> })[] };

export type UsageTop = {
  day: string;
  consumers: (Counts & {
    subjectType: 'anon' | 'user';
    subjectId: string;
    keyId: string;
    bytes: number;
    groups: Record<string, number>;
    email: string | null;
    name: string | null;
    keyPrefix: string | null;
    keyName: string | null;
  })[];
};

export type Job = {
  id: number;
  kind: string;
  runAt: number;
  attempts: number;
  maxAttempts: number;
  lockedUntil: number | null;
  lastError: string | null;
  doneAt: number | null;
  failedAt: number | null;
  createdAt: number;
};

export type BillingOverview = {
  provider: string | null;
  subscriptions: {
    byStatus: { provider: string; status: string; count: number }[];
    recent: { provider: string; providerSubId: string; userId: string; email: string | null; planId: string; status: string; periodEnd: number | null; updatedAt: number }[];
  };
  events: { provider: string; eventId: string; type: string; receivedAt: number; processedAt: number | null; error: string | null }[];
  jobs: { counts: { pending: number; failed: number; done: number }; pending: Job[]; failed: Job[]; recent: Job[] };
};
