# FlexiPay

**Work a shift. Get paid when it is approved.**

Hackathon Testnet prototype: hospitality shift clock-in/out → employer approval → real Soroban payment on Stellar Testnet.

## What it does

1. Worker (Sarah Ahmed, Chef at The Crown Hotel) clocks in/out for an 8-hour shift at £14/hour → **£112 gross**.
2. Employer opens the completed shift and clicks **APPROVE & PAY**.
3. A Soroban `pay_shift` contract authorises the employer, blocks duplicate shift IDs, and transfers **1 XLM TESTNET** to the worker.
4. UI shows on-chain proof (tx hash, addresses, contract ID) with a Stellar Expert link.

Gross £112 is the wage calculation. Testnet XLM is the settlement rail demo — they are intentionally separate.

## Architecture

```
Worker / Employer UI (React + Vite)
        │
        ▼
Local demo API (Node)  ← signs with CLI identity `employer`
        │
        ▼
Soroban pay_shift contract (Testnet)
        │
        ▼
Native SAC transfer: employer → worker (1 XLM)
```

Scaffold Stellar project layout with a minimal custom contract under `contracts/pay-shift`.

## Why Stellar

Instant Testnet settlement, low-friction asset transfers via the Stellar Asset Contract, and Soroban authorisation + on-chain duplicate protection without a heavy payroll stack.

## Run locally

Prerequisites (already set up on this machine for the hackathon):

- Node.js / npm
- Rust + `wasm32v1-none`
- Stellar CLI 28
- Scaffold CLI (`stellar-scaffold` / `stellar scaffold`)
- MSVC Build Tools (Windows)

```bash
# Terminal 1 — payment API (uses Stellar CLI + employer identity)
npm run demo-api

# Terminal 2 — frontend
npm run start:app
```

Or both: `npm start`

Open **http://127.0.0.1:5173/**

### Demo script (~45s)

1. Worker → **CLOCK IN** → **CLOCK OUT** (deterministic 8h / £112).
2. Employer → **APPROVE & PAY**.
3. Show success + **VIEW TRANSACTION** on Stellar Expert.
4. Switch back to Worker → **PAID ✓**.

## Testnet details

| Role | Address |
|------|---------|
| Employer (payer) | `GDNFGHPOIPM3RHL7NMQCXRAELEF6AVFJLLOFXM25DDN4ANXMMTU3LFZP` |
| Worker (payee) | `GADUBNTO655LVGIRUH3SP7E4P5FRUL2TWWURNDYQOQ3KMPD3B72WYJHL` |
| Native SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

CLI identities: `employer`, `worker` (funded via Friendbot).

Network: **Testnet only** (`Test SDF Network ; September 2015`).

## Contract

- **ID:** `CBPCPL6JJTVLYFT2DLTLA3FAFQHPD3LZYARCMF3CFCZF4D2JS32FNDVO`
- **Lab:** https://lab.stellar.org/r/testnet/contract/CBPCPL6JJTVLYFT2DLTLA3FAFQHPD3LZYARCMF3CFCZF4D2JS32FNDVO
- **Methods:** `pay_shift`, `is_paid`
- Source: `contracts/pay-shift`

### Reproduce payout (CLI)

```bash
stellar contract invoke \
  --id CBPCPL6JJTVLYFT2DLTLA3FAFQHPD3LZYARCMF3CFCZF4D2JS32FNDVO \
  --source-account employer \
  --network testnet \
  --send=yes \
  -- \
  pay_shift \
  --shift_id "FW-DEMO-NEW" \
  --employer GDNFGHPOIPM3RHL7NMQCXRAELEF6AVFJLLOFXM25DDN4ANXMMTU3LFZP \
  --worker GADUBNTO655LVGIRUH3SP7E4P5FRUL2TWWURNDYQOQ3KMPD3B72WYJHL \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --amount 10000000
```

(`10000000` stroops = 1 XLM.) Re-invoking the same `--shift_id` fails with contract error `#1` (AlreadyPaid).

Example paid tx: https://stellar.expert/explorer/testnet/tx/49fb404369e027ba806bb9f27975685dbe97a4df06723ec96e1a99c59104516f

## Mocked vs real

**Mocked / local**

- Worker & employer product profiles
- Clock-in/out persistence (in-memory UI state)
- Hours / £112 wage calculation
- Demo API signing (local CLI identity — not production wallet UX)

**Real (Stellar Testnet)**

- Soroban `pay_shift` contract
- Employer `require_auth`
- Duplicate shift-ID protection
- Native XLM SAC transfer
- On-chain events + explorer-verifiable transaction hash
- Worker balance increase

## Production roadmap (short)

- Freighter / proper employer wallet signing (no local secret/CLI signer)
- Testnet stablecoin (or issued GBP-pegged asset) instead of native XLM
- Persist shifts server-side; multi-worker multi-venue
- Escrow / pre-funded payroll wallet policies
- Compliance, payroll tax, and fiat off-ramps as separate layers

## Rebuild contract (if needed)

```bash
# From a VS Developer / vcvars64 environment on Windows:
stellar contract build --package pay-shift
stellar contract deploy --wasm target/wasm32v1-none/release/pay_shift.wasm \
  --source-account employer --network testnet --alias pay_shift
```

Update `PUBLIC_PAY_SHIFT_CONTRACT_ID` in `app/.env` after redeploy.
