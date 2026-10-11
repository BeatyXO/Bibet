# Community-Funded Rounds — implementation record

## Provenance

The clone began at `de47a890b5d489c122dcbf7b58208c211148dafa` on `main` from `https://github.com/BeatyXO/Bibet`. The owner confirmed this pre-work commit as the accepted baseline. The immutable local comparison is `de47a890b5d489c122dcbf7b58208c211148dafa...HEAD`; it covers the complete implementation branch. The previous creator-funded contract remains at `0x3F3F320e9767c6Ac9b8c418c3d7FB416B740c4Cf` (deployment transaction `0xc592015876993c82f5a352fb681d720ed6aa5e302a6634fa25e7d561bf7e06e8`); its state does not migrate. The community-funded contract is now deployed on StudioNet at [`0xD9e257C0659afe75ff55c76dB76971B3f1bA2FFD`](https://explorer-studio.genlayer.com/contracts/0xD9e257C0659afe75ff55c76dB76971B3f1bA2FFD), transaction [`0xd0a577a6dc95600181b0199c3936969188d1b3e9354c4254bc01769be592e81e`](https://explorer-studio.genlayer.com/transactions/0xd0a577a6dc95600181b0199c3936969188d1b3e9354c4254bc01769be592e81e). Its `get_protocol_version()` returns `community-funded-v1`; fetched on-chain code matched the deployed source.

## Architecture

Legacy rounds default to `funding_model: creator`. Only the creator funds them and withdraws unused budget. New `funding_model: community` rounds accept payable deposits from up to 80 distinct transaction senders. Repeat deposits aggregate in the same ledger row. At lock, the total budget and sponsor ledger become immutable because subsequent funding is rejected. Review, challenges, contributor caps and allocation use the existing contract path.

At finalization, let `R` be the unused budget, `cᵢ` each sponsor's contribution and `T` the frozen total. Each sponsor first receives `floor(R × cᵢ / T)`. The remaining `R − sum(floors)` units go to the largest fractional remainders, ties broken by ascending wallet address. The partition is integer only, bounded, independent of withdrawal order, and sums to exactly `R`. Canceled community rounds give each sponsor their entire deposit back. Withdrawals require the sender's own ledger row and settled status; the ledger is updated before the transfer. Legacy creator withdrawal explicitly rejects community rounds.

The settled accounting view exposes contributor allocations and claims, sponsor entitlements and withdrawals, and remaining liabilities. The intended invariant is `funded = contributor_allocations + sponsor_refund_entitlements` and `funded = contributor_claimed + sponsor_refunds_withdrawn + reserved_outstanding`. The `contract_balance` runtime field is diagnostic and is not used to decide entitlements.

## Verification status

The [latest mainline GitHub Actions run](https://github.com/BeatyXO/Bibet/actions/runs/38173614663) for release commit `e6176b7f40b0484b0e8f92574cc792aa9f0ade32` passed all four jobs: Direct Mode, contract lint, frontend, and regression. The local Direct Mode suite passes with the pinned GenVM version (25 passed); regression covers 13 allocation vectors, static checks, receipt cases, and refund partition tests. Local TypeScript, ESLint, wallet startup-state tests, and production build pass with the new CA default. The repository-local GenLayer CLI is `0.39.1`. Deployed contract source SHA-256: `FC51F64186393BE43EAC159991A9DE93A622D98024E24971838428F439FA3B88`.

The production dependency tree reports zero npm advisories. Development dependencies still report advisories through the pinned GenLayer CLI and ESLint dependency tree; npm's offered force fix would downgrade the required CLI and is not applied.

### Live StudioNet community-round proof

Round `2` on the deployed CA was funded by two distinct addresses with `0.1 GEN` each (`0.2 GEN` total), locked, and given a source-backed claim. Deterministic writes were accepted by majority consensus. The claim review was attempted twice; both transactions ended `UNDETERMINED / MAJORITY_DISAGREE`, so no validator verdict was fabricated. The contract's review-deadline fallback recorded `INSUFFICIENT_EVIDENCE` / `EXPIRED`, score `0`; finalization recorded a zero allocation and the full `0.2 GEN` refund entitlement.

- Create round: [`0x2e8ade43e8e8a4173e472f70970787b6e0e09dad2de9d36685975cb5f7632561`](https://explorer-studio.genlayer.com/transactions/0x2e8ade43e8e8a4173e472f70970787b6e0e09dad2de9d36685975cb5f7632561)
- Sponsor deposits: [`0xb9b5439aacf90619dfa4bca8a208b2837eeae5067e9e4f63b45e44f3015a3bb5`](https://explorer-studio.genlayer.com/transactions/0xb9b5439aacf90619dfa4bca8a208b2837eeae5067e9e4f63b45e44f3015a3bb5) and [`0x1f53f3ca7899b068b51286a732bf3799f8b290288bf78a454a95e91e78696128`](https://explorer-studio.genlayer.com/transactions/0x1f53f3ca7899b068b51286a732bf3799f8b290288bf78a454a95e91e78696128)
- Lock: [`0xaecc28eb5bf5289317c4562eb12552fd6f48a4979b4db1f65d4c1373f8d6b1cd`](https://explorer-studio.genlayer.com/transactions/0xaecc28eb5bf5289317c4562eb12552fd6f48a4979b4db1f65d4c1373f8d6b1cd)
- Submit claim: [`0x5f5a1d77cd1be9087f4acdf862fc464ee92a5ae55d7d5b4176b2f6c1bd4458ef`](https://explorer-studio.genlayer.com/transactions/0x5f5a1d77cd1be9087f4acdf862fc464ee92a5ae55d7d5b4176b2f6c1bd4458ef)
- Close applications: [`0x5ee8cb614b6ef729472dc47ba2cfe7f3160c197a76b66805adfa881967d88bc6`](https://explorer-studio.genlayer.com/transactions/0x5ee8cb614b6ef729472dc47ba2cfe7f3160c197a76b66805adfa881967d88bc6)
- Review retry (majority disagreement): [`0x4e367a18484e487cb1e2793388b036c7678ab951b8759dd507581c5d5042a171`](https://explorer-studio.genlayer.com/transactions/0x4e367a18484e487cb1e2793388b036c7678ab951b8759dd507581c5d5042a171)
- Expiry verdict: [`0x9103ac0c00a40826c1495ac450f86153d983fdc47d2eda4ca110c3d356fadecd`](https://explorer-studio.genlayer.com/transactions/0x9103ac0c00a40826c1495ac450f86153d983fdc47d2eda4ca110c3d356fadecd)
- Finalize: [`0x89e87413774b2f5e8f883691c3bfb362cb5d6ddac4cdcf03290aee287c4e81a9`](https://explorer-studio.genlayer.com/transactions/0x89e87413774b2f5e8f883691c3bfb362cb5d6ddac4cdcf03290aee287c4e81a9)
- Sponsor refunds: [`0x8d10b6e7925d1ff9ce671bc1cf713b377ee07bc3c7bf9611d0a7214a28a8b5ac`](https://explorer-studio.genlayer.com/transactions/0x8d10b6e7925d1ff9ce671bc1cf713b377ee07bc3c7bf9611d0a7214a28a8b5ac) and [`0x4607c80fdeb4ebfcce17de8e5abbcedc2e8e8a3c60773aefc8ee53156810a859`](https://explorer-studio.genlayer.com/transactions/0x4607c80fdeb4ebfcce17de8e5abbcedc2e8e8a3c60773aefc8ee53156810a859)

The final ledger shows two sponsors, each deposited/refunded/withdrew `0.1 GEN`; `funded_budget = sponsor_refunds_withdrawn = 0.2 GEN`, with zero allocation and zero outstanding reserve. The repeatable scripts are `scripts/studionet-community-proof.ts` and `scripts/studionet-settle-proof.ts`.

The frontend default points to the new CA. The production frontend is live at [bibet-eight.vercel.app](https://bibet-eight.vercel.app/); releases are delivered through the repository's GitHub integration, with no direct Vercel dashboard changes.

## Release gates

| Gate | Status | Evidence or next action |
|---|---|---|
| G1 Original project preserved | PASS | Clone and branch retain original history; starting SHA above. |
| G2 Multiple sponsors fund a round | PASS | Distinct Direct Mode and live wallet sponsors funded one round. |
| G3 Immutable lock snapshot | PASS | Direct Mode rejects deposits after lock. |
| G4 Review lifecycle preserved | PASS | Existing Direct Mode review and challenge regressions pass. |
| G5 Contributor allocation math | PASS | 13 allocation vectors and Direct Mode regressions pass. |
| G6 Exact sponsor refunds | PASS | Partition vectors, all-refund cancellation, and partial-allocation proportional refunds pass in Direct Mode. |
| G7 Unauthorized/double withdrawals | PASS | Direct Mode proves pre-settlement denial, outsider denial, creator/sponsor ownership, independent sponsor claims, and repeated-withdrawal denial for canceled and finalized refunds. |
| G8 Original behavior | PASS | Legacy Direct Mode settlement and lifecycle regressions pass. |
| G9 Adversarial contract tests | PARTIAL | 25 Direct Mode tests pass, including sponsor-cap/pagination and refund entitlement state checks. Full requested matrix and mutation testing are not complete; Direct Mode does not yet simulate a recipient transfer failure to prove rollback under that failure mode. |
| G10 Frontend checks | PASS | Typecheck, ESLint, build, wallet startup-state tests and receipt cases passed locally; production routes, live ledger/detail, form controls, wallet modal, and safe lifecycle-control states were manually checked in Chrome. Wallet write transactions were not submitted as part of UI QA. |
| G11 Contract deployment | PASS | Deployed CA and on-chain source parity verified; protocol version is `community-funded-v1`. |
| G12 Live multi-sponsor lifecycle | PASS WITH LIMITATION | Two sponsors funded/locked; review attempt timed out by majority disagreement, then contract expiry fallback finalized. No positive allocation proof. |
| G13 Live refunds | PASS | Both sponsors withdrew exact `0.1 GEN` refunds; ledger liabilities are zero. |
| G14 Production frontend | PASS | Production is live at [bibet-eight.vercel.app](https://bibet-eight.vercel.app/) and uses the community-funded CA. Changes are delivered through GitHub integration, without direct Vercel dashboard changes. |
| G15 GitHub CI | PASS | All four jobs passed for final mainline release commit `e6176b7f40b0484b0e8f92574cc792aa9f0ade32` in [GitHub Actions](https://github.com/BeatyXO/Bibet/actions/runs/38173614663). |
| G16 Immutable comparison | PASS | Owner-confirmed baseline `de47a890b5d489c122dcbf7b58208c211148dafa`; immutable comparison: [baseline to final release](https://github.com/BeatyXO/Bibet/compare/de47a890b5d489c122dcbf7b58208c211148dafa...e6176b7f40b0484b0e8f92574cc792aa9f0ade32). |

The deployment, funded refund path, production frontend, accepted-baseline comparison, and deterministic release gates are evidenced. Do not claim a positive validator impact decision: the live semantic review did not reach consensus and the fallback verdict was insufficient evidence. The broad adversarial suite is not yet the complete requested matrix; recipient-transfer failure rollback simulation and mutation testing remain incomplete.

## Frontend wallet and manual QA

The production UI was manually checked in Chrome for route navigation (`/`, `/rounds`, `/rounds/1`, `/rounds/2`, `/start`, `/how`, `/audit`), live ledger refresh and detail links, wallet modal open/close, form funding-model selection, GEN amount precision/validation, and the lifecycle controls' state/disabled reasons. The red wrong-network notice is an action that asks the injected wallet to switch to StudioNet, adding the chain if needed. Its EIP-1193 fallback was verified with a mocked provider; the live wallet was already on StudioNet during browser QA, so the red state could not be reproduced without changing the user's wallet network.

The wallet startup fix initializes state from read-only `eth_accounts` and `eth_chainId` requests after page load, so an already-authorized account is restored after refresh and a wrong-network notice is shown. `npm run test:wallet` covers connected, disconnected, and wrong-network startup states. After the GitHub merge and production deployment, a Chrome refresh restored the connected account on `/rounds/2` and loaded the live afterledger. No write transaction was initiated or signed during frontend QA. Wallet write actions still require the user to review and approve them in the injected wallet.

## Portal submission draft

**Description (under 1,000 characters):**

> BIBET Community-Funded Rounds extends the retroactive public-goods protocol so multiple wallets can sponsor one reward round. Sponsor deposits are sender-attributed and frozen at lock; unused GEN is divided by integer proportional shares, with largest-remainder refunds and wallet-address tie-breaks. The upgraded CA is deployed on StudioNet, and two independent sponsors funded, locked, and recovered their full deposits after the live evidence review missed consensus and the contract recorded its insufficient-evidence expiry fallback. The production frontend is live at bibet-eight.vercel.app and uses the upgraded CA. The full refund ledger and CI evidence are linked in the implementation record. No positive impact verdict is claimed.

**Evidence URLs:** [final release commit](https://github.com/BeatyXO/Bibet/commit/e6176b7f40b0484b0e8f92574cc792aa9f0ade32), [passing mainline CI](https://github.com/BeatyXO/Bibet/actions/runs/38173614663), [community-round implementation PR](https://github.com/BeatyXO/Bibet/pull/1), [wallet network-switch PR](https://github.com/BeatyXO/Bibet/pull/2), [wallet reload and documentation PR](https://github.com/BeatyXO/Bibet/pull/3), [accepted-baseline comparison](https://github.com/BeatyXO/Bibet/compare/de47a890b5d489c122dcbf7b58208c211148dafa...e6176b7f40b0484b0e8f92574cc792aa9f0ade32), [deployed CA](https://explorer-studio.genlayer.com/contracts/0xD9e257C0659afe75ff55c76dB76971B3f1bA2FFD), [deployment transaction](https://explorer-studio.genlayer.com/transactions/0xd0a577a6dc95600181b0199c3936969188d1b3e9354c4254bc01769be592e81e), [finalization proof](https://explorer-studio.genlayer.com/transactions/0x89e87413774b2f5e8f883691c3bfb362cb5d6ddac4cdcf03290aee287c4e81a9), and [production frontend](https://bibet-eight.vercel.app/).
