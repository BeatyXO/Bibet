# BIBET

BIBET is a retroactive public-goods funding protocol for completed work. Contributors submit public evidence, GenLayer validators review credibility/attribution/impact, and deterministic contract logic allocates a funded GEN budget.

The product idea is unchanged: BIBET funds what already proved useful. GenLayer is used only where semantic review is needed; accounting, caps, state transitions, and settlement are deterministic contract logic.

## Current canonical deployment

- Network: GenLayer StudioNet
- Contract: `0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf`
- Deployment transaction: `0xc592015876993c82f5a352fb681d720ed6aa5e302a6634fa25e7d561bf7e06e8`
- Explorer: `https://explorer-studio.genlayer.com`
- Vercel app: `https://bibet-eight.vercel.app/`

## Why GenLayer is necessary

Retroactive funding needs judgment: is the evidence real, attributable, non-duplicative, and meaningfully useful? A deterministic contract cannot inspect public web evidence or reason over conflicting claims. BIBET uses GenLayer for that nondeterministic boundary, then stores a canonical verdict and lets deterministic allocation logic handle money.

Without GenLayer, BIBET would need either a centralized reviewer/admin or purely self-attested claims.

## Contract lifecycle

Target flow:

`DRAFT → FUNDING → OPEN → REVIEW → FINALIZED`

Cancellation is only allowed before a round is opened. Once a round is `OPEN`, the creator cannot cancel and seize funds. After `FINALIZED`, only legitimate settlement actions remain: contributor allocation claims and creator withdrawal of unallocated budget.

## Nondeterministic boundary

`request_impact_review(round_id, claim_id)` is the semantic review write.

Each validator independently fetches claimant-submitted HTTP/HTTPS evidence URLs, treats fetched content as untrusted data, handles failed fetches as unavailable evidence, and evaluates eligibility, evidence quality, attribution, duplication risk, impact bands, score, and confidence.

Consensus equivalence compares canonical decision fields, not free-form prose. `INSUFFICIENT_EVIDENCE` verdicts must agree on eligibility and zero score. Positive `ELIGIBLE` verdicts allow moderate semantic variation only when evidence quality is moderate/strong, attribution is not contradicted, duplication risk is not high, and numeric impact bands stay within tolerance. `short_reason` is stored for audit context but is not exact-match consensus-critical.

Thin, missing, contradictory, or unparseable evidence can resolve to `INSUFFICIENT_EVIDENCE`; BIBET does not force false certainty.

## Deterministic boundary

The contract deterministically handles round creation/funding/locking, claim validation, immutable claim identity, duplicate artifact checks, challenge state transitions, capped allocation math, claims, refunds, unallocated withdrawals, afterledger views, and round discovery.

## Allocation algorithm

Allocations are integer, deterministic, and capped.

- Eligible claims receive a score from the canonical verdict.
- Weak/unavailable/contradictory evidence, high duplication risk, or non-eligible verdicts score zero.
- Base allocation is proportional to score.
- `max_share_bps` caps every recipient.
- Rounding residual is redistributed only to recipients still below cap.
- If every eligible recipient is capped, the residual remains explicitly unallocated.
- The contract exposes funded, allocated, claimed, unallocated, withdrawn, and refundable amounts.

Value invariant:

`funded_budget = allocated_amount + unallocated_amount`

Settlement invariant:

`claimed_amount + unallocated_withdrawn <= funded_budget`

StudioNet reports `contract_balance` through the GenLayer runtime; live verification records the value but does not rely on it as the sole economic invariant because payable transfer visibility may lag or differ from the logical settlement record.

## Claim and evidence model

Claims are canonicalized before storage. Claim id, contributor, submitted timestamp, and artifact id are immutable after submission. Claim payloads reject unsupported fields, oversized text, missing evidence, duplicate evidence URLs, non-HTTP(S) URLs, localhost/private-network URLs, empty public-good impact statements, non-ISO completion dates, and completion dates outside the round's configured historical window.

Configured bounds include title 120 chars, artifact id 96 chars, impact statement 1200 chars, URL 240 chars, evidence URLs 5, claims per round 80, and challenges per round 80.

## Challenge model

Challenges target reviewed claims only and must name an allowed verdict field. Duplicate challenges against the same claim, field, and verdict version are rejected. Contributors can respond once while the challenge is open. `adjudicate_challenge(round_id, challenge_id)` is the semantic challenge review write: GenLayer validators evaluate the original claim, original verdict, challenger evidence/reason, and contributor response, then write a new verdict version when consensus succeeds. Finalization is blocked until the deterministic `challenge_deadline_at` has passed and unresolved challenges are adjudicated.

## Frontend

The frontend has separate app pages:

- `/` landing page, no fake stats
- `/rounds` live round summaries read from `get_round_count()` and `get_round_summary()`
- `/rounds/[id]` live afterledger read plus fund, lock/open, submit/update claim, close applications, request review, challenge/respond/adjudicate, finalise, claim allocation, withdraw unallocated, and permissionless advance controls
- `/start` create-round flow with first-class application/review/challenge/finalisation deadlines
- `/how` protocol explanation
- `/audit` audit/explorer surface

Injected EIP-1193 wallets are the primary production path. The generated browser wallet is retained for StudioNet/dev convenience and is warned as local browser storage, not custody-grade storage.

## Environment

```bash
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
```

## Local setup

```bash
npm install
npm run typecheck
npm run lint
npm run test:direct
npm run test:allocations
npm run build
```

## Contract validation

```bash
npm run lint:contract
npm run verify:schema
```

Latest results:

- GenVM lint: basic lint passed locally; `genvm-lint check` is wired in CI but this Windows cache returned `Failed to load SDK` after lint passed
- Schema verification: pending for `0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf`
- TypeScript: passed
- ESLint: passed
- Next build: passed
- Direct Mode pytest: 21 passed, 0 failed
- Supplementary allocation vectors: 13 passed, 0 failed
- Supplementary static checks: 62 passed, 0 failed
- StudioNet insufficient-evidence/challenge integration: pending rerun on final hardened deployment
- StudioNet positive economic proof: pending on the current deployment. See `scripts/studionet-positive-cycle.ts` for the digest-backed immutable proof inputs.

## Historical StudioNet proof — earlier deployment only

The eight transactions below belong to the earlier deployment `0x646641bc1eDB15c6774b1c00acd7439477cFA7DD`. They are historical/pre-hardening evidence and must not be attributed to the current deployment `0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf`.

- Historical `create_round`: `0x2d569aef5e8b969618077de4edf2db81814746b77bdbeda328ee506a47636ca3`
- Historical `fund_round`: `0xee696ec786c63dce081ef542488d043aed3eec7b0c24a3780705bbfd1d81165b`
- Historical `lock_round`: `0x668c30f4f3fb368aad8f724d56a0cf917dc39065eaca1439a907bfda79155f90`
- Historical `submit_trace_claim`: `0xec701f847ec45088a32dc5c0e80b44437dff0ecd0aa1425985e1e1c6af210341`
- Historical `close_applications`: `0xa231cd577e2d0d7e1c63c92cc6b64d40fb6c446b8b4472c7be574a4d386cb59e`
- Historical `request_impact_review`: `0x13f1e0c98a9c56a78eb010c1cb83dee77e304c2352cc382154a48107bae9feba`
- Historical `finalize_round`: `0x40ffa9eb89de7f7a91a0d110f3adf746f7132344ea55569884b0d9534d4da67d`
- Historical `claim_allocation`: `0x2006b94e48390dda8527a4cb5d3e77c4e315664abb9f5b912237d99716f32839`

No positive semantic-review or allocation proof is claimed here for the current `0x3F3F...` deployment until the fresh cycle below completes.

The current deployment’s deterministic setup trail was accepted by StudioNet: create `0x6c2e3caac5fad7817ec6c4dcf071e3187276218b5fbc4b307ccb10d5e83d51c6`, fund `0xc8aa86855e04f1d71d7a240fc49003912a69de39a43b009c1f55929cb5c7105d`, lock `0x373e509b0906b1c1ca1a9077f3941d0ed583d69279c20e39b038186d36841d71`, submit `0x998e88e6aab13e86ad99159687d7cd9cdb93813b48faba7895e38b8423fb270b`, and close `0x5febc87f42f50ac4aab6027d6a862409e46b32729c6f280dd288d0525417e176`. The subsequent semantic review transaction `0x08152f405eccc9fda71f35958177c9c7bbb1eaeb55c2873425cb579500546c32` did not reach majority agreement, so no allocation or claim is recorded as current proof.

An insufficient-evidence challenge/adjudication/withdrawal smoke cycle was also executed on the previous fresh hardened contract and passed 14 accepted transactions.

## CI

GitHub Actions runs Python setup, `python -m pip install -r requirements.txt`, `npm ci`, `npm run typecheck`, `npm run lint`, `npm run lint:contract`, `npm run test:direct`, `npm run test:allocations`, and `npm run build`.

StudioNet live verification is intentionally not part of default PR CI because it requires funded test keys.

## Known limitations

- StudioNet live verification is intentionally not part of default PR CI because it requires funded test keys.
- The frontend exposes every core lifecycle write, but it is still a compact protocol console rather than a fully guided consumer UX.
