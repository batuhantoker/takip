import { createTransport } from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import { smtpSender } from './sender';

describe('smtpSender', () => {
  it('composes the message nodemailer sends', async () => {
    const transporter = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transporter, 'sendMail');
    await smtpSender(transporter, 'TAKIP <no-reply@example.com>').send({ to: 'ada@example.com', subject: 'Hi', text: 'Body' });

    const sent = JSON.parse((await sendMail.mock.results[0].value).message);
    expect(sent).toMatchObject({
      from: { address: 'no-reply@example.com', name: 'TAKIP' },
      to: [{ address: 'ada@example.com' }],
      subject: 'Hi',
      text: 'Body',
    });
  });
});
