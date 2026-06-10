# Platform email audit — 2026-05-28

**Purpose:** Map what email infrastructure exists today in the Infinex platform repo so comms can plan a marketing/announcements channel without breaking transactional flows.

**Read-only audit. No changes made to the platform repo.**

---

## Platform repo location

`/Users/opaque/platform` — `@infinex/platform`, pnpm + Turbo monorepo, Cloudflare Workers backend + React/Vite frontends, Drizzle/PlanetScale (MySQL) for persistence, Inngest for async work.

## Current state

### Provider stack

Two providers are wired in: **Mailjet** (legacy) and **Mailtrap** (current primary). Selection is per-environment via `EMAIL_PROVIDER` env var:

- Schema: `workers/main/src/env.ts:254` — `EMAIL_PROVIDER: z.enum(['mailtrap', 'mailjet'])`
- Production: `workers/main/src/env/prod.ts:46` — `EMAIL_PROVIDER: 'mailtrap'`, `SENDING_DOMAIN: 'app.infinex.xyz'`
- Staging: `workers/main/src/env/staging.ts:49` — `EMAIL_PROVIDER: 'mailtrap'`, `SENDING_DOMAIN: 'app.staging.infinex.xyz'`
- Dev: `workers/main/src/env/dev.ts:58` — `SENDING_DOMAIN: 'app.dev.infinex.xyz'`

Switch dates from git log: Mailtrap added 2023-ish via PR #4645 (`PROD-152: Add support for Mailtrap as email provider`), switched to primary via PR #4830 (`PROD-146: Switch to Mailtrap as main email provider`). Mailjet credentials remain provisioned in `.prod.vars.template` as a fallback. The provider abstraction is clean — both implement the same `EmailDeliveryService` interface (`packages/emails/src/types/types.ts:17`).

Provider clients:

- Mailjet: `packages/emails/src/services/delivery/mailjet/index.ts` — REST POST to `https://api.mailjet.com/v3.1/send` (line 72); SDK avoided because it ships Axios which doesn't run on CF Workers (line 1).
- Mailtrap: `packages/emails/src/services/delivery/mailtrap/index.ts` — REST POST to `https://send.api.mailtrap.io/api/send` by default; prod routes through an internal proxy at `https://proxy.srv.infinex.app/mailtrap` (set via `MAILTRAP_BASE_URL` in `prod.ts:49`).

### Sending pipeline

```
caller (tRPC route, durable object, inngest fn)
  -> getTransactionalEmailRenderers()  (workers/main/src/lib_v2/emails/index.ts:11)
  -> RPC to platform-worker-emails sub-worker  (workers/emails/src/worker/entrypoints/email-renderer/rpc-target.ts)
  -> render React Email -> {htmlPart, textPart}
  -> back to caller
  -> queueSendEmail(email, userId)  (workers/main/src/lib_v2/emails/index.ts:29)
  -> Inngest event 'platform/send-email'
  -> sendEmailHandler OR sendHighPriorityEmailHandler  (workers/main/src/inngest/functions/emails/sendEmail.ts)
  -> canEmailBeDelivered() suppression check + MX-record check
  -> Mailtrap/Mailjet API
```

Renderer lives in a separate Cloudflare Worker (`workers/emails`) to keep React Email + render bundle out of the main worker (rationale in `workers/emails/README.md:6-8`). RPC binding via `EMAIL_RENDERER_RPC` (`workers/main/src/env.ts:46`).

Throttling is per-category at the Inngest layer (`sendEmail.ts:46-53` — 10/min per category, max 10 concurrent for default priority; 30/min, 10 concurrent for high priority).

### Sender identity (single sender, single domain)

**Every transactional email today ships from the same sender.** Defined in one place:

`packages/emails/src/templates/_shared/render.ts:6-9`:

```ts
export const notificationsSender: Pick<Email, 'fromUser' | 'fromName'> = {
  fromUser: 'security',
  fromName: 'Infinex Notifications',
};
```

Combined with `SENDING_DOMAIN`, prod sender is `security@app.infinex.xyz` displayed as "Infinex Notifications" — verified via grep: all 8 template renderers spread `...notificationsSender` (search hits at `packages/emails/src/templates/emails/*/`*`-render.ts:15-17`).

The provider builds the full From address inline: `fromAddress = ${fromUser}@${this.sendingDomain}` (mailjet `index.ts:43`, mailtrap `index.ts:40`).

### Email categories shipped today (8 transactional, 0 marketing)

All categories use the `security@app.infinex.xyz / Infinex Notifications` sender; all use `app.infinex.xyz` as the sending domain in prod.

| Category | Template | Subject | Trigger | Priority |
|---|---|---|---|---|
| `verification` | `VerifyYourEmailAddress-render.ts:21` | "Verify your email address" | `workers/main/src/trpc/routes/user/updateUserEmail.ts:41` (user changes email) | `high` |
| `sendFunds` | `SentFunds-render.ts:19` | "You've sent funds to a new address" | `workers/main/src/trpc/utils/send.ts:603-605` (new-recipient send) | normal |
| `newAddress` | `NewContactAdded-render.ts:19` | "New address added" | new contact added flow | normal |
| `confirmedPasskey` | `passkey/PasskeyConfirmed-render.ts:21` | (passkey confirmed) | `workers/main/src/lib_v2/passkeys/passkeyCooldown.ts:157-159` (24h auto-confirm) | normal |
| `deletePasskey` | `passkey/PasskeyDeleted-render.ts:19` | (passkey deleted) | `workers/main/src/trpc_v2/routers/auth/passkeys/removePasskey.ts:134-136` | normal |
| `addPasskey` | `passkey/PasskeyCooldown-render.ts:18` | (passkey cooldown notice) | `passkeyCooldown.ts:130-132` (24h cooldown started) | normal |
| `addTotp` | `totp/TotpAdded-render.ts:19` | (TOTP added) | `workers/main/src/trpc/routes/totp/enrolTotp.ts:153-154` | normal |
| `changeTotp` | `totp/TotpChanged-render.ts:21` | (TOTP changed) | TOTP change flow | normal |

**No marketing, no newsletters, no announcements, no balance/price alerts.** Confirmed by grep across `packages/emails`, `workers/emails`, `workers/main/src/inngest/functions/emails` — zero matches for `marketing|promotional|newsletter|announcement`.

### Template stack

**React Email** (`@react-email/components`, `@react-email/render`, both in `packages/emails/package.json:26-27`). Dev server via `react-email` (line 39) — `pnpm dev:email` runs `email dev --port 3101 --dir src/templates/emails`.

Layout:

- `packages/emails/src/templates/emails/` — one folder per category (`passkey/`, `totp/`) or flat `.tsx`+`-render.ts` pair for top-level emails.
- Per template: a `.tsx` (React Email component), `-render.ts` (returns the `Email` envelope with `fromUser`/`fromName`/`subject`/`category`/`priority`), `-render.test.ts` (snapshot test), and `__snapshots__/*.html.snapshot`.
- Shared chrome: `_shared/components/Parent.tsx` (HTML shell, Helvetica font, dark body `#17191C`), `_shared/components/Footer.tsx` (logo + Governance/Legals links + tagline "The safest way to get onchain").
- Output via `_shared/render.ts:11-18` — single `render()` produces both `htmlPart` and `textPart` (`plainText: true`).

Email-client compatibility process documented in `packages/emails/README.md` — they use SendForensics for client previews and pay special attention to Outlook 2019/Win10 Mail. Templates lean on React Email's `<Section>/<Column>/<Row>` which compile to `<table>` for 1999-era client compat.

### List management — **none**

There is no subscription / opt-in / preferences model in the schema. Verified by grep across `packages/db/src/`:

- `packages/db/src/schema.ts:124-126` — user table has `email`, `emailVerified` only.
- `packages/db/src/schema.ts:164` — `turnkeyRecoveryEmail` (recovery-flow only).
- No `emailPreferences`, `notificationPreferences`, `emailSubscription`, or per-category opt-in table exists.

The only email-state table is the suppression list:

`packages/db/src/schema.ts:1593-1606`:

```ts
export const undeliverableEmailAddress = mysqlTable(
  'undeliverable_email_address',
  {
    id: uuid('id').primaryKey(),
    emailAddress: varchar('email_address', { length: 150 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    reason: varchar('reason', { length: 4000 }).notNull(),
    ...
    emailAddressUnique: unique('email_address_unique').on(table.emailAddress),
  }
);
```

Checked before every send: `workers/main/src/lib_v2/emails/index.ts:39-54` — `canEmailBeDelivered(db, email)` returns `false` if the address is in the table, and the Inngest handler throws `NonRetriableError('Email cannot be delivered!')` (`sendEmail.ts:62`).

Populated only by the Mailtrap webhook on **hard bounces** — `workers/main/src/inngest/functions/emails/mailtrapWebhook.ts:83-105`. Other events (open, click, unsubscribe, spam, soft bounce) are received but not acted on (`mailtrapWebhook.ts:13-23` — schema accepts them; only `event === 'bounce'` writes to DB on line 83). Mailjet has no equivalent webhook wired up; the table's `provider` column is hard-coded to `'mailtrap'` on inserts (line 100).

### Unsubscribe handling — **none**

- No `List-Unsubscribe` header emitted anywhere. Grep across the full repo: zero matches for `List-Unsubscribe` in TS/TSX (the `unsubscribe` hits are all React/TradingView observer-pattern calls).
- No per-category opt-out mechanism. The Mailtrap webhook accepts `unsubscribe` events in its enum (`mailtrapWebhookSchema:17`) but the handler filters only for `bounce` (`mailtrapWebhook.ts:83-85`) — unsubscribe events are received and dropped.
- The footer has a TODO for a preferences page but no link: `packages/emails/src/templates/_shared/components/Footer.tsx:29-30`:

```tsx
// TODO: link to to-be-implemented in-app settings page
//   { text: 'Preferences', href: '#' },
```

This is fine for transactional (which under CAN-SPAM / CASL / GDPR is "necessary" service mail and arguably doesn't need an unsubscribe), but it is **disqualifying** for any marketing send — see Gmail/Yahoo bulk-sender requirements (RFC 8058 one-click unsubscribe mandatory at >5k/day since Feb 2024).

### Mailtrap streams: `transactional` vs `bulk`

The webhook schema knows about two sending streams: `mailtrapWebhook.ts:25` — `sending_stream: z.enum(['transactional', 'bulk'])`. Mailtrap itself separates transactional and bulk sending under different reputation pools. **All current sends go through the default (transactional) stream** — there's no code path that selects the bulk stream when calling Mailtrap's API (`mailtrap/index.ts:45-60` requestBody has no `sending_stream` field).

### MX-record gating

Every send checks MX records for the recipient domain before delivering: `sendEmail.ts:66-82` — `checkDomainHasMxRecord(domain)` from `@infinex/dns-utils`; missing record throws `NonRetriableError('No MX record for domain')`. Cheap deliverability hygiene that's nice to keep for marketing too.

### In-flight evolution

`git log --since=2024-12-01 -- packages/emails workers/emails workers/main/src/inngest/functions/emails` and grep for `mailtrap|mailjet`:

- Most recent meaningful email changes: 2024 — `feat: check email domain mx record before sending email` (#10374), `Async, queued and throttled email sending` (#6147 — added Inngest pipeline), `Switch to Mailtrap as main email provider` (#4830). Nothing pending or in-flight on the email-infra layer.
- TODOs in code: only the two in `Footer.tsx:29` (preferences link) and `Footer.tsx:46` (move email images off public website to a storage service).
- The email package is **stable, untouched for months, well-tested** (snapshot tests on every template + delivery-service unit tests).

## Email category map

| Category | Sender | Display | Template path | Trigger | Opt-out path | Stream |
|---|---|---|---|---|---|---|
| `verification` | `security@app.infinex.xyz` | Infinex Notifications | `packages/emails/src/templates/emails/VerifyYourEmailAddress.tsx` | trpc `user/updateUserEmail` | none (transactional, required) | default/transactional |
| `sendFunds` | same | same | `packages/emails/src/templates/emails/SentFunds.tsx` | trpc `send` flow on new recipient | none | default |
| `newAddress` | same | same | `packages/emails/src/templates/emails/NewContactAdded.tsx` | contact-added flow | none | default |
| `confirmedPasskey` | same | same | `packages/emails/src/templates/emails/passkey/PasskeyConfirmed.tsx` | passkey 24h auto-confirm | none | default |
| `deletePasskey` | same | same | `packages/emails/src/templates/emails/passkey/PasskeyDeleted.tsx` | passkey removed | none | default |
| `addPasskey` | same | same | `packages/emails/src/templates/emails/passkey/PasskeyCooldown.tsx` | new passkey cooldown start | none | default |
| `addTotp` | same | same | `packages/emails/src/templates/emails/totp/TotpAdded.tsx` | TOTP enrolment | none | default |
| `changeTotp` | same | same | `packages/emails/src/templates/emails/totp/TotpChanged.tsx` | TOTP change | none | default |

All 8 categories are pure security/transactional. Reputation on `security@app.infinex.xyz / app.infinex.xyz` is therefore a transactional-only reputation today — every message it sends is high-intent, expected, and bounce-policed.

## Gaps for adding a marketing channel

Adding marketing/announcement emails to the current stack without breaking transactional deliverability requires action across six axes. Ordered by criticality:

1. **Use a distinct sending subdomain (deliverability isolation).** Marketing mail bounces, spam complaints, and engagement metrics WILL be worse than transactional. If they share `app.infinex.xyz`, a marketing campaign that pulls spam complaints poisons login OTP / passkey / withdrawal-confirmation deliverability. Recommended: dedicated subdomain like `news.infinex.xyz` or `updates.infinex.xyz` (NOT a subdomain of `app.infinex.xyz` so reputation is fully partitioned), with its own SPF/DKIM/DMARC records. Plumb a second `MARKETING_SENDING_DOMAIN` env var (mirror of `SENDING_DOMAIN` at `workers/main/src/env.ts:256`) and a second sender identity beside `notificationsSender` at `packages/emails/src/templates/_shared/render.ts:6`.

2. **Use Mailtrap's `bulk` stream (or a separate ESP entirely).** Mailtrap supports a `bulk` stream with separate reputation from `transactional` (already known to the codebase per `mailtrapWebhook.ts:25`). At minimum: add a `stream: 'transactional' | 'bulk'` field to the `Email` type at `packages/emails/src/types/types.ts:5-15`, plumb it through to the Mailtrap request body at `mailtrap/index.ts:45-60`. Stronger option: use a marketing-specific ESP (Customer.io, Loops, Resend's broadcasts, etc.) — sender reputation, list management, and unsubscribe UX are all native there, and you avoid mixing the two surfaces under one vendor risk.

3. **Build a subscription / preferences model.** Today there is no per-user opt-in state at all. Marketing requires per-category opt-in/opt-out at minimum (think: product updates, security advisories, governance, fee/yield announcements). Add a new table near `undeliverableEmailAddress` at `packages/db/src/schema.ts:1593` — something like `userEmailPreferences { userId, category, status, updatedAt }` with status enum `subscribed | unsubscribed`. Default to opt-in only for categories the user actively signed up for; default opt-out for everything else. Wire the consult into a new `canMarketingEmailBeDelivered(db, userId, category)` next to `canEmailBeDelivered` at `lib_v2/emails/index.ts:39`, and call it from a new `sendMarketingEmailHandler` Inngest function (don't reuse the existing transactional handler — different throttle, different stream, different bounce policy).

4. **Implement RFC 8058 one-click unsubscribe.** Gmail and Yahoo require `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers on any sender doing >5k/day to their domains (in force since Feb 2024). Today: zero `List-Unsubscribe` headers anywhere (verified by grep). Add to the `Email` type, then add to both provider request bodies — Mailjet via the `Headers` field in their v3.1 schema, Mailtrap via their `headers` field. Also wire a public `/unsubscribe?token=...` route to flip the preference in step 3 without auth, and handle Mailtrap's `unsubscribe` webhook event at `mailtrapWebhook.ts:83` (currently dropped — only `bounce` is written to DB).

5. **Honor Mailtrap webhook events beyond bounce.** Today only `event === 'bounce'` writes to `undeliverableEmailAddress` (`mailtrapWebhook.ts:83-105`). For marketing, also honor `spam` (definite suppress), `unsubscribe` (suppress for that category), and consider tracking `open`/`click` for campaign analytics. Note that the existing suppression table is a global address suppression — marketing needs per-category suppression, so don't reuse this table without partitioning.

6. **Don't auto-route through the existing `sendEmailHandler`.** The current `platform/send-email` event has no notion of marketing-vs-transactional and the throttle is `limit: 10, period: '1m', key: 'event.data.email.category'` (`sendEmail.ts:46-53`) — 10 emails per minute per category, far too slow for a campaign blast. Add a separate `platform/send-marketing-email` event with batched-send semantics (or hand off entirely to an ESP that handles batching natively).

Two minor things to **preserve as-is** when extending:

- Keep the MX-record check (`sendEmail.ts:66-82`) on marketing too — cheap hygiene.
- Keep the provider abstraction (`EmailDeliveryService` interface at `packages/emails/src/types/types.ts:17`). It's clean and a marketing ESP can be slotted in as a third implementation alongside Mailjet/Mailtrap without touching call sites.

One **trap to flag**: prod is currently routing through an internal proxy at `https://proxy.srv.infinex.app/mailtrap` (`prod.ts:49`). If you add a second ESP for marketing, decide upfront whether it also goes through this proxy or hits the vendor directly — has implications for IP allowlists, latency, and ops visibility.
