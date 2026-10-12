/**
 * An upstream's error status, answered as is, the way the legacy routes did. The spec lists it as the
 * route's `default` response; the cast only satisfies the typed handler, which knows no open-ended status.
 */
export const upstreamStatus = (status: number) => status as 502;
