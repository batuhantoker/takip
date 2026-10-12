import type { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Development: prints each message, so its link can be opened from the terminal. */
export const consoleSender: EmailSender = {
  async send({ to, subject, text }) {
    console.log(`\n[email] to ${to} — ${subject}\n${text}\n`);
  },
};

export function smtpSender(transporter: Transporter, from: string): EmailSender {
  return {
    async send({ to, subject, text }) {
      await transporter.sendMail({ from, to, subject, text });
    },
  };
}
