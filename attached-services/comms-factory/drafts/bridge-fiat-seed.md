# Bridge.xyz fiat deposits — grounding seed (PROVISIONAL, not copy)

Ground each claim against THIS branch's platform code (bridge-integration) + Bridge.xyz public docs. Verify code status by grep on this branch, not main.

- Bridge.xyz fiat (bank) deposits are being added to Infinex.
- Infinex fiat deposit provider: Bridge.xyz.
- Bridge.xyz is a fiat on/off-ramp and stablecoin infrastructure company (acquired by Stripe).
- Bank deposits convert fiat into a stablecoin and settle on-chain into the Infinex account.
- Supported deposit rails (e.g. USD ACH/wire, EUR SEPA IBAN, others) — verify which are wired.
- KYC / onboarding is required before a user can receive fiat deposits.
- Bridge.xyz fiat-deposit code status in the Infinex platform: verify by grep on the bridge-integration branch (it was absent on main).
- Deposit/virtual-account mechanic and event lifecycle — verify against code and Bridge.xyz docs.
