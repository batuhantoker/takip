import type { AppDb } from '../db/app-db';
import type { ReportViewData } from './schemas';

export const REPORT_STATUSES = ['open', 'resolved'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const MAX_USER_AGENT = 500;

type Row = {
  id: number;
  createdAt: number;
  userId: string | null;
  email: string | null;
  message: string;
  view: string;
  userAgent: string | null;
  status: ReportStatus;
  resolvedAt: number | null;
  resolvedBy: string | null;
  resolverEmail: string | null;
};

/** The issue_report table. Reporter and resolver emails come from auth_user, so they go when the account does. */
export function reportStore(db: AppDb) {
  const insert = db.prepare('INSERT INTO issue_report (created_at, user_id, message, view, user_agent) VALUES (?, ?, ?, ?, ?)');
  const statusOf = db.prepare('SELECT status FROM issue_report WHERE report_id = ?').pluck();
  const update = db.prepare('UPDATE issue_report SET status = ?, resolved_at = ?, resolved_by = ? WHERE report_id = ?');
  const counts = db.prepare(`
    SELECT count(*) AS "all", coalesce(sum(status = 'open'), 0) AS open, coalesce(sum(status = 'resolved'), 0) AS resolved FROM issue_report`);
  const rows = (where: string) => db.prepare(`
    SELECT r.report_id AS id, r.created_at AS createdAt, r.user_id AS userId, reporter.email, r.message, r.view,
           r.user_agent AS userAgent, r.status, r.resolved_at AS resolvedAt, r.resolved_by AS resolvedBy, resolver.email AS resolverEmail
    FROM issue_report r
    LEFT JOIN auth_user reporter ON reporter.id = r.user_id
    LEFT JOIN auth_user resolver ON resolver.id = r.resolved_by
    ${where} ORDER BY r.report_id DESC LIMIT ? OFFSET ?`);
  const all = rows('');
  const byStatus = rows('WHERE r.status = ?');

  return {
    add({ userId, message, view, userAgent, at }: { userId: string | null; message: string; view: ReportViewData; userAgent: string | null; at: number }) {
      return Number(insert.run(at, userId, message, JSON.stringify(view), userAgent?.slice(0, MAX_USER_AGENT) || null).lastInsertRowid);
    },

    /** Newest first, with how many there are of each status. */
    list({ status, offset, limit }: { status?: ReportStatus; offset: number; limit: number }) {
      const tally = counts.get() as Record<'all' | ReportStatus, number>;
      const found = (status ? byStatus.all(status, limit, offset) : all.all(limit, offset)) as Row[];
      return {
        counts: tally,
        total: tally[status ?? 'all'],
        reports: found.map(row => ({ ...row, view: JSON.parse(row.view) as ReportViewData })),
      };
    },

    /** The status before, or null when there is no such report. Reopening clears who resolved it. */
    setStatus(id: number, status: ReportStatus, adminId: string, at: number): ReportStatus | null {
      const before = statusOf.get(id) as ReportStatus | undefined;
      if (!before) return null;
      if (before !== status) update.run(status, status === 'resolved' ? at : null, status === 'resolved' ? adminId : null, id);
      return before;
    },
  };
}

export type ReportStore = ReturnType<typeof reportStore>;
