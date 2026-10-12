import { describe, expect, it } from 'vitest';
import { readAccountLink } from './account-links';

const at = (path: string) => readAccountLink(`http://localhost:3000${path}`);

describe('readAccountLink', () => {
  it('ignores ordinary map URLs, including ones with an unrelated token or error', () => {
    expect(at('/')).toBeNull();
    expect(at('/?layers=ships&token=abc&error=x')).toBeNull();
  });

  it('reads a verification landing, and strips only its own params', () => {
    expect(at('/?layers=ships&account=verified#z')).toEqual({ link: { kind: 'verified' }, cleanUrl: '/?layers=ships#z' });
    expect(at('/?account=verified&error=TOKEN_EXPIRED')).toEqual({ link: { kind: 'verify-failed' }, cleanUrl: '/' });
  });

  it('reads a reset landing with its token, or the failure', () => {
    expect(at('/?account=reset-password&token=t0k')).toEqual({ link: { kind: 'reset', token: 't0k' }, cleanUrl: '/' });
    expect(at('/?account=reset-password&error=INVALID_TOKEN')).toEqual({ link: { kind: 'reset-failed' }, cleanUrl: '/' });
    expect(at('/?account=reset-password')).toEqual({ link: { kind: 'reset-failed' }, cleanUrl: '/' });
  });

  it('reads a return to settings, with or without an error', () => {
    expect(at('/?account=settings')).toEqual({ link: { kind: 'settings' }, cleanUrl: '/' });
    expect(at('/?account=settings&error=email_does_not_match')).toEqual({
      link: { kind: 'settings', error: 'email_does_not_match' },
      cleanUrl: '/',
    });
    expect(at('/?account=deleted')).toEqual({ link: { kind: 'deleted' }, cleanUrl: '/' });
    expect(at('/?account=sign-in')).toEqual({ link: { kind: 'sign-in' }, cleanUrl: '/' });
  });

  it('reads a failed social sign-in with its error code', () => {
    expect(at('/?account=sign-in-failed&error=account_not_linked&error_description=x')).toEqual({
      link: { kind: 'sign-in-failed', error: 'account_not_linked' },
      cleanUrl: '/',
    });
  });
});
