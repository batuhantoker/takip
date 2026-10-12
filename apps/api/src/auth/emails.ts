import type { EmailMessage } from '../mail/sender';

export const APP_NAME = 'TAKIP';
export const LINK_TTL_S = 60 * 60;

export function verificationEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: `Confirm your email for ${APP_NAME}`,
    text: `Open this link to confirm your email address and finish setting up your ${APP_NAME} account:

${url}

The link works for one hour. If you didn't sign up, ignore this email.`,
  };
}

export function resetPasswordEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: `Reset your ${APP_NAME} password`,
    text: `Open this link to choose a new password:

${url}

The link works for one hour. If you didn't ask for this, ignore this email and your password stays the same.`,
  };
}

export function existingAccountEmail(to: string): EmailMessage {
  return {
    to,
    subject: `You already have a ${APP_NAME} account`,
    text: `Someone tried to create a ${APP_NAME} account with this email address, which already has one.

If it was you, sign in instead, or choose "Forgot password?" in the sign-in window to set a new password.

If it wasn't you, ignore this email.`,
  };
}

export function deleteAccountEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: `Confirm deleting your ${APP_NAME} account`,
    text: `Open this link in the browser where you're signed in to ${APP_NAME} to delete your account. This can't be undone:

${url}

The link works for one hour. If you didn't ask for this, someone may have access to your account: change your password.`,
  };
}
