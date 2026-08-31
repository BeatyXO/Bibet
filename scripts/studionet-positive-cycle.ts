import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { BIBET_CONTRACT } from "../lib/config";

type Hex = `0x${string}`;
type CalldataValue = string | number | boolean | bigint | null | CalldataValue[] | { [key: string]: CalldataValue };

const creatorKey = process.env.BIBET_CREATOR_PK as Hex | undefined;
const contributorKey = process.env.BIBET_CONTRIBUTOR_PK as Hex | undefined;

if (!creatorKey || !contributorKey) {
  throw new Error("Set BIBET_CREATOR_PK and BIBET_CONTRIBUTOR_PK before running this test.");
}

const creator = createAccount(creatorKey);
const contributor = createAccount(contributorKey);
const client = createClient({ chain: studionet, account: creator });
const oneGen = 1_000_000_000_000_000_000n;
const txs: Array<{ label: string; hash: string; status?: unknown; result?: unknown }> = [];

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
    consensusMaxRotations: 3,
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

async function main() {
  console.log(`Contract: ${BIBET_CONTRACT}`);
  console.log(`Creator: ${creator.address}`);
  console.log(`Contributor: ${contributor.address}`);

  const before = await readCount();
  await write("positive create_round", creator, "create_round", [
    JSON.stringify({
      title: "BIBET positive evidence integration round",
      round_type: "retroactive_public_goods",
      historical_window: "2026-08-01/2026-09-30",
      rubric: ["reach", "depth", "durability", "additionality", "public_good_fit"],
      policy_version: "bibet-positive-studionet-v1",
      max_share_bps: 2500,
      application_close_after: "2026-01-01T00:00:00Z",
      review_deadline_at: "2026-01-01T00:10:00Z",
      challenge_deadline_at: "2026-01-01T00:20:00Z",
      finalization_deadline_at: "2026-01-01T00:30:00Z",
    }),
  ]);
  const roundId = String(await readCount());
  if (Number(roundId) !== before + 1) throw new Error(`Expected new round counter ${before + 1}, got ${roundId}`);

  await write("positive fund_round", creator, "fund_round", [roundId], oneGen / 1000n);
  await write("positive lock_round", creator, "lock_round", [roundId]);
  await write("positive submit_trace_claim", contributor, "submit_trace_claim", [
    roundId,
    JSON.stringify({
      artifact_id: "bibet-final-hardened-protocol-and-app",
      title: "BIBET hardened GenLayer funding protocol and frontend",
      completion_date: "2026-08-31",
      contributor_name: "BIBET integration contributor",
      impact_statement:
        "The BIBET repository contains a deployed GenLayer retroactive public-goods funding protocol with contract lifecycle controls, wallet-enabled frontend operations, Direct Mode tests, CI, and public evidence documentation.",
      evidence_urls: [
        "https://raw.githubusercontent.com/BeatyXO/Bibet/main/docs/bibet-positive-evidence.md",
        "https://raw.githubusercontent.com/BeatyXO/Bibet/main/contracts/bibet.py",
        "https://raw.githubusercontent.com/BeatyXO/Bibet/main/tests/direct/test_bibet_direct.py",
        "https://raw.githubusercontent.com/BeatyXO/Bibet/main/.github/workflows/ci.yml",
      ],
      trace_urls: [
        "https://github.com/BeatyXO/Bibet",
        "https://bibet-eight.vercel.app/",
      ],
      requested_tags: ["public-goods", "genlayer", "open-source", "retrofunding"],
    }),
  ]);
  await write("positive close_applications", creator, "close_applications", [roundId]);
  await write("positive request_impact_review", creator, "request_impact_review", [roundId, "1"]);

  const verdict = await read("get_verdict", [roundId, "1"]);
  console.log("Positive verdict:");
  console.log(JSON.stringify(verdict, null, 2));
  if (verdict.eligibility !== "ELIGIBLE" || Number(verdict.normalized_impact_score) <= 0) {
    throw new Error(`Expected ELIGIBLE positive verdict, got ${JSON.stringify(verdict)}`);
  }

  await write("positive finalize_round", creator, "finalize_round", [roundId]);
  const allocation = await read("get_allocation", [roundId, "1"]);
  console.log("Positive allocation:");
  console.log(JSON.stringify(allocation, null, 2));
  if (allocation.status !== "PENDING" || BigInt(allocation.amount) <= 0n) {
    throw new Error(`Expected positive pending allocation, got ${JSON.stringify(allocation)}`);
  }
  await write("positive claim_allocation", contributor, "claim_allocation", [roundId, "1"]);

  console.log("Positive afterledger:");
  console.log(JSON.stringify(await read("get_afterledger", [roundId]), null, 2));
  console.log("Transactions:");
  console.log(JSON.stringify(txs, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
