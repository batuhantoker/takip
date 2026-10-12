import type { DocRole, DocStore, DocTarget, DocumentInput, DocumentRow } from '../history-stores';
import type { Db } from '../open';
import { statements } from './statements';

/** history.db documents: citations now, articles and media later. */
export class SqliteDocStore implements DocStore {
  private readonly sql: ReturnType<typeof statements>;

  constructor(readonly db: Db) {
    this.sql = statements(db);
  }

  upsertDocument(d: DocumentInput, now = Date.now()) {
    return this.sql(`
      INSERT INTO doc_document (kind, source_id, dataset_id, source_record_id, url, title, summary, lang, published_at, retrieved_at, attrs)
      VALUES (@kind, @sourceId, @datasetId, @sourceRecordId, @url, @title, @summary, @lang, @publishedAt, @now, @attrs)
      ON CONFLICT (source_id, source_record_id) DO UPDATE SET kind = excluded.kind, dataset_id = excluded.dataset_id, url = excluded.url,
        title = excluded.title, summary = excluded.summary, lang = excluded.lang, published_at = excluded.published_at, attrs = excluded.attrs
      RETURNING doc_id
    `).pluck().get({
      kind: d.kind,
      sourceId: d.sourceId,
      datasetId: d.datasetId,
      sourceRecordId: d.sourceRecordId,
      url: d.url ?? null,
      title: d.title ?? null,
      summary: d.summary ?? null,
      lang: d.lang ?? null,
      publishedAt: d.publishedAt ?? null,
      now,
      attrs: JSON.stringify(d.attrs ?? {}),
    }) as number;
  }

  link(docId: number, targetType: DocTarget, targetId: number, role: DocRole, confidence = 1) {
    this.sql(`
      INSERT INTO doc_document_link (doc_id, target_type, target_id, role, confidence) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET confidence = excluded.confidence
    `).run(docId, targetType, targetId, role, confidence);
  }

  docsFor(targetType: DocTarget, targetId: number, sourceIds: ReadonlySet<number>) {
    const rows = this.sql(`
      SELECT d.doc_id AS docId, d.kind, d.source_id AS sourceId, d.url, d.title, d.summary, d.published_at AS publishedAt, l.role, d.attrs
      FROM doc_document_link l JOIN doc_document d USING (doc_id)
      WHERE l.target_type = ? AND l.target_id = ? AND d.source_id IN (SELECT value FROM json_each(?))
      ORDER BY d.published_at DESC NULLS LAST, d.doc_id
    `).all(targetType, targetId, JSON.stringify([...sourceIds])) as (Omit<DocumentRow, 'attrs'> & { attrs: string })[];
    return rows.map(r => ({ ...r, attrs: JSON.parse(r.attrs) }));
  }
}
