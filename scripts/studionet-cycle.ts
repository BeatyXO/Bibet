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

async function write(label: string, account: ReturnType<typeof createAccount>, functionName: string, args: CalldataValue[] = [], value = 0n) {
  const hash = await client.writeContract({
    account,
    address: BIBET_CONTRACT,
    functionName,
    args,
    value,
    consensusMaxRotations: 3,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    interval: 5_000,
    retries: 90,
  });
  txs.push({ label, hash, status: receipt.statusName ?? receipt.status, result: receipt.resultName ?? receipt.result });
  console.log(`${label}: ${hash} status=${receipt.statusName ?? receipt.status} result=${receipt.resultName ?? receipt.result}`);
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

const roundConfig = {
  title: "BIBET live public-goods evidence round",
  round_type: "retroactive_public_goods",
  historical_window: "2024-01-01/2026-08-01",
  rubric: ["reach", "depth", "durability", "additionality", "public_good_fit"],
  policy_version: "bibet-studionet-v1",
  max_share_bps: 10_000,
};

const claim = {
  artifact_id: "oss-docs-public-health-index-2026",
  title: "Open public-health documentation index",
  completion_date: "2026-07-18",
  contributor_name: "BIBET integration contributor",
  impact_statement:
    "A completed open documentation index that helps community clinics locate public-health references faster and reuse the material without paywalls.",
  evidence_urls: ["https://example.com/"],
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

  await write("deterministic create_round", creator, "create_round", [JSON.stringify(roundConfig)]);
  const round = await read("get_round", ["1"]);
  if (round.status !== "DRAFT") throw new Error(`Expected DRAFT, got ${round.status}`);

  await write("payable fund_round", creator, "fund_round", ["1"], oneGen / 1000n);
  await write("deterministic lock_round", creator, "lock_round", ["1"]);
  await write("deterministic submit_trace_claim", contributor, "submit_trace_claim", ["1", JSON.stringify(claim)]);
  await write("deterministic update_claim_before_close", contributor, "update_claim_before_close", ["1", "1", JSON.stringify(claimUpdate)]);
  await write("deterministic close_applications", creator, "close_applications", ["1"]);

  await write("nondeterministic request_impact_review", creator, "request_impact_review", ["1", "1"]);
  const verdict = await read("get_verdict", ["1", "1"]);
  if (!verdict.normalized_impact_score && verdict.normalized_impact_score !== 0) {
    throw new Error("Verdict missing normalized_impact_score");
  }

  await write(
    "deterministic open_challenge",
    challenger,
    "open_challenge",
    ["1", "1", "evidence_quality", "Challenge whether a single source is sufficient for durable public-good impact."],
  );
  await write(
    "deterministic respond_to_challenge",
    contributor,
    "respond_to_challenge",
    ["1", "1", "The trace describes a completed open reference index; the evidence URL is intentionally simple for Studionet smoke testing."],
  );
  await write("deterministic resolve_challenge", creator, "resolve_challenge", ["1", "1", false, "Rejected for live smoke test; evidence remains reviewable."]);
  await write("deterministic finalize_round", creator, "finalize_round", ["1"]);

  const afterledger = await read("get_afterledger", ["1"]);
  if (afterledger.round.status !== "FINALIZED") {
    throw new Error(`Expected FINALIZED, got ${afterledger.round.status}`);
  }

  const allocation = await read("get_allocation", ["1", "1"]);
  if (allocation.status === "PENDING") {
    await write("settlement claim_allocation", contributor, "claim_allocation", ["1", "1"]);
  } else {
    console.log(`settlement claim_allocation skipped: allocation status=${allocation.status ?? "none"}`);
  }

  await write(
    "deterministic create_cancel_round",
    creator,
    "create_round",
    [JSON.stringify({ ...roundConfig, title: "BIBET cancellation smoke round" })],
  );
  await write("deterministic cancel_unopened_round", creator, "cancel_unopened_round", ["2"]);

  console.log("Afterledger:");
  console.log(JSON.stringify(await read("get_afterledger", ["1"]), null, 2));
  console.log("Transactions:");
  console.log(JSON.stringify(txs, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
