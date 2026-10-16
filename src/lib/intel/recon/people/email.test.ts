import { describe, expect, it } from 'vitest';
import { mailKind, mailProvider, usernameLeads } from './email';
import { emptyFacts } from './facts';

describe('mail provider', () => {
  it('names the provider behind the MX records', () => {
    expect(mailProvider('gmail.com', ['gmail-smtp-in.l.google.com'])).toBe('Gmail');
    expect(mailProvider('acme.org', ['aspmx.l.google.com'])).toBe('Google Workspace');
    expect(mailProvider('acme.org', ['acme-org.mail.protection.outlook.com'])).toBe('Microsoft 365');
    expect(mailProvider('proton.me', ['mail.protonmail.ch'])).toBe('Proton Mail');
    expect(mailProvider('acme.org', ['mx1.acme.org'])).toBe('Its own mail server');
    expect(mailProvider('acme.org', [])).toBeNull();
  });

  it('tells personal, organisation, throwaway and alias addresses apart', () => {
    expect(mailKind('gmail.com', ['x'])).toBe('free');
    expect(mailKind('hotmail.com.tr', ['x'])).toBe('free');
    expect(mailKind('acme.org', ['x'])).toBe('organisation');
    expect(mailKind('mailinator.com', ['x'])).toBe('disposable');
    expect(mailKind('duck.com', ['x'])).toBe('relay');
    expect(mailKind('acme.org', [])).toBe('none');
  });
});

describe('usernameLeads', () => {
  it('suggests the local part, its undotted form, and handles the sources point at', () => {
    const leads = usernameLeads('jane.roe+news@gmail.com', {
      gravatar: { ...emptyFacts('api'), links: ['https://gravatar.com/janeroe'], verified: ['https://github.com/jroe'] },
      github: { users: [{ login: 'jroe', url: 'https://github.com/jroe' }], commits: { total: 3, authors: [{ login: 'jroe', name: 'Jane Roe' }], repos: [] } },
    });
    expect(leads).toEqual([
      { value: 'jane.roe', from: ['the address'] },
      { value: 'janeroe', from: ['the address', 'Gravatar'] },
      { value: 'jroe', from: ['Gravatar → GitHub', 'GitHub account', 'GitHub commits'] },
    ]);
  });
});
