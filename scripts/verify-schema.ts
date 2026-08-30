import { BIBET_CONTRACT } from "../lib/config";
import { execFileSync } from "node:child_process";

const required = [
  "create_round",
  "fund_round",
  "lock_round",
  "submit_trace_claim",
  "update_claim_before_close",
  "close_applications",
  "request_impact_review",
  "open_challenge",
  "respond_to_challenge",
  "resolve_challenge",
  "finalize_round",
  "claim_allocation",
  "withdraw_unallocated_budget",
  "cancel_unopened_round",
  "get_round_count",
  "get_round",
  "get_round_summary",
  "list_round_claims",
  "get_verdict",
  "get_allocation",
  "get_afterledger",
  "get_round_totals",
];

const output = execFileSync(`genlayer schema ${BIBET_CONTRACT}`, {
  encoding: "utf8",
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

const missing = required.filter((name) => !output.includes(name));
if (missing.length > 0) {
  throw new Error(`Missing methods in deployed schema: ${missing.join(", ")}`);
}

console.log(`Schema verified for ${BIBET_CONTRACT}`);
console.log(required.join("\n"));
