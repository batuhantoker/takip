# Privacy: draft text for accounts

_Draft by workstream H, 2026-10-12, against `backend/privacy`. Not live: `/privacy` (`src/app/privacy/page.tsx`) is unchanged and is yours to rewrite. Every `TODO(user)` is a fact or a decision only you can supply. Each statement below was checked against the code; the file is named where it matters._

## Before you publish: what on the current page stops being true

Once accounts launch, these claims on `/privacy` are wrong for anyone who signs up:

- The meta description and the pledge **"No account, ever"**: "There is nothing to sign up for… We do not know who you are."
- **"Your things stay with you"**: "…kept in your own browser… Not on our servers." Account data lives on our server.
- **The short version**: "Clearing this site's data in your browser removes all of it." It doesn't remove an account; deleting the account does.
- **The short version**: "Your address is held only briefly, in memory." A signed-in session keeps the IP address it was created from for the session's life.

Signed-out visitors are still covered by the current text, so the account section can sit beside it rather than replace it. `TODO(user)`: decide the layout.

---

## Your account

You can use the map without an account. An account adds things that have to be kept on our server: a plan, API keys and, later, saved workspaces.

### What we keep, and why

| What | Why | How long |
|---|---|---|
| **Your account:** name, email address, whether you confirmed it, when you joined, and your profile picture's address if a sign-in service gave us one | To recognise you, and to email you about your account | Until you delete the account |
| **Your password,** only as a one-way hash we can't turn back into the password | To check it when you sign in | Until you delete the account or stop using a password |
| **Sign-in services you connected** (Google, GitHub and so on): which service, your ID there, and the access token it gave us | To let you sign in with it | Until you disconnect it or delete the account. `TODO(user)`: we don't use these tokens; see the note at the end |
| **Two-step verification:** whether it's on, its secret and your backup codes, stored encrypted | To ask for a code when you sign in with a password | Until you turn it off or delete the account |
| **Signed-in devices:** when each session started and was last used, the IP address it came from, and the browser's user agent | So you can see your devices in Account settings and sign them out, and to spot misuse | 30 days after the session was last refreshed (refreshed at most once a day), or until you sign out or sign it out elsewhere |
| **Your plan:** which plan, any subscription and its dates, and any change an operator made for you, with their reason | To give you what your plan includes | Until you delete the account |
| **API keys:** each key's name, the first characters you see in settings, its scopes and dates. The key itself is kept only as a one-way hash | To check keys your tools send | Until you delete the key or the account |
| **Usage counts:** how many requests your account (and each key) made per day, to which part of the API, how much data and how many were refused. Not what you searched or looked at | Fair use: daily quotas and rate limits. Your own usage page | 400 days. `TODO(user)`: nothing deletes old counts yet; confirm 400 days and we'll add the clean-up |
| **Account history (audit log):** changes to your account and who made them, e.g. a key created or revoked, a plan granted, a ban, a subscription change, the account deleted | Security and accountability, and to answer you if something went wrong | `TODO(user)`: no retention set. Suggest a period, e.g. 2 years |
| **Billing customer reference** (only if you subscribe): the payment provider's ID for you | To match the provider's updates to your account | Until you delete the account; the provider keeps its own records (see below) |

**Visitors without an account:** usage is counted the same way, but under a code made from your address (for IPv6, your network block), the date, and a random value held only in memory, so the code changes every day and can't be turned back into your address. Kept 35 days. `TODO(user)`: same clean-up note as above. Rate limits hold your address briefly, in memory.

`TODO(user)`: legal bases, if you want them stated (GDPR art. 6, KVKK art. 5). Suggested: the account, plan, keys and sign-in data are needed to provide the service (contract); sessions, usage counts and the audit log are for security and fair use (legitimate interests); billing references are a legal obligation where tax law applies.

### Emails we send

Only about your account: confirming your address, resetting your password, a notice if someone tries to sign up with your address, and confirming a deletion. No newsletters or marketing. `TODO(user)`: confirm, and update this if that changes.

### Who else handles your data

- **Email provider:** sends the emails above. `TODO(user)`: name it once chosen (`SMTP_URL` / `MAIL_FROM`), and where it stores mail.
- **Payment provider,** only if you subscribe: takes your payment details on its own page; we never see your card. It keeps billing records as tax law requires. `TODO(user)`: name it once chosen (Stripe, Paddle, Polar, Lemon Squeezy or iyzico are the candidates) and link its privacy policy. Some of these act as merchant of record; say so if yours does.
- **Sign-in services,** only the ones you use: they tell us your name, email address and ID there when you sign in.
- **Hosting:** `TODO(user)`: where the server and its backups are (country and company), and whether Cloudflare stays in front. Backups of the account database are planned (`docs/architecture/backend.md` §12.2); say how long a deleted account can survive in a backup, e.g. "up to 30 days".

`TODO(user)`: international transfers. If hosting or a provider is outside Turkey or the EU/EEA, GDPR and KVKK both need the transfer named and its safeguard stated.

### Cookies

Only cookies needed to keep you signed in. No analytics, advertising or tracking cookies, so we don't ask for consent.

| Cookie | What it does | How long |
|---|---|---|
| `takip.session_token` | Keeps you signed in | 30 days, renewed as you use the site |
| `takip.session_data` | A signed copy of your session so most pages don't hit the database | 5 minutes |
| `takip.two_factor` | Remembers a sign-in that is waiting for your 2FA code | 10 minutes |
| `takip.state` | Protects a sign-in with Google, GitHub and so on from forgery | 5 minutes |

Over https the names start with `__Secure-`. `TODO(user)`: the `takip` prefix changes with the product name. Better Auth can also set `dont_remember` and `trust_device`, but nothing in the app asks for them today; add them here if a "Keep me signed in" or "Trust this device" choice is added.

### Your rights, and how to use them

- **See and take your data:** Account settings → Your data → **Download my data** gives you everything above in one JSON file, straight away.
- **Correct it:** change your name in Account settings. `TODO(user)`: changing the email address isn't built yet; until it is, say how to ask.
- **Delete it:** Account settings → Delete account. We email a link; opening it in the browser where you're signed in deletes the account at once. This removes your account, password, connected sign-in services, two-step verification, devices, API keys, plan and any operator changes to it, billing references, and pending email links. Two things stay without your email or IP address: usage counts and the account history, tied only to a random account ID that no longer leads to you. If you pay for a subscription, cancel it first: we won't delete the account while it's active.
- **Object, restrict, or ask what we hold** in another form: write to us (below). We answer within one month (GDPR) or 30 days (KVKK). `TODO(user)`: confirm.
- **Complain** to a data protection authority: in Turkey the Personal Data Protection Authority (KVKK, kvkk.gov.tr); in the EU/EEA your country's authority. `TODO(user)`: if you have an EU representative, name it.

### Who is responsible

`TODO(user)`: the data controller ("veri sorumlusu"): name or company, address, and whether it is registered in VERBİS. KVKK needs this in the information notice ("aydınlatma metni"), and a Turkish version of this section.

Contact for privacy questions: `TODO(user)`: an email address you'll read, e.g. privacy@<domain>.

---

## Notes for you, not for the page

- **OAuth tokens:** Better Auth keeps the access and ID tokens a sign-in service returns, in plain text (`auth_account`), and nothing of ours uses them. Turning on `account.encryptOAuthTokens`, or not keeping them, would let the "Sign-in services" row say less. Raised with the backend lead.
- **Retention jobs:** nothing prunes `usage_counter` or `audit_event` yet, and expired sessions are deleted only when Better Auth next sees them. The periods above become true once a clean-up job runs.
- **Billing webhooks:** the raw provider events are kept (`bill_event`) to process each one once. Deletion strips your email address from them; the provider's own IDs stay.
- **Admin accounts:** the account history of an admin includes actions they took on other users. Deleting an admin keeps those rows (without email or IP addresses), so the history stays complete.
