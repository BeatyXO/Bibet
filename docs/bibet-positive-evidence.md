# BIBET positive StudioNet evidence

This document is intentionally concise public evidence for BIBET validators.

Artifact: BIBET hardened GenLayer retroactive public-goods funding protocol and frontend.

Repository: https://github.com/BeatyXO/Bibet

Public app: https://bibet-eight.vercel.app/

Completion date: 2026-08-31.

Public-good output:

- A GenLayer intelligent contract for retroactive public-goods funding.
- Deterministic round, claim, challenge, allocation, settlement, refund, and afterledger logic.
- Nondeterministic GenLayer writes for impact review and challenge adjudication.
- Historical eligibility enforcement: claim `completion_date` must be ISO `YYYY-MM-DD` and inside the configured `historical_window`.
- Challenge finalization guard: creators cannot finalize until the configured `challenge_deadline_at` has passed and unresolved challenges are adjudicated.
- Real `genlayer-test` Direct Mode pytest coverage for lifecycle behavior, permissions, duplicate artifacts, challenge race, validator agreement/disagreement/tolerance, insufficient evidence, and settlement invariants.
- A routed Next.js frontend with injected wallet and browser wallet modes, round creation deadlines, live round discovery, afterledger reading, and lifecycle write controls.
- GitHub Actions CI with Python setup, `pytest tests/direct -v`, GenVM contract check, TypeScript, ESLint, allocation vectors, and production build.

Primary files:

- `contracts/bibet.py` contains the intelligent contract.
- `tests/direct/test_bibet_direct.py` contains real Direct Mode Python contract tests.
- `.github/workflows/ci.yml` contains CI.
- `components/round-detail.tsx` contains lifecycle action controls.
- `components/start-round-form.tsx` contains round creation and deadline configuration.

Impact claim:

BIBET gives public-goods contributors and funders an auditable retroactive funding workflow where evidence review happens through GenLayer validators, while money movement remains deterministic and capped. The artifact is reusable open-source infrastructure for GenLayer builders who need a practical example of intelligent-contract review boundaries, afterledger transparency, and CI-friendly Direct Mode testing.
