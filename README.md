# BIBET

BIBET is a retroactive public-goods funding protocol for completed work. Contributors submit public evidence, GenLayer validators review credibility/attribution/impact, and deterministic contract logic allocates a funded GEN budget.

The product idea is unchanged: BIBET funds what already proved useful. GenLayer is used only where semantic review is needed; accounting, caps, state transitions, and settlement are deterministic contract logic.

## Current canonical deployment

- Network: GenLayer StudioNet
- Contract: `0xE6d0e4FED7Eb013f5B8387338C5C909efcc39128`
- Deployment transaction: `0x02a5e79d883412df32eab8fab5d351622f341f6a9ebc18814f8c1a038521a5b0`
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

Challenges target reviewed claims only and must name an allowed verdict field. Duplicate challenges against the same claim, field, and verdict version are rejected. Contributors can respond once while the challenge is open. `adjudicate_challenge(round_id, challenge_id)` is the semantic challenge review write: GenLayer validators evaluate the original claim, original verdict, challenger evidence/reason, and contributor response, then write a new verdict version when consensus succeeds. Finalization is blocked while unresolved challenges exist.

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
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0xE6d0e4FED7Eb013f5B8387338C5C909efcc39128
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
- Schema verification: passed for `0xE6d0e4FED7Eb013f5B8387338C5C909efcc39128`
- TypeScript: passed
- ESLint: passed
- Next build: passed
- Direct tests: 64 passed, 0 failed
- StudioNet integration: 14 passed, 0 failed

## Fresh StudioNet lifecycle proof

All transactions below finalized with status `5` and result `6` on the fresh contract:

- `create_round`: `0xab670b9255c0ad91c852d36908c71dbe7c2764f18d56b71ec0724d9f793cbb31`
- `fund_round`: `0x9675eb055dc9cc4173246effcb784ac93b4c2b57e1e3656c846cd047a523e550`
- `lock_round`: `0x6396a6760f698cbe3f5e6c24924026d497fbbd2065e025e39d4d091ad86144d8`
- `submit_trace_claim`: `0xe13c0ceb9eff8b90de69701294ff681bb3903af9faa7498cccbda47cdcb17d31`
- `update_claim_before_close`: `0x2d6566b7266094b81482bfada6a2b649f1f3779f32efa53c0b823c83cc2ed8e7`
- `close_applications`: `0x28ed44b584d247714388543045bf2850f7cea9d132ed171c2f8a239feb8a3e65`
- `request_impact_review`: `0x6f2dbc2101e20d94974051b6e4f7afeae351715a13d67ff7eb5844df5ab636e2`
- `open_challenge`: `0xf6600b52469bf920c479c452c217f7c5e35cb5ea6162e8e95a064beaa2cdd1d4`
- `respond_to_challenge`: `0x9178175baaa2ce07d100cdda64d86b271be8b33f0e9f211c95bc36d59ecd0d24`
- `adjudicate_challenge`: `0xd0643a7c69cad5443b2d6d4aa5c799cbb469ad59bdfa27fb96cfb36be70a82ed`
- `finalize_round`: `0x3be11b71718a02671df025fb8287b29a77ace2123d3995d3e2a56b4e34086709`
- `withdraw_unallocated_budget`: `0xa85fde653330b4db9c873879960859f7dde36366eee2c6447624b0f34be201ed`
- `create_cancel_round`: `0xc64295fe8133f979cb7f03fc9ff001145974df0219494aac4888a44bdf971ada`
- `cancel_unopened_round`: `0xdc12c957b65b4e888999097715a524782c4075214867d99aeb49d61fee4e8edb`

The live evidence was intentionally weak (`https://example.com/`), so the review resolved to `INSUFFICIENT_EVIDENCE`, allocation was zero, and the creator-only unallocated withdrawal path was exercised.

## CI

GitHub Actions runs `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:direct`, and `npm run build`.

StudioNet live verification is intentionally not part of default PR CI because it requires funded test keys.

## Known limitations

- Direct tests are local deterministic/static regression tests, not a full GenLayer simulator harness. `npm view genlayer-test version` currently returns 404, so the `genlayer-test/gltest.direct` harness could not be installed from npm in this environment. Fresh StudioNet lifecycle tests provide the live GenLayer proof.
- A positive-evidence StudioNet harness is included as `npm run test:studionet:positive`. The first live attempt correctly failed its non-zero allocation assertion because validators marked GitHub/Vercel HTML evidence as insufficient to verify CI/tests/attribution; use raw, immutable, public evidence URLs for a non-zero proof.
- The frontend can read live rounds and afterledgers and create rounds, but full action panels for every lifecycle write are still intentionally limited to avoid pretending unsupported UX is production-complete.
