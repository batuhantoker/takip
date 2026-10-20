/** better-sqlite3 holds the event loop for a whole statement, so a long read done in slices awaits this between them. */
export const breathe = () => new Promise<void>(resolve => setImmediate(resolve));
