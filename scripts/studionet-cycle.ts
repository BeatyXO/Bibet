import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { BIBET_CONTRACT } from "../lib/config";

type Hex = `0x${string}`;
type CalldataValue = string | number | boolean | bigint | null | CalldataValue[] | { [key: string]: CalldataValue };

const creatorKey = process.env.BIBET_CREATOR_PK as Hex | undefined;
const contributorKey = process.env.BIBET_CONTRIBUTOR_PK as Hex | undefined;
const challengerKey = process.env.BIBET_CHALLENGER_PK as Hex | undefined;

if (!creatorKey || !contributorKey || !challengerKey) {
  throw new Error("Set BIBET_CREATOR_PK, BIBET_CONTRIBUTOR_PK, and BIBET_CHALLENGER_PK before running this test.");
}

const creator = createAccount(creatorKey);
const contributor = createAccount(contributorKey);
const challenger = createAccount(challengerKey);
const client = createClient({ chain: studionet, account: creator });

const oneGen = 1_000_000_000_000_000_000n;
const txs: Array<{ label: string; hash: string; status?: unknown; result?: unknown }> = [];

function isoAfter(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function waitUntil(label: string, iso: string) {
  const ms = Date.parse(iso) - Date.now() + 2_000;
  if (ms > 0) {
    console.log(`Waiting ${Math.ceil(ms / 1000)}s for ${label}: ${iso}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function assertAccepted(label: string, receipt: { status?: unknown; statusName?: unknown; result?: unknown; resultName?: unknown }) {
  const status = receipt.statusName ?? receipt.status;
  const result = receipt.resultName ?? receipt.result;
  const accepted = status === "ACCEPTED" || status === 5 || String(status).toUpperCase() === "ACCEPTED";
  const agreed = result === "MAJORITY_AGREE" || result === 6 || String(result).toUpperCase() === "MAJORITY_AGREE";

  if (!accepted || !agreed) {
    throw new Error(`${label} was not accepted by GenLayer consensus: status=${String(status)} result=${String(result)}`);
  }
}

async function write(label: string, account: ReturnType<typeof createAccount>, functionName: string, args: CalldataValue[] = [], value = 0n) {
  const hash = await client.writeContract({
    account,
    address: BIBET_CONTRACT,
    functionName,
    args,
    value,
    consensusMaxRotations: 8,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    interval: 5_000,
    retries: 90,
  });
  txs.push({ label, hash, status: receipt.statusName ?? receipt.status, result: receipt.resultName ?? receipt.result });
  console.log(`${label}: ${hash} status=${receipt.statusName ?? receipt.status} result=${receipt.resultName ?? receipt.result}`);
  assertAccepted(label, receipt);
  return receipt;
}

async function read(functionName: string, args: CalldataValue[] = []) {
  const raw = await client.readContract({
    address: BIBET_CONTRACT,
    functionName,
    args,
  });
  return typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
}

async function readCount() {
  const raw = await client.readContract({
    address: BIBET_CONTRACT,
    functionName: "get_round_count",
    args: [],
  });
  return Number(raw || 0);
}

const claim = {
  artifact_id: "oss-docs-public-health-index-2026",
  title: "Open public-health documentation index",
  completion_date: "2026-07-18",
  contributor_name: "BIBET integration contributor",
  impact_statement:
    "A completed open documentation index that helps community clinics locate public-health references faster and reuse the material without paywalls.",
  evidence_manifest: [{ url: "https://example.com/", sha256: "6f5635035f36ad500b4fc4ea0a2e2c2f6a5f6f8b6e7f7b4f7f3f7e7f7f7f7f7f" }],
  trace_urls: ["https://example.com/"],
  requested_tags: ["open-data", "public-health", "documentation"],
};

const claimUpdate = {
  impact_statement:
    "A completed open documentation index that helps community clinics locate public-health references faster, reuse the material without paywalls, and audit the source trail.",
  trace_urls: ["https://example.com/"],
};

async function main() {
  console.log(`Contract: ${BIBET_CONTRACT}`);
  console.log(`Creator: ${creator.address}`);
  console.log(`Contributor: ${contributor.address}`);
  console.log(`Challenger: ${challenger.address}`);

  const before = await readCount();
  const deadlines = {
    application_close_after: isoAfter(45),
    review_deadline_at: isoAfter(120),
    challenge_deadline_at: isoAfter(180),
    finalization_deadline_at: isoAfter(210),
  };
  const roundConfig = {
    title: "BIBET live public-goods evidence round",
    round_type: "retroactive_public_goods",
    historical_window: "2024-01-01/2026-08-01",
    rubric: ["reach", "depth", "durability", "additionality", "public_good_fit"],
    policy_version: "bibet-studionet-v1",
    max_share_bps: 2500,
    ...deadlines,
  };
  await write("deterministic create_round", creator, "create_round", [JSON.stringify(roundConfig)]);
  const roundId = String(await readCount());
  if (Number(roundId) !== before + 1) throw new Error(`Expected new round counter ${before + 1}, got ${roundId}`);
  const round = await read("get_round", [roundId]);
  if (round.status !== "DRAFT") throw new Error(`Expected DRAFT, got ${round.status}`);
  if (round.creator !== creator.address.toLowerCase()) throw new Error(`Expected creator ${creator.address}, got ${round.creator}`);

  await write("payable fund_round", creator, "fund_round", [roundId], oneGen / 1000n);
  await write("deterministic lock_round", creator, "lock_round", [roundId]);
  await write("deterministic submit_trace_claim", contributor, "submit_trace_claim", [roundId, JSON.stringify(claim)]);
  await write("deterministic update_claim_before_close", contributor, "update_claim_before_close", [roundId, "1", JSON.stringify({ ...claim, ...claimUpdate })]);
  await write("deterministic close_applications", creator, "close_applications", [roundId]);

  await write("nondeterministic request_impact_review", creator, "request_impact_review", [roundId, "1"]);
  const verdict = await read("get_verdict", [roundId, "1"]);
  if (!verdict.normalized_impact_score && verdict.normalized_impact_score !== 0) {
    throw new Error("Verdict missing normalized_impact_score");
  }

  await write(
    "deterministic open_challenge",
    challenger,
    "open_challenge",
    [roundId, "1", "evidence_quality", "Challenge whether a single source is sufficient for durable public-good impact.", JSON.stringify({ evidence_manifest: [{ url: "https://example.com/", sha256: "6f5635035f36ad500b4fc4ea0a2e2c2f6a5f6f8b6e7f7b4f7f3f7e7f7f7f7f7f" }] })],
  );
  await write(
    "deterministic respond_to_challenge",
    contributor,
    "respond_to_challenge",
    [roundId, "1", "The trace describes a completed open reference index; the evidence URL is intentionally simple for Studionet smoke testing."],
  );
  await write("nondeterministic adjudicate_challenge", challenger, "adjudicate_challenge", [roundId, "1"]);
  await waitUntil("challenge deadline", deadlines.challenge_deadline_at);
  await write("deterministic finalize_round", creator, "finalize_round", [roundId]);

  const afterledger = await read("get_afterledger", [roundId]);
  if (afterledger.round.status !== "FINALIZED") {
    throw new Error(`Expected FINALIZED, got ${afterledger.round.status}`);
  }

  const allocation = await read("get_allocation", [roundId, "1"]);
  if (allocation.status === "PENDING") {
    await write("settlement claim_allocation", contributor, "claim_allocation", [roundId, "1"]);
  } else {
    console.log(`settlement claim_allocation skipped: allocation status=${allocation.status ?? "none"}`);
  }
  const totals = await read("get_round_totals", [roundId]);
  if (Number(totals.refundable_amount) > 0) {
    await write("settlement withdraw_unallocated_budget", creator, "withdraw_unallocated_budget", [roundId]);
  }

  const beforeCancel = await readCount();
  await write(
    "deterministic create_cancel_round",
    creator,
    "create_round",
    [JSON.stringify({ ...roundConfig, title: "BIBET cancellation smoke round" })],
  );
  const cancelRoundId = String(await readCount());
  if (Number(cancelRoundId) !== beforeCancel + 1) throw new Error(`Expected cancel round counter ${beforeCancel + 1}, got ${cancelRoundId}`);
  await write("deterministic cancel_unopened_round", creator, "cancel_unopened_round", [cancelRoundId]);

  console.log("Afterledger:");
  console.log(JSON.stringify(await read("get_afterledger", [roundId]), null, 2));
  console.log("Transactions:");
  console.log(JSON.stringify(txs, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
