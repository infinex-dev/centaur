# classify_address — labeling outflow destinations

Turn a raw destination address into a labeled gravity well. Run via the `projectjin` CLI (Bash). Deterministic cases (Etherscan name-tag hit) need no judgment; only the unlabeled tail needs reasoning.

## Decision tree (per destination address)

1. **`eth_getCode`** → is it a contract or an EOA?
   `projectjin --agent --json tool call infinex_evm_call_rpc --input '{"chain":"<chain>","method":"eth_getCode","params":["<addr>","latest"]}'`
   - `0x` (empty) → EOA. Likely `self_custody_eoa` or a CEX deposit address — go to step 3.
   - bytecode → contract. Identify the pattern (BeaconProxy / ERC1967 / Safe / ZeroDev Kernel / 7702 delegate). If it's a forwarder/deposit contract, follow its sweep-to **collector** one hop (step 2).
2. **Collector hop (deposit-forwarder rule).** Never web-search a leaf deposit address — trace where it sweeps, then identify the collector's verified implementation / Etherscan name-tag. The collector is the real entity.
3. **`infinex_get_transaction_history`** → sweep pattern. Many-in → one-out consolidation = a CEX deposit address. Record `collector_address` + `collector_label`.
4. **Etherscan name-tag** (WebFetch the address page) → entity confirmation. A name-tag hit = high-confidence label, no further work.
5. **Web-search fallback** (`infinex_web_search`) only for unlabeled high-$ addresses.
6. **`hl_active`** — flag Hyperliquid activity if relevant (separate probe).

## Label entry shape (one per address) — matches the proven `03-labels.json`

```json
{
  "address": "0x…", "chain": "ethereum",
  "classification": "cex | smart_account_wallet | self_custody_eoa | btc_destination | market_maker | bridge | defi_protocol | unknown",
  "entity_name": "Binance", "subtype": "cex_deposit | deposit_address | eip7702_delegated_eoa | eip7702_kernel_smart_account | active_defi_user | …",
  "confidence": "high | medium | low",
  "is_contract": true, "collector_address": "0x…", "collector_label": "Binance: Hot Wallet",
  "methods_used": ["eth_getCode","get_transaction_history","etherscan_nametag"],
  "evidence": "one-line why",
  "usd": 0, "sends": 0, "senders": 0,
  "source": "transfer | swidge | swidge_mm_artifact",
  "verdict": { "agree": true, "revised_classification": null, "revised_entity": null, "note": "" }
}
```

## Notes

- Address formats: EVM `0x…`; Solana base58 (never `LOWER()`); Infinex smart accounts have a `0x0000…` vanity prefix; nearIntents BTC destinations are `bc1q…` → use a BTC explorer, not Etherscan.
- `market_maker` destinations are often swidge-solver artifacts (Mayan/Relay/OKX drivers), not retail exit — tag and usually exclude from "where users leave" headlines (G2/G4).
- Aggregate the finished labels by `classification` / `entity_name` to produce the gravity-well map. That aggregation also IS the External Scout's free "derived-external" demand map (see the GOAL doc).
