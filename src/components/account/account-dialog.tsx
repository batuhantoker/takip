'use client';

import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { readAccountLink, type AccountLink } from '@/lib/account-links';
import { useDismiss } from '@/components/ui/use-dismiss';
import { showAccountDialog, useAccountDialog, type View } from './account-dialog-state';
import CredentialsForm from './credentials-form';
import ForgotPasswordForm from './forgot-password-form';
import NewPasswordForm from './new-password-form';
import TwoFactorForm from './two-factor-form';
import AccountSettings from './settings/account-settings';

const TITLES = {
  'sign-in': 'Sign in',
  'sign-up': 'Create account',
  forgot: 'Reset password',
  'new-password': 'Choose a new password',
  settings: 'Account settings',
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
  }
}

/** Mount once per page. Opens itself when an emailed link lands here. */
export default function AccountDialog() {
  const view = useAccountDialog();

  useEffect(() => {
    const landed = readAccountLink(window.location.href);
    if (!landed) return;
    window.history.replaceState(window.history.state, '', landed.cleanUrl);
    showAccountDialog(viewFor(landed.link));
  }, []);

  return <AnimatePresence>{view && <Panel view={view} />}</AnimatePresence>;
}

function Panel({ view }: { view: View }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = () => showAccountDialog(null);
  useDismiss(true, close, panelRef);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-auto px-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full ${view.kind === 'settings' ? 'max-w-md' : 'max-w-sm'} max-h-[90vh] flex flex-col bg-[#0A0A0A] border border-[var(--border-primary)] shadow-2xl`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)]">
          <h2 id={titleId} className="text-sm text-[var(--text-primary)]">
            {view.kind === 'sent' ? view.title : TITLES[view.kind]}
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="p-1 rounded hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <Body view={view} close={close} />
        </div>
      </div>
    </motion.div>
  );
}

function Body({ view, close }: { view: View; close: () => void }) {
  switch (view.kind) {
    case 'sign-in':
      return <CredentialsForm key="sign-in" mode="sign-in" notice={view.notice} />;
    case 'sign-up':
      return <CredentialsForm key="sign-up" mode="sign-up" />;
    case 'forgot':
      return <ForgotPasswordForm notice={view.notice} />;
    case 'new-password':
      return <NewPasswordForm token={view.token} />;
    case 'settings':
      return <AccountSettings notice={view.notice} />;
    case 'two-factor':
      return <TwoFactorForm />;
    case 'sent':
      return (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[11px] leading-relaxed text-[var(--text-primary)]">{view.body}</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-[10px] text-[var(--text-muted)]">
              Development: without SMTP_URL no mail goes out; the link is printed in the <code>npm run dev</code> terminal.
            </p>
          )}
          <button
            type="button"
            onClick={close}
            className="h-8 text-[11px] font-bold border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/25 transition-colors"
          >
            OK
          </button>
        </div>
      );
  }
}
