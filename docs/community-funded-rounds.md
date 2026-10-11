# Community-Funded Rounds — implementation record

## Provenance

The clone began at `de47a890b5d489c122dcbf7b58208c211148dafa` on `main` from `https://github.com/BeatyXO/Bibet`. The accepted project baseline SHA is not identified by the available repository records; the starting SHA must not be treated as an accepted-baseline SHA. The existing deployed creator-funded contract is `0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf`, with deployment transaction `0xc592015876993c82f5a352fb681d720ed6aa5e302a6634fa25e7d561bf7e06e8`. Its state does not migrate to a newly deployed contract.

## Architecture

Legacy rounds default to `funding_model: creator`. Only the creator funds them and withdraws unused budget. New `funding_model: community` rounds accept payable deposits from up to 80 distinct transaction senders. Repeat deposits aggregate in the same ledger row. At lock, the total budget and sponsor ledger become immutable because subsequent funding is rejected. Review, challenges, contributor caps and allocation use the existing contract path.

At finalization, let `R` be the unused budget, `cᵢ` each sponsor's contribution and `T` the frozen total. Each sponsor first receives `floor(R × cᵢ / T)`. The remaining `R − sum(floors)` units go to the largest fractional remainders, ties broken by ascending wallet address. The partition is integer only, bounded, independent of withdrawal order, and sums to exactly `R`. Canceled community rounds give each sponsor their entire deposit back. Withdrawals require the sender's own ledger row and settled status; the ledger is updated before the transfer. Legacy creator withdrawal explicitly rejects community rounds.

The settled accounting view exposes contributor allocations and claims, sponsor entitlements and withdrawals, and remaining liabilities. The intended invariant is `funded = contributor_allocations + sponsor_refund_entitlements` and `funded = contributor_claimed + sponsor_refunds_withdrawn + reserved_outstanding`. The `contract_balance` runtime field is diagnostic and is not used to decide entitlements.

## Verification status

The [GitHub Actions run](https://github.com/BeatyXO/Bibet/actions/runs/38129824794) passed all four jobs: 23 Direct Mode tests, 63 contract static checks, 13 allocation vectors, three isolated sponsor partition tests, six receipt cases, GenVM lint, TypeScript typecheck, ESLint, and production build. On this Windows machine, GenVM SDK validation and Direct Mode fixture setup could not load the pinned runner archive; the Linux CI runner successfully cached it and ran the complete suite. The repository-local GenLayer CLI reports version `0.39.1`. Contract source SHA-256 is `FC51F64186393BE43EAC159991A9DE93A622D98024E24971838428F439FA3B88`.

The production dependency tree reports zero npm advisories after upgrading Next.js to `16.4.0` and applying compatible lockfile fixes. Development dependencies still report advisories through the pinned GenLayer CLI and ESLint dependency tree; npm's offered force fix would downgrade the required CLI and is not applied.

No upgraded contract has been deployed. There are no new sponsor transactions, refunds, source parity proof, or production frontend deployment to cite. The currently configured frontend contract address still points to the legacy deployment and must be updated only after a verified new deployment. Community round creation is explicitly blocked on that legacy contract by a protocol-version read. A temporary isolated GitHub login was used for branch delivery; the preexisting GitHub configurations are unchanged. This checkout contains no deployment wallet environment file. Per the owner's latest direction, no direct Vercel action is taken. The existing GitHub integration automatically produced a PR preview; it is not a production deployment or a community funding proof.

## Release gates

| Gate | Status | Evidence or next action |
|---|---|---|
| G1 Original project preserved | PASS | Clone and branch retain original history; starting SHA above. |
| G2 Multiple sponsors fund a round | FAIL | Distinct Direct Mode senders passed; live wallets pending. |
| G3 Immutable lock snapshot | PASS | Direct Mode rejects deposits after lock. |
| G4 Review lifecycle preserved | PASS | Existing Direct Mode review and challenge regressions pass. |
| G5 Contributor allocation math | PASS | 13 allocation vectors and Direct Mode regressions pass. |
| G6 Exact sponsor refunds | FAIL | Partition vectors and all-refund Direct Mode case pass; a partial-allocation community round remains untested. |
| G7 Unauthorized/double withdrawals | FAIL | Canceled-round authorization and repeat-withdrawal checks pass; finalized refund adversarial cases remain. |
| G8 Original behavior | PASS | Legacy Direct Mode settlement and lifecycle regressions pass. |
| G9 Adversarial contract tests | FAIL | 23 Direct Mode tests pass; the milestone's full requested adversarial matrix remains incomplete. |
| G10 Frontend checks | PASS | Typecheck, ESLint, build and receipt cases passed locally. |
| G11 Contract deployment | EXTERNALLY BLOCKED | Authorized deployment wallet unavailable; deploy after contract validation. |
| G12 Live multi-sponsor lifecycle | EXTERNALLY BLOCKED | Requires verified deployment and two funded wallets. |
| G13 Live refunds | EXTERNALLY BLOCKED | Requires G12. |
| G14 Production frontend | EXTERNALLY BLOCKED | Owner requested GitHub-only delivery; G11 is also pending. |
| G15 GitHub CI | PASS | All four jobs passed in the linked GitHub Actions run. |
| G16 Immutable comparison | EXTERNALLY BLOCKED | Accepted baseline SHA unavailable and no final release SHA. |

These statuses describe the current branch, not a completed release. No Portal submission should claim this milestone as complete yet.
