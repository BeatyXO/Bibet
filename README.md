# BIBET

BIBET is a retroactive public-goods funding protocol: contributors submit completed work and public evidence; GenLayer validators assess credibility, attribution, and impact bands; deterministic contract logic allocates a locked GEN budget.

## Run locally

```bash
npm install
npm run dev
npm run build
```

The frontend defaults to GenLayer Studionet (`61999`). Public browsing does not require a wallet. Writes use either an injected EIP-1193 wallet or a browser-generated wallet persisted under `bibet.browser-wallet.private-key`; the generated-wallet warning is shown before use.

## Contract

`contracts/bibet.py` contains the protocol boundary, state machine, canonical verdict enums, and deterministic allocation reference. Deployment requires a configured GenLayer CLI keystore and Studionet account:

```bash
genlayer network set studionet
genvm-lint contracts/bibet.py
genlayer deploy --contract contracts/bibet.py
```

The deployment address is recorded below and centralized in `lib/config.ts`.

## Verified Studionet deployment

- Contract: `0xF57Cbf73d00A3d2d1Dc35EBd5972627534C1D5f3`
- Deployment transaction: `0xd86b223176f3c1d19da04c82b4c7a932144f12545b643e7c32fc1cf5acfeb6ad`
- Schema verification: `npm run verify:schema`
- Live cycle verification: `npm run test:studionet`

Accepted live-cycle transactions:

- `create_round`: `0x01948104f67c1180fa92da845e0d5b479520dba23aab8f768a0144d21f3effe0`
- `fund_round` with payable value: `0x306b64c30ecc1e17b69c7f8e43fff6f7c251cdefc33a28b84daeb191244c8936`
- `lock_round`: `0x93d4e0c25b82f882c1e63210802c25f4e1f759a98d1176d57df4b6865c476353`
- `submit_trace_claim`: `0xb9a21d41fad3f81a1971fc1ebb775efa329157e6d77d0d5ba31c607ae4cdd6be`
- `update_claim_before_close`: `0xc4de03d786f7972ec6343f34601c131df2766cffe74bf4e0b158fb3f9375fe1c`
- `close_applications`: `0xcda5d7d3dfb03372ce7b15c302076ce39edb258f62e54a8c7f9af4d6ad174560`
- `request_impact_review` non-deterministic web/LLM review: `0xe0d6ec4c1b1fedbb581014f668eac0005da5c8a2764bba7a23a1de5f82ba2b9b`
- `open_challenge`: `0xf33660da71c1bbc908d7fe7890f0991621299b7e80d9f61f2116078c04b8b725`
- `respond_to_challenge`: `0xa3142ce6d48acc410b2f42686af51a516806db7a63317a5fd3753b072562c846`
- `resolve_challenge`: `0x910acff297133854dbc492d31cb9cc6b9f61e52bf55fb62983e1c9fae7901e88`
- `finalize_round`: `0xb7917c8167e5cece50a10f6f3ac555c19bed7fe48a11cc351586b56535f53cdb`
- `create_cancel_round`: `0xc7e611a6070f867215cd43b4f4bedfebfeac849afc2d9b3e0a9df5daf4fe181d`
- `cancel_unopened_round`: `0xa196ec2352564073db88418156aeb523b4fb3241f32f09fca8f2c6bdc03157ae`

The live evidence-review test used intentionally simple public test evidence. The consensus result was `INSUFFICIENT_EVIDENCE`, so `claim_allocation` correctly had no payable allocation to claim in that cycle.

## Vercel environment

Use these values in Vercel:

```bash
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0xF57Cbf73d00A3d2d1Dc35EBd5972627534C1D5f3
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
```
