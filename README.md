# BIBET

BIBET is a retroactive public-goods funding protocol for completed work. Contributors submit public evidence, GenLayer validators review credibility/attribution/impact, and deterministic contract logic allocates a funded GEN budget.

The product idea is unchanged: BIBET funds what already proved useful. GenLayer is used only where semantic review is needed; accounting, caps, state transitions, and settlement are deterministic contract logic.

## Current canonical deployment

- Network: GenLayer StudioNet
- Contract: `0x7DB196d1611D2A20C0eC0619c3f6dC7c1b2cc6D5`
- Deployment transaction: `0x240a749588d42cb30dd306caecd78924b399a4882d8866001b3cd90a984641bd`
- Explorer: `https://explorer-studio.genlayer.com`
- Vercel app: `https://bibet-eight.vercel.app/`

## Why GenLayer is necessary

Retroactive funding needs judgment: is the evidence real, attributable, non-duplicative, and meaningfully useful? A deterministic contract cannot inspect public web evidence or reason over conflicting claims. BIBET uses GenLayer for that nondeterministic boundary, then stores a canonical verdict and lets deterministic allocation logic handle money.

Without GenLayer, BIBET would need either a centralized reviewer/admin or purely self-attested claims.

## Contract lifecycle

Target flow:

`DRAFT → FUNDING → OPEN → REVIEW → CHALLENGE → REVIEW → FINALIZED`

Cancellation is only allowed before a round is opened. Once a round is `OPEN`, the creator cannot cancel and seize funds. After `FINALIZED`, only legitimate settlement actions remain: contributor allocation claims and creator withdrawal of unallocated budget.

## Nondeterministic boundary

`request_impact_review(round_id, claim_id)` is the semantic review write.

Each validator independently fetches claimant-submitted HTTP/HTTPS evidence URLs, treats fetched content as untrusted data, handles failed fetches as unavailable evidence, and evaluates eligibility, evidence quality, attribution, duplication risk, impact bands, score, and confidence.

Consensus equivalence compares canonical decision fields, not free-form prose. Exact-match fields are eligibility, evidence quality, attribution, duplication risk, and confidence band. Numeric impact bands and normalized score are tolerance-bounded. `short_reason` is stored for audit context but is not exact-match consensus-critical.

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

Claims are canonicalized before storage. Claim id, contributor, submitted timestamp, and artifact id are immutable after submission. Claim payloads reject unsupported fields, oversized text, missing evidence, duplicate evidence URLs, non-HTTP(S) URLs, localhost/private-network URLs, and empty public-good impact statements.

Configured bounds include title 120 chars, artifact id 96 chars, impact statement 1200 chars, URL 240 chars, evidence URLs 5, claims per round 80, and challenges per round 80.

## Challenge model

Challenges target reviewed claims only and must name an allowed verdict field. Duplicate active challenges against the same claim/field are rejected. Contributors can respond once while the challenge is open. Creator resolution is constrained: if upheld, the affected verdict is downgraded to `INSUFFICIENT_EVIDENCE` with zero score; unrelated fields cannot be arbitrarily rewritten. Finalization is blocked while unresolved challenges exist.

Future versions should move semantic challenge adjudication into another GenLayer review path.

## Frontend

The frontend has separate app pages:

- `/` landing page, no fake stats
- `/rounds` live round summaries read from `get_round_count()` and `get_round_summary()`
- `/rounds/[id]` live afterledger read
- `/start` create-round flow
- `/how` protocol explanation
- `/audit` audit/explorer surface

Injected EIP-1193 wallets are the primary production path. The generated browser wallet is retained for StudioNet/dev convenience and is warned as local browser storage, not custody-grade storage.

## Environment

```bash
NEXT_PUBLIC_GENLAYER_NETWORK=studionet
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x7DB196d1611D2A20C0eC0619c3f6dC7c1b2cc6D5
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
```

## Local setup

```bash
npm install
npm run typecheck
npm run lint
npm run test:direct
npm run build
```

## Contract validation

```bash
$env:PYTHONIOENCODING='utf-8'
genvm-lint contracts/bibet.py
npm run verify:schema
```

Latest results:

- GenVM lint: passed, 3 checks
- Schema verification: passed for `0x7DB196d1611D2A20C0eC0619c3f6dC7c1b2cc6D5`
- TypeScript: passed
- ESLint: passed
- Next build: passed
- Direct tests: 43 passed, 0 failed
- StudioNet integration: 14 passed, 0 failed

## Fresh StudioNet lifecycle proof

All transactions below finalized with status `5` and result `6` on the fresh contract:

- `create_round`: `0x6f5d987a9a95686ff5e4f1599a1c56e9d5d9409d3c30a8fbe82f34107f9f12af`
- `fund_round`: `0xa98177760006f3adeb98383ace158e4d9e18f484c78bf8d367fa982c832a82c5`
- `lock_round`: `0xdff19aa18c773f92e73a400b7ce6abdf4e2d75ff7bc348b4df80c21b97040d2e`
- `submit_trace_claim`: `0xd28f234bdc11df0e874b9b15d2f4f2c73f40546276a17c5d48d1797479467fcf`
- `update_claim_before_close`: `0xdea36b509d66d8a6c47e22156f60d9b080e0705e60a3c97987b19b0b8c47a132`
- `close_applications`: `0xbe8bae44804afc1ea554da408291418594a0babf07fed811d17347767e7d5506`
- `request_impact_review`: `0x4a04a054c4c8daf64d29fbe1ceaa8aaf19c812d9f0c19e08b1356a4636448337`
- `open_challenge`: `0x11df21fcb3c95b008a6de78b26f6435120eeee088cb1078ba9dd69343fa8d548`
- `respond_to_challenge`: `0x42487200481c9c5dfd38be3bd66ccfa2461b7fa96d8cbcc65b69ee4d3d7c4f1b`
- `resolve_challenge`: `0x2ec57665422f861aece85b70494440439dd70f1bcf7842ef12bc857cf5654086`
- `finalize_round`: `0xc9b48540fed96248155195e05f0b8cc140e68e58f13b7c15d0b5b8ea4f4694af`
- `withdraw_unallocated_budget`: `0xbc191da18bb28b5ce4204a705d948135d775588d34f31326864780047c3091d4`
- `create_cancel_round`: `0x5e26b4e9a739be48bff65f30bf0fd8b141ef04a215f93b7fa72d2309ada28e65`
- `cancel_unopened_round`: `0x46c9843aa2dc80bfe979703f54431845555491b0a6dde7e1a64603e3be31cbac`

The live evidence was intentionally weak (`https://example.com/`), so the review resolved to `INSUFFICIENT_EVIDENCE`, allocation was zero, and the creator-only unallocated withdrawal path was exercised.

## CI

GitHub Actions runs `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:direct`, and `npm run build`.

StudioNet live verification is intentionally not part of default PR CI because it requires funded test keys.

## Known limitations

- Direct tests are local deterministic/static regression tests, not a full GenLayer simulator harness. The fresh StudioNet lifecycle provides the live GenLayer proof.
- Challenge resolution is creator-controlled but constrained; semantic challenge adjudication should become a GenLayer review in a later version.
- The frontend can read live rounds and afterledgers and create rounds, but full action panels for every lifecycle write are still intentionally limited to avoid pretending unsupported UX is production-complete.
