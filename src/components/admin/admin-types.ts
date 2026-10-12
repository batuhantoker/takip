import type { Access } from '@takip/core/entitlements';

/* Response shapes of apps/api/src/admin/routes.ts. */

export type AuditEvent = {
  id: number;
  at: number;
  actorType: string;
  actorId: string | null;
  actorEmail: string | null;
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
  sessions: { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; updatedAt: string }[];
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
