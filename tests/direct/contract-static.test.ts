import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("contracts/bibet.py", "utf8");

const required = [
  "def get_round_count",
  "def get_round_summary",
  "def list_rounds",
  "def permissionless_advance",
  "def adjudicate_challenge",
  "def withdraw_unallocated_budget",
  "def expire_unreviewed_claim",
  "def _canonical_config",
  "def _canonical_claim",
  "def _canonical_verdict",
  "def _derived_score",
  "def _evidence_items",
  "def _fetch_evidence",
  "def _valid_http_url",
  "def _round_totals_dict",
  "MAX_CLAIMS = 80",
  "MAX_EVIDENCE_URLS = 5",
  "MAX_CHALLENGES = 80",
  "EXPECTED_CHALLENGE_REPLAY",
  "EXPECTED_REVIEW_ALREADY_FINAL",
  "EXPECTED_REVIEW_IN_PROGRESS",
  "EXPECTED_APPLICATION_DEADLINE",
  "EXPECTED_FINALIZATION_DEADLINE",
  "EXPECTED_COMPLETE_DEADLINES",
  "EXPECTED_REVIEW_DEADLINE",
  "EXPECTED_BAD_DEADLINE_ORDER",
  "EXPECTED_BAD_COMPLETION_DATE",
  "EXPECTED_PUBLIC_EVIDENCE_URL",
  "EXPECTED_UNSUPPORTED_CLAIM_FIELD",
  "EXPECTED_IMMUTABLE_ARTIFACT",
  "EXPECTED_RESOLVED_CHALLENGES",
  "EXPECTED_REVIEWED_CLAIM",
  "EXPECTED_NO_UNALLOCATED_BUDGET",
  "EXPECTED_UNCLAIMED_ALLOCATION",
  "EXPECTED_CANCELABLE_ROUND",
  "EXPECTED_BUDGET_REQUIRED",
  "EXPECTED_DEPOSIT_REQUIRED",
  "EXPECTED_ROUND_NOT_OPEN",
  "EXPECTED_CREATOR_ONLY",
  "EXPECTED_CONTRIBUTOR_ONLY",
  "EXPECTED_HTTP_EVIDENCE_URL",
  "EXPECTED_DUPLICATE_EVIDENCE_URL",
  "DIGEST_MISMATCH",
  "expected_sha256",
  "INSUFFICIENT_EVIDENCE rather than guessing",
  "status\": \"UNAVAILABLE\"",
  "CONTRADICTORY",
  "SCORE_TOLERANCE",
  "short_reason max 260 chars and is not consensus-critical",
  "unallocated_budget",
  "unallocated_withdrawn",
  "verdict_history",
  "challenger_evidence_urls",
  "challenged_verdict",
  "verdict_version",
  "appeal_result",
  "refundable_amount",
  "funded_budget",
  "allocated_amount",
  "claimed_amount",
];

for (const item of required) assert(source.includes(item), `Missing contract hardening marker: ${item}`);
assert(!source.includes("rows[best][\"amount\"]"), "Old unsafe remainder distribution pattern should not exist");
assert(source.includes("_equivalent_verdict(leader_verdict, other_verdict)"), "Consensus equivalence must compare validator verdicts");
assert(!source.includes("def resolve_challenge"), "Creator-controlled semantic challenge resolution must not exist");
assert(!source.includes("completed open-source GenLayer project"), "Reviewer prompt must not hardcode a project-specific eligibility shortcut");

console.log(`${required.length + 3} direct contract static tests passed`);
