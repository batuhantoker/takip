'use client';

import { useEffect } from 'react';
import { readAccountLink, type AccountLink } from '@/lib/platform/account/links';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { showAccountDialog, useAccountDialog, type View } from './account-dialog-state';
import SettingsWindow, { type MapSettings } from '@/components/shell/settings/settings-window';
import CredentialsForm from '@/components/site/account/parts/credentials-form';
import ImpersonationBanner from '@/components/site/account/parts/impersonation-banner';
import ForgotPasswordForm from '@/components/site/account/parts/forgot-password-form';
import NewPasswordForm from '@/components/site/account/parts/new-password-form';
import TwoFactorForm from '@/components/site/account/parts/two-factor-form';

const TITLES = {
  'sign-in': 'Sign in',
  'sign-up': 'Create account',
  forgot: 'Reset password',
  'new-password': 'Choose a new password',
  'two-factor': 'Two-factor check',
} as const;

const EXPIRED = 'That link has expired or was already used.';

/** Better Auth's OAuth callback error codes, in words. */
const SIGN_IN_ERRORS: Record<string, string> = {
  email_not_verified: "Almost there: confirm your email to finish signing in. We've sent you a link.",
  account_not_linked: 'An account with this email already exists. Sign in with its password, or use "Forgot password?" to take it over.',
  email_not_found: "That service didn't share an email address, and an account needs one. Try another option.",
  access_denied: 'Sign-in was cancelled.',
};

/** Errors from connecting a provider in settings. */
const CONNECT_ERRORS: Record<string, string> = {
  email_does_not_match: "That account uses a different email address than this one, so it can't be connected.",
  account_already_linked_to_different_user: 'That account is already connected to someone else.',
  unable_to_link_account: "That service didn't confirm the email address, so it can't be connected.",
  access_denied: 'Connecting was cancelled.',
};

/** Why a deletion link didn't delete anything, by Better Auth's error code. */
const DELETE_ERRORS: Record<string, string> = {
  FAILED_TO_GET_USER_INFO: 'Nothing was deleted: the link only works in a browser signed in to that account. Sign in here, then open the link again.',
  INVALID_TOKEN: 'Nothing was deleted: that link has expired, was already used, or belongs to another account. Ask for a new one under Delete account.',
  subscription_active: 'Nothing was deleted: your subscription is still active. Cancel it first, then ask for a new link under Delete account.',
};

function viewFor(link: AccountLink): View {
  switch (link.kind) {
    case 'verified': return { kind: 'sent', title: 'Email confirmed', body: "You're signed in." };
    case 'verify-failed': return { kind: 'sign-in', notice: `${EXPIRED} Sign in and we'll send a new one.` };
    case 'reset': return { kind: 'new-password', token: link.token };
    case 'reset-failed': return { kind: 'forgot', notice: `${EXPIRED} Ask for a new one below.` };
    case 'sign-in-failed':
      return { kind: 'sign-in', notice: SIGN_IN_ERRORS[link.error] ?? "Signing in didn't work. Try again, or use another option." };
    case 'settings':
      return { kind: 'settings', notice: link.error && (CONNECT_ERRORS[link.error] ?? "Connecting didn't work. Try again.") };
    case 'deleted':
      return {
        kind: 'sent',
        title: 'Account deleted',
        body: 'Your account is gone, with its sign-in methods, devices and API keys. Usage counts and account history stay, without your email address.',
      };
    case 'delete-failed':
      return { kind: 'settings', notice: DELETE_ERRORS[link.error] ?? "Nothing was deleted: that link didn't work. Ask for a new one under Delete account." };
    case 'sign-in':
      return { kind: 'sign-in' };
    case 'sign-up':
      return { kind: 'sign-up' };
  }
}

/** Account settings are a tab of the Settings window, which this shows too. */
type AccountView = Exclude<View, { kind: 'settings' }>;

/**
 * Mount once per page. Opens itself when an emailed link lands here. Carries the impersonation banner and the
 * Settings window, since it is mounted in every map state, phones included; `map` is the page's map state for Settings.
 */
export default function AccountDialog({ map }: { map?: MapSettings }) {
  const view = useAccountDialog();

  useEffect(() => {
    const landed = readAccountLink(window.location.href);
    if (!landed) return;
    window.history.replaceState(window.history.state, '', landed.cleanUrl);
    showAccountDialog(viewFor(landed.link));
  }, []);

  return (
    <>
      <ImpersonationBanner />
      {view && view.kind !== 'settings' && <Dialog view={view} />}
      <SettingsWindow view={view?.kind === 'settings' ? view : null} map={map} />
    </>
  );
}

function Dialog({ view }: { view: AccountView }) {
  const close = () => showAccountDialog(null);
  return (
    <Modal open onClose={close} title={view.kind === 'sent' ? view.title : TITLES[view.kind]} className="max-w-[380px]" bare>
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto border-t border-line">
        <Body view={view} close={close} />
      </div>
    </Modal>
  );
}

function Body({ view, close }: { view: AccountView; close: () => void }) {
  switch (view.kind) {
    case 'sign-in':
      return <CredentialsForm key="sign-in" mode="sign-in" notice={view.notice} />;
    case 'sign-up':
      return <CredentialsForm key="sign-up" mode="sign-up" notice={view.notice} />;
    case 'forgot':
      return <ForgotPasswordForm notice={view.notice} />;
    case 'new-password':
      return <NewPasswordForm token={view.token} />;
    case 'two-factor':
      return <TwoFactorForm />;
    case 'sent':
      return (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-body text-ink-2">{view.body}</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-small text-ink-3">
              Development: without SMTP_URL no mail goes out; the link is printed in the <code className="font-mono">npm run dev</code> terminal.
            </p>
          )}
          <Button variant="primary" className="mt-1 w-full" onClick={close} data-autofocus>Done</Button>
        </div>
      );
  }
}
