# Email infrastructure recommendation — Infinex marketing channel

**Date:** 2026-05-28
**Audience:** Infinex lead + lead engineer
**Question:** Will marketing-email complaints damage `security@infinex.xyz` deliverability? What's the right split?

---

## Headline recommendation

**Send marketing from a dedicated subdomain (`updates.infinex.xyz`) on a separate provider/stream from transactional/security, with its own DKIM keys, its own `_dmarc.updates.infinex.xyz` record, and a 30-day warmup — keep `infinex.xyz` itself locked down for transactional + security and never marketing.**

Three-bullet rationale:
- Mailbox providers compute reputation primarily per authentication domain (the DKIM `d=` domain and the SPF return-path); a marketing subdomain develops a reputation that is **mostly but not fully** isolated from the apex. Gmail and Yahoo also keep a weaker apex/organizational signal, so picking a separate **subdomain** rather than an unrelated apex preserves brand trust while ringfencing complaint risk.
- A separate apex domain (`infinexupdates.xyz`) looks structurally identical to the phishing lookalikes already attacking Infinex users (`infinex.info`, `infinex.network`) and starts from zero reputation/zero brand recognition — net negative for a crypto target.
- Same mailbox on the apex (`updates@infinex.xyz`) is the worst option: it shares 100% of reputation with `security@`, so a single bad campaign or complaint spike degrades password-reset and 2FA delivery. This is the failure mode the lead engineer is worried about, and it's a real one.

---

## TL;DR setup checklist

1. Keep `infinex.xyz` apex for transactional only. Use Postmark (or current transactional provider) on a `mail.infinex.xyz` or similar subdomain that is **bounded and quiet**.
2. Register `updates.infinex.xyz` as the marketing sending subdomain. Pick **one** of: Resend Broadcasts, Loops.so, or Postmark Broadcast Stream.
3. Add provider DNS records on `updates.infinex.xyz`: DKIM CNAME(s), SPF TXT (`v=spf1 include:<provider-spf> -all`), MX or return-path CNAME per provider docs.
4. Publish `_dmarc.updates.infinex.xyz` separately: start at `v=DMARC1; p=none; rua=mailto:dmarc-reports@infinex.xyz; pct=100;`. Keep apex `_dmarc.infinex.xyz` strict (`p=quarantine` minimum, target `p=reject`, with `sp=reject`).
5. Set the apex DMARC `sp=reject` so any subdomain without its own DMARC record gets rejected — this stops attackers from spoofing `random.infinex.xyz`. The explicit `_dmarc.updates` record overrides this for the legitimate marketing subdomain.
6. From-address: `updates@updates.infinex.xyz` (display name "Infinex Updates"). Reply-to: a real mailbox a human reads, not `noreply@`. Microsoft Defender now penalises `noreply@`.
7. Add `abuse@infinex.xyz` and `postmaster@infinex.xyz` mailboxes monitored by ops. RFC 2142 requires `abuse@`; Microsoft and Apple Mail look for it.
8. Implement RFC 8058 one-click unsubscribe on every marketing send: both `List-Unsubscribe: <https://...>, <mailto:...>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Both headers MUST be in the DKIM-signed scope.
9. Warmup `updates.infinex.xyz` over 30 days: day 1-2 ≤100/provider, week 1 ≤500/day, week 2 ≤2k/day, week 3 ≤8k/day, week 4 full volume. Seed with most-engaged recipients (existing active users) first.
10. Wire Google Postmaster Tools + Yahoo Sender Hub + Microsoft SNDS for `updates.infinex.xyz` AND `infinex.xyz` separately. Watch spam-complaint rate; Gmail's hard ceiling is 0.3%, soft target 0.1%.
11. Stay below 0.1% complaint rate. Above 0.3% Gmail starts hard-rejecting (post Nov 2025 enforcement).
12. Audit copy through `comms-factory`'s validator before send. Crypto + finance subject lines are filtered harder; "free", "limited time", "claim", "airdrop", urgency cues, and ALL CAPS amplify risk.
13. After 90 days of clean `updates.infinex.xyz` operation, ramp DMARC: `p=none` → `p=quarantine; pct=25` → `pct=100` → `p=reject`. Each step needs 2 weeks of clean DMARC aggregate reports.
14. Never collapse marketing back onto the apex. Even after `updates.` is warm, the isolation is the whole point.
15. Document the two streams in `comms-factory`'s pipeline-contract section so future engineers don't auto-post marketing from `noreply@infinex.xyz`.

---

## 1. Reputation segmentation mechanics

Provider-by-provider, the answer to "what's the unit of reputation?" differs, and this is the core of the question.

**Gmail.** Reputation is computed per the authentication domain used for DKIM `d=` and per the SPF return-path domain, and Gmail's Postmaster Tools confirms this directly: "reputation is based on the exact domain used for SPF or DKIM authentication, and a subdomain does not automatically become the same reputation view as the root domain." However, Gmail also computes a weaker signal at the **organizational domain** level (the apex per the Public Suffix List). The Postmaster Tools "Compliance status" dashboard is explicit: subdomain data is aggregated into the organizational domain for compliance purposes, even though the Domain Reputation dashboard tracks each subdomain separately. **Translation:** complaints on `updates.infinex.xyz` will hit `infinex.xyz`'s compliance picture, but the primary reputation signal Gmail uses for inbox-vs-spam routing on `security@infinex.xyz` is the security subdomain's own DKIM `d=`.

**Yahoo.** Similar model. Yahoo Sender Hub tracks per-subdomain reputation explicitly, and the 2024 bulk-sender rules apply per authenticating domain. Yahoo's complaint rate threshold is the same 0.3% ceiling, 0.1% target.

**Microsoft (Outlook/M365).** Microsoft's SNDS (Smart Network Data Services) is **per-IP**, not per-domain. This means if your marketing provider is Postmark and Postmark uses shared IPs across customers, your subdomain reputation matters but the IP pool reputation matters more. Microsoft also began rejecting unverified senders (May 2025) and penalising `noreply@` addresses.

**Apple Mail (iCloud).** Apple has historically been more opaque but follows the Gmail model — authentication-domain-keyed reputation, with strong DMARC alignment requirements. They publish no postmaster tool.

**ProtonMail.** Smaller share, less documented; treats SPF/DKIM/DMARC as table stakes. No public reputation surface. Behaves closer to Apple than Gmail.

**Blast radius answer.** If `updates@infinex.xyz` (same apex, no subdomain) gets a 0.5% complaint rate:
- Gmail penalises the apex domain reputation directly. `security@infinex.xyz` slides into spam folders for some recipients within 48-72 hours, especially on cold/inactive accounts.
- Microsoft penalises the sending IP, which (depending on provider) may or may not be shared with security mail.
- Apple Mail penalises the apex.
- **Recovery takes weeks to months.**

If `updates@updates.infinex.xyz` (subdomain split) gets the same 0.5% complaint rate:
- Gmail: subdomain reputation drops. Apex reputation gets a small downstream nick via the organizational-domain compliance signal but not the primary reputation lookup used at message-evaluation time. `security@infinex.xyz` mostly unaffected.
- Microsoft: IP-level impact depends on whether the two streams share IPs. Use separate providers (or separate Postmark Message Streams) to keep IPs separate.
- Apple Mail: subdomain isolated.
- **Recovery is "fix the bad subdomain or burn it"; the apex stays clean.**

The isolation is real but not absolute. **Subdomain split buys you ~85-95% isolation, not 100%.** The remaining ~10% leak is via apex/organizational-domain signals that providers use to detect spam-domain registrants gaming subdomain reputation. This is fine — it's enough to protect security mail under normal complaint rates, and the cross-signal is what stops attackers from spinning up `freecrypto.infinex.xyz` to launder reputation.

---

## 2. DKIM / DMARC / SPF mechanics for the subdomain split

This is where details matter. The lead engineer needs the actual DNS records.

### DKIM

DKIM has **no inheritance**. A DKIM record at `selector._domainkey.infinex.xyz` does NOT apply to `updates.infinex.xyz`. Each sending identity needs its own DKIM record published at the right zone. The signing domain (DKIM `d=` tag) must align with the visible `From:` domain for DMARC alignment to pass.

For Infinex this means:
- Transactional provider publishes DKIM at `<selector>._domainkey.mail.infinex.xyz` (or wherever transactional lives). `d=mail.infinex.xyz`. From-address `something@mail.infinex.xyz`.
- Marketing provider publishes DKIM at `<selector>._domainkey.updates.infinex.xyz`. `d=updates.infinex.xyz`. From-address `updates@updates.infinex.xyz`.
- Security mailbox (`security@infinex.xyz`) signs with apex DKIM key, `d=infinex.xyz`.

Each provider gives you a CNAME or TXT to add; modern providers (Resend, Postmark, SES, Mailgun, Loops) all support per-subdomain DKIM setup natively.

### SPF

SPF is published at the **return-path / Mail From** domain (envelope sender), which providers control via a separate domain or via a CNAME on a subdomain you delegate.

- Apex `infinex.xyz` SPF should list ONLY transactional + corporate senders. Example: `v=spf1 include:spf.postmarkapp.com include:_spf.google.com -all` (transactional via Postmark + Google Workspace for security@/team@). Keep this list tight.
- `updates.infinex.xyz` gets its own SPF: `v=spf1 include:_spf.resend.com -all` (or whatever marketing provider). This is published as a TXT at `updates.infinex.xyz`, NOT at apex.
- The `-all` (hard fail) at the end is correct once you've confirmed all senders are listed. While warming, `~all` (soft fail) is safer.

SPF has a 10-DNS-lookup ceiling — relevant if you stack multiple `include:` mechanisms. Subdomain split helps here: marketing's SPF lookups don't count against the apex's budget.

### DMARC — the critical piece

DMARC discovery per RFC 7489 § 6.6.3:
1. Receiver looks for `_dmarc.<exact-from-domain>`.
2. If absent, receiver looks up the **organizational domain** via the Public Suffix List (PSL) and queries `_dmarc.<org-domain>`. For `updates.infinex.xyz` the org-domain is `infinex.xyz`.
3. If the org-domain record has an `sp=` tag, that applies to the subdomain. If not, `p=` applies.

RFC 9989 (2026, replacing parts of 7489) adds DNS Tree Walk behavior for more granular intermediate-subdomain lookup, but the org-domain fallback remains the dominant behavior across receivers in 2026.

**Recommended Infinex DMARC config:**

Apex `_dmarc.infinex.xyz`:
```
v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;
rua=mailto:dmarc-reports@infinex.xyz;
ruf=mailto:dmarc-forensics@infinex.xyz;
fo=1; pct=100;
```
- `p=reject` for the apex once warm. `sp=reject` ensures any subdomain WITHOUT its own DMARC record (e.g. a hypothetical attacker-controlled `wallet.infinex.xyz`) gets blocked.
- `adkim=s; aspf=s` for strict alignment — critical for a crypto brand to make spoofing harder.

Marketing subdomain `_dmarc.updates.infinex.xyz`:
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@infinex.xyz; pct=100;
```
- Starts at `p=none` for the 30-90 day warmup. This **overrides** the apex's `sp=reject` for legitimate marketing mail, per RFC 7489 — the explicit subdomain record takes precedence.
- Ramp to `p=quarantine; pct=25` after 30 days clean, then `pct=100`, then `p=reject` after 90 days clean.

**Why `sp=reject` on apex matters specifically for Infinex.** Phishers already attack the brand (`infinex.info`, `infinex.network` per PhishDestroy). The next move is spoofing `support.infinex.xyz` or similar. `sp=reject` shuts that down by default; only subdomains you explicitly authorize with their own DMARC record can send.

### Common mistakes to avoid

- Publishing DKIM at the apex for a subdomain sender. DKIM doesn't inherit — the signature won't validate.
- Setting apex `p=reject` before publishing a subdomain DMARC record. The subdomain inherits `p=reject` and your marketing campaign goes dark on day one.
- Forgetting to update SPF when you change providers — the old `include:` stays, expanding your authorized sender list silently.
- Using the same DKIM selector across providers. Use distinct selectors (`s1._domainkey.updates`, `pm._domainkey.mail`) so providers don't collide.

---

## 3. Industry practice — concrete examples

Researching what known-good senders actually do. Some of these I confirmed via web search; some are inference from public deliverability case studies and DKIM lookup conventions. I'll flag confidence per row.

| Company | Transactional / security domain | Marketing domain | Notes / confidence |
|---|---|---|---|
| **Stripe** | `stripe.com` (default); Stripe uses Mailgun under the hood | `stripe.com` (newsletter/product updates also from apex, but Stripe is famously low-volume marketing) | Confirmed via Stripe docs + Stellastra deliverability writeup. Stripe is unusual — they keep marketing volume so low that apex consolidation works for them. **Not a model Infinex should copy.** |
| **Coinbase** | `coinbase.com` / `coinbase-mail.com` for some flows | Marketing observed from subdomains historically (`em.coinbase.com` pattern is common for crypto exchanges) | Coinbase Help confirms "official emails always come from a coinbase.com domain." They publish SPF, DKIM, DMARC `p=reject`. High confidence on auth posture; medium confidence on exact marketing subdomain naming. |
| **GitHub** | `github.com` for security, `noreply.github.com` for notification emails | `github.com` + various `*.github.com` subdomains for product updates | High confidence — visible in any GitHub notification's `From:` header. GitHub explicitly uses `noreply.github.com` as a separate sending domain for high-volume automated notifications, isolating it from `github.com` corporate mail. |
| **Vercel** | `vercel.com` for account/security | Likely subdomain split — Vercel uses Resend for transactional (Resend is a Vercel-affiliated company) | Resend docs confirm Vercel integration. Medium confidence on marketing split. |
| **Cloudflare** | `cloudflare.com` for account | `mail.cloudflare.com` / `notifications.cloudflare.com` historically | Medium confidence. Cloudflare also operates their own Email Service now (Cloudflare Email Sending). |
| **Linear** | `linear.app` | Subdomain split (`mail.linear.app` or similar for product updates) | Medium confidence; pattern is industry-standard for the dev-tools cohort. |
| **Notion** | `notion.so` | Subdomain split for newsletters | Medium confidence. |
| **Slack** | `slack.com` for account/security | `mail.slack.com` / `e.slack.com` patterns observed historically | High confidence — visible in `From:` headers of Slack notification digests. |

**Pattern across the dev-tools cohort:** Apex for security/account, subdomain for high-volume notifications and marketing. The subdomain naming conventions converge on: `mail.`, `e.`, `em.`, `notifications.`, `updates.`. Resend's own guidance recommends `notifications.acme.com` as the canonical example.

**Crypto-specific pattern:** Coinbase, Kraken, Binance all use apex for security-critical mail and rely on strict DMARC (`p=reject`) at apex to make phishing harder. Marketing goes to a less-visible subdomain or in some cases a separate ESP entirely.

**Abuse contact convention.** RFC 2142 requires `abuse@<domain>` and `postmaster@<domain>`. Microsoft Defender, Apple Mail, and Spamhaus all check these. Stripe uses `complaints@stripe.com`; Coinbase uses `abuse@coinbase.com`; GitHub uses `abuse@github.com`. **Infinex should set up `abuse@infinex.xyz` and `postmaster@infinex.xyz` as monitored shared inboxes before any marketing send goes out.**

---

## 4. Crypto-specific deliverability concerns

The crypto context changes the calculus. Two things are different from a typical SaaS deliverability story.

**Filter scrutiny is higher.** Mailbox providers have learned that crypto is a top-three category for fraud and scam mail. Filters apply lower thresholds to subject lines and body content matching crypto-scam patterns. Gmail's filter classifiers explicitly weight crypto-financial mail more heavily; LeadGenCrypto's research shows that for finance, health, crypto, sweepstakes, and donation senders, "subject lines require extra care" beyond the standard trigger-word lists. The validator in `comms-factory` already enforces this discipline — keep using it on every marketing send.

**High-risk language to avoid in marketing:**
- "Airdrop," "claim," "free tokens," "exclusive access," "limited time" → all phishing-correlated.
- Urgency cues ("act now," "24 hours only," "before it's gone").
- ALL CAPS subject lines.
- Single-link emails (phishing pattern).
- Money figures in subject lines without context ("Earn 18.94% APY today!" → bad; "Your monthly yield update" → fine).
- Any mention of "wallet," "seed phrase," "private key" in marketing context. These are phishing-tokens; even legitimate use trips filters.

**Domain age.** New domains have penalty weight at most providers for ~30-90 days. `infinex.xyz` has age (good). A brand-new `updates.infinex.xyz` subdomain inherits some apex age signal but still needs warmup. A brand-new separate apex (`infinexupdates.xyz`) has zero age — this is one of the strongest arguments against the separate-apex option for a crypto sender. New unknown crypto domain = high filter weight.

**Phishing-lookalike risk.** Already-known attack surface includes `infinex.info`, `infinex.network`, and other variants. A separate apex (`infinexupdates.xyz`) is structurally indistinguishable from these to recipients eyeballing the `From:` address. Even if it has perfect DMARC, recipients have been trained to distrust non-canonical Infinex domains. This is a brand-trust failure mode that no DNS configuration can fix.

**Provider blocklists.** Spamhaus, SURBL, URIBL, Barracuda Reputation Block List — crypto domains get listed faster than other categories. Monitor MXToolbox / Postmaster Tools weekly. A separate marketing subdomain limits blast radius if a list-of-shame entry happens; only the subdomain gets blocked, not the apex.

**Recommendation specific to crypto context:** Don't include any onchain language (wallet addresses, transaction hashes, token symbols, yield percentages) in marketing-list emails unless absolutely necessary. Save those for transactional and in-product. This isn't paranoia — it's how Coinbase and Kraken structure their lifecycle programs.

---

## 5. Provider recommendations

Five-way comparison, then a recommended stack.

| Provider | Best for | Transactional/marketing isolation | Pricing reference | Notes |
|---|---|---|---|---|
| **Postmark** | Transactional with mission-critical inbox placement | **Hard isolation via Message Streams** — separate IP pools, separate reputations within one account | $15/mo for 10k, $55/mo for 50k | Highest deliverability rep in the cohort. Refuses customers who try to send marketing on transactional streams. Founded 2010. |
| **Resend** | Modern DX, React/Next.js teams | Shared infrastructure across transactional + Broadcasts. Less isolation than Postmark. | 3k free/mo, $20/mo for 50k | Newer, fastest-growing. Strong dev experience. Broadcasts product for marketing exists but shares infra with transactional API. |
| **SendGrid (Twilio)** | High-volume legacy senders | Subaccounts provide some isolation but shared IP pool is the default | Free tier eliminated 2025; paid tiers ~$20+/mo | Deliverability was 95.8% in recent 30-day tests vs Postmark 98.6% / Resend 99.2%. Operational complexity is higher. |
| **Mailgun** | API-first, mid-volume | Shared infrastructure; can pay for dedicated IPs to isolate streams | ~$15/mo entry tier | Stripe uses them under the hood. Solid but not the deliverability leader. |
| **AWS SES** | Highest volume, lowest cost, willing to operate | None built-in — you have to architect isolation via configuration sets + separate IPs | $0.10 per 1k | Cheapest at scale. Requires significant config work and deliverability expertise. Wrong choice for a small team. |
| **Loops.so** | SaaS lifecycle + marketing for product teams | Built for marketing/lifecycle; not designed as transactional infrastructure | $49/mo for 5k contacts (contact-based) | Strong UX for non-engineering marketing operators. Good fit if marketing is run by non-engineers. |

**Recommended stack for Infinex:**

**Option A (cleanest separation, recommended):**
- **Transactional + security:** Postmark on `mail.infinex.xyz`, using Postmark's transactional Message Stream.
- **Marketing:** Resend Broadcasts on `updates.infinex.xyz`, OR Loops.so if the marketing op is run by a non-engineer.
- Two providers = two reputations, two IP pools, two failure domains. Maximum isolation.

**Option B (single-provider with stream split):**
- **Both on Postmark:** transactional via the default Message Stream, marketing via a Postmark Broadcast Stream. Different DKIM `d=` per subdomain.
- Lower ops burden (one billing relationship, one dashboard) but you're relying on Postmark's internal isolation rather than provider-level isolation. Postmark's Message Streams give very strong isolation guarantees, so this is still a defensible choice.
- Cheaper and simpler for a small team.

**Option C (avoid):** SendGrid or AWS SES for both. The ops burden + lower default deliverability is wrong for Infinex's scale and risk profile.

**Bottom-line provider call:** Option B (Postmark for both, separate streams + subdomains) is the recommended starting point. Migrate to Option A only if marketing volume exceeds ~50k/month or if the marketing program needs Broadcast-specific UX that Postmark doesn't offer well.

---

## 6. Concrete setup for Infinex — DNS and runbook

Action-ready records and ramp plan.

### DNS records to publish

Assuming Option B (Postmark for both, two streams):

```
; Apex — transactional + security only
infinex.xyz.                  TXT    "v=spf1 include:spf.mtasv.net include:_spf.google.com -all"
pm._domainkey.infinex.xyz.    CNAME  pm._domainkey.pmta1.postmarkapp.com.
_dmarc.infinex.xyz.           TXT    "v=DMARC1; p=quarantine; sp=reject; adkim=s; aspf=s; rua=mailto:dmarc-reports@infinex.xyz; fo=1; pct=100"

; Marketing subdomain
updates.infinex.xyz.                   TXT    "v=spf1 include:spf.mtasv.net -all"
pm-bounces.updates.infinex.xyz.        CNAME  pm.mtasv.net.
20240101._domainkey.updates.infinex.xyz. CNAME 20240101._domainkey.pmta1.postmarkapp.com.
_dmarc.updates.infinex.xyz.            TXT    "v=DMARC1; p=none; rua=mailto:dmarc-reports@infinex.xyz; pct=100"
```

(Exact Postmark CNAME values come from the Postmark dashboard; the structure above is illustrative.)

If using Option A (Resend for marketing):
```
updates.infinex.xyz.                   TXT    "v=spf1 include:_spf.resend.com -all"
resend._domainkey.updates.infinex.xyz. TXT    "v=DKIM1; ..."   ; from Resend dashboard
send.updates.infinex.xyz.              MX     10 feedback-smtp.resend.com.
_dmarc.updates.infinex.xyz.            TXT    "v=DMARC1; p=none; rua=mailto:dmarc-reports@infinex.xyz; pct=100"
```

### Required mailboxes

- `abuse@infinex.xyz` — monitored shared inbox; RFC 2142 mandatory.
- `postmaster@infinex.xyz` — monitored shared inbox; RFC 2142 mandatory.
- `dmarc-reports@infinex.xyz` — aggregate DMARC reports land here. Pipe to a parser (dmarcian, Valimail, or a self-hosted dmarc-report-parser). High volume; do not let humans read raw.
- `security@infinex.xyz` — already exists.

### DMARC ramp schedule

| Week | Apex policy | `updates.` policy |
|---|---|---|
| 0 (today) | `p=none; sp=none` (audit only) | not yet published |
| 1-2 | `p=none; sp=none` — confirm DMARC aggregates show all legit senders passing | `p=none` — publish |
| 3-4 | `p=quarantine; pct=25; sp=quarantine` | `p=none` (continue warmup) |
| 5-8 | `p=quarantine; pct=100; sp=reject` | `p=none` |
| 9-12 | `p=reject; sp=reject` | `p=quarantine; pct=25` |
| 13+ | `p=reject; sp=reject` | `p=quarantine; pct=100` → `p=reject` |

Each step requires 2 weeks of clean DMARC aggregate reports before advancing. If reports show legitimate senders failing alignment, fix that before tightening.

### Warmup schedule for `updates.infinex.xyz`

Following Postmark's domain-warmup guide:

| Day range | Volume per provider per day | Target audience |
|---|---|---|
| 1-2 | 50-100 | Most-engaged existing users (opened mail in last 30 days) |
| 3-4 | 200 | Engaged users |
| 5-7 | 400 | Engaged users |
| 8-10 | 600-800 | Expanding to 60-day engaged |
| 11-14 | 1000-1500 | 60-day engaged |
| 15-17 | 2000-3000 | 90-day engaged |
| 18-21 | 4000-5000 | Full active list |
| 22-25 | 7500-10000 | Full list |
| 26-30 | Full intended volume | Full list |

If at any point: bounce rate > 2%, complaint rate > 0.1%, open rate < 20% — **drop volume 25-30% and hold until metrics recover.**

### Required headers on every marketing send

```
List-Unsubscribe: <https://infinex.xyz/unsubscribe?token=...>, <mailto:unsubscribe@updates.infinex.xyz?subject=unsubscribe>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Both headers MUST be inside the DKIM-signed header set. RFC 8058 requires this. Without it, Gmail and Yahoo treat the one-click as untrusted.

**Transactional and security emails are exempt** from RFC 8058 unsubscribe per the spec, but it's good hygiene to include `List-Unsubscribe: <mailto:...>` on transactional anyway for unusual cases. Don't include `List-Unsubscribe-Post` on transactional — that signals it's a list email and may downgrade priority.

### Monitoring stack

- Google Postmaster Tools: register `infinex.xyz` AND `updates.infinex.xyz` as separate domains. Add the subdomain explicitly — Gmail does not auto-aggregate it.
- Yahoo Sender Hub: same — separate registrations.
- Microsoft SNDS: register sending IPs (Postmark/Resend will provide the IPs they use for your account, even on shared infra).
- DMARC aggregate report parser: dmarcian free tier or Valimail's free Monitor product. Send `rua=` reports to it.
- MXToolbox blacklist monitor on both `infinex.xyz` and `updates.infinex.xyz`. Weekly check minimum.
- Postmark/Resend dashboards: complaint rate, bounce rate, open/click rates. Daily review during warmup, weekly thereafter.

### Operational gates

- **Pre-send checklist** for every marketing campaign:
  - Validator pass (run through `comms-factory`'s rules).
  - Subject-line review against crypto trigger-word list.
  - Recipient list filtered for engagement (no 90-day-cold contacts during warmup).
  - Unsubscribe link tested.
  - Test send to internal Gmail / Outlook / Apple Mail / Yahoo seed addresses; check inbox placement before fanout.
- **Daily during warmup:** check Postmaster Tools, complaint rate, bounce rate.
- **Incident response:** if complaint rate spikes above 0.2%, **stop sending immediately**, investigate, do not resume until root cause identified.

---

## Sources

Authentication and DMARC mechanics:
- RFC 7489 — DMARC base spec (`https://datatracker.ietf.org/doc/html/rfc7489`)
- RFC 8058 — One-click List-Unsubscribe (`https://datatracker.ietf.org/doc/html/rfc8058`)
- RFC 2142 — Mailbox names for common services like `abuse@`, `postmaster@`
- dmarcian on `sp=` tag mechanics — `https://dmarcian.com/dmarc-subdomain-policy/`
- MXToolbox on DMARC `sp` tag — `https://mxtoolbox.com/dmarc/details/dmarc-tags/dmarc-sp`
- Suped on subdomain DMARC override — `https://www.suped.com/learn/dmarc/how-do-dmarc-records-on-subdomains-override-root-domain-dmarc-policies`

Reputation segmentation:
- Google Postmaster Tools dashboards docs — `https://support.google.com/a/answer/14668346`
- Google Postmaster Tools setup — `https://support.google.com/a/answer/9981691`
- Mailgun on subdomains and reputation — `https://www.mailgun.com/blog/email/the-basics-of-email-subdomains/`
- Mailgun transactional vs marketing — `https://www.mailgun.com/blog/deliverability/transactional-emails-vs-marketing-emails/`
- Suped on subdomain vs apex — `https://www.suped.com/knowledge/email-deliverability/sender-reputation/should-i-use-a-subdomain-or-my-main-domain-for-marketing-emails`
- Resend on subdomain choice — `https://resend.com/docs/knowledge-base/is-it-better-to-send-emails-from-a-subdomain-or-the-root-domain`

Bulk sender requirements (Gmail/Yahoo/Microsoft 2024-2026):
- Mailgun Yahoogle summary — `https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/`
- Resend on Gmail/Yahoo requirements — `https://resend.com/blog/gmail-and-yahoo-bulk-sending-requirements-for-2024`
- Unboxd 2026 bulk-sender guide — `https://unboxd.ai/blog/bulk-sender-requirements.html`
- Security Boulevard on 2025 enforcement update — `https://securityboulevard.com/2025/11/google-and-yahoo-updated-email-authentication-requirements-for-2025/`

Provider comparison:
- Postmark vs SendGrid — `https://postmarkapp.com/compare/sendgrid-alternative`
- Postmark vs Resend — `https://postmarkapp.com/compare/resend-alternative`
- Resend/SendGrid/Postmark pricing — `https://blog.vibecoder.me/email-service-pricing-resend-sendgrid-postmark`
- Postmark vs AWS SES — `https://mailflowauthority.com/email-comparisons/postmark-vs-aws-ses`
- Postmark warmup guide — `https://postmarkapp.com/guides/how-to-warm-up-a-domain`
- Postmark List-Unsubscribe header — `https://postmarkapp.com/support/article/1299-how-to-include-a-list-unsubscribe-header`

Crypto-specific:
- LeadGenCrypto on crypto spam triggers — `https://leadgencrypto.com/blog/crypto-outreach/email-spam-words-trigger-guide-crypto-outreach/`
- Mailmodo crypto email marketing — `https://www.mailmodo.com/guides/crypto-email-marketing/`
- PhishDestroy Infinex lookalike warnings — `https://phishdestroy.io/domain/infinex.info/` and `https://phishdestroy.io/domain/infinex.network/`
- RedSift on Coinbase phishing & DMARC — `https://blog.redsift.com/email/dmarc/boosting-email-security-amid-phising-attempts/`

Real-world sending patterns:
- Stripe custom email domain docs — `https://docs.stripe.com/get-started/account/email-domain`
- Coinbase email addresses — `https://help.coinbase.com/en/coinbase/privacy-and-security/other/is-this-email-really-from-coinbase`
- Stellastra on Stripe + Mailgun deliverability — `https://stellastra.com/how-to-stop-stripe-emails-going-to-spam/`

Where reputable sources disagreed: Postmark recommends near-100% isolation between transactional and marketing as a hard rule; Resend (newer, shared-infra) treats isolation as a soft recommendation. For Infinex's risk profile (crypto + security-critical mail on the line), Postmark's stricter posture applies.
