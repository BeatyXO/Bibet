import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { BIBET_CONTRACT } from "../lib/config";

type Hex = `0x${string}`;
type Value = string | number | boolean | bigint | null | Value[] | { [key: string]: Value };

const creatorKey = process.env.BIBET_CREATOR_PK as Hex | undefined;
const sponsorKey = process.env.BIBET_SPONSOR_PK as Hex | undefined;
if (!creatorKey || !sponsorKey) throw new Error("Proof wallet keys must be provided via BIBET_CREATOR_PK and BIBET_SPONSOR_PK.");

const creator = createAccount(creatorKey);
const sponsor = createAccount(sponsorKey);
const client = createClient({ chain: studionet, account: creator });
const gen = 1_000_000_000_000_000_000n;
const transactions: Array<{ label: string; hash: string }> = [];

function isoAfter(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function valueOf(raw: unknown): Value {
  return typeof raw === "string" ? JSON.parse(raw || "null") as Value : raw as Value;
}

async function write(label: string, account: ReturnType<typeof createAccount>, method: string, args: Value[] = [], value = 0n) {
  const hash = await client.writeContract({ account, address: BIBET_CONTRACT, functionName: method, args, value, consensusMaxRotations: 8 });
  const receipt = await client.waitForTransactionReceipt({ hash, interval: 5_000, retries: 120 });
  const status = receipt.statusName ?? receipt.status;
  const result = receipt.resultName ?? receipt.result;
  if (!(status === "ACCEPTED" || status === 5) || !(result === "MAJORITY_AGREE" || result === 6)) {
    throw new Error(`${label} failed consensus: status=${String(status)} result=${String(result)}`);
  }
  transactions.push({ label, hash });
  console.log(`${label}: ${hash} ACCEPTED / MAJORITY_AGREE`);
}

async function read(method: string, args: Value[] = []) {
  return valueOf(await client.readContract({ address: BIBET_CONTRACT, functionName: method, args }));
}

async function main() {
  console.log(`CA: ${BIBET_CONTRACT}`);
  console.log(`Creator/sponsor A: ${creator.address}`);
  console.log(`Sponsor B/contributor: ${sponsor.address}`);
  const before = Number(await read("get_round_count"));
  if (before > 0) {
    const lastRound = await read("get_round", [String(before)]) as { status?: string };
    if (lastRound.status === "DRAFT") await write("cancel abandoned empty setup round", creator, "cancel_unopened_round", [String(before)]);
  }
  const config = {
    title: "BIBET community-funded public goods proof",
    round_type: "retroactive_public_goods",
    historical_window: "2026-01-01/2026-10-11",
    rubric: ["reach", "depth", "durability", "additionality", "public_good_fit"],
    policy_version: "bibet-studionet-live-proof-v1",
    max_share_bps: 2500,
    funding_model: "community",
    application_close_after: isoAfter(2),
    review_deadline_at: isoAfter(10),
    challenge_deadline_at: isoAfter(12),
    finalization_deadline_at: isoAfter(12),
  };
  await write("create_round", creator, "create_round", [JSON.stringify(config)]);
  const roundId = String(Number(await read("get_round_count")));
  if (Number(roundId) !== before + 1) throw new Error(`Unexpected round id ${roundId}`);

  await write("creator sponsor deposit (0.1 GEN)", creator, "fund_round", [roundId], gen / 10n);
  await write("second sponsor deposit (0.1 GEN)", sponsor, "fund_round", [roundId], gen / 10n);
  await write("lock sponsor ledger", creator, "lock_round", [roundId]);

  const claim = {
    artifact_id: "bibet-community-funded-genlayer-contract",
    title: "Reusable community-funded GenLayer public goods protocol",
    completion_date: "2026-10-11",
    contributor_name: "BIBET integration contributor",
    impact_statement: "This public repository adds a reusable Studionet contract and app flow for community-funded retroactive public-goods rounds, including a capped sponsor ledger, deterministic pro-rata allocation, and sponsor pull refunds. The code and Direct Mode tests let other GenLayer builders inspect and adapt the flow. The evidence proves shipped code and tests and makes no claim about external adoption.",
    evidence_manifest: [
      { url: "https://raw.githubusercontent.com/BeatyXO/Bibet/843adc6c7d3791b67763649cbc07f23173762b3e/docs/community-funded-rounds.md", sha256: "513edb890096be16dbbfca2e2fa55a3ba95e589a3c94e510d0533bcb3e0d740a", content_type: "text/markdown", version: "commit-843adc6c7d3791b67763649cbc07f23173762b3e" },
      { url: "https://raw.githubusercontent.com/BeatyXO/Bibet/843adc6c7d3791b67763649cbc07f23173762b3e/contracts/bibet.py", sha256: "674b2f23154c922ef7f89a4b70aef106aad76ad2fef22508f830b023a96d5f3a", content_type: "text/x-python", version: "commit-843adc6c7d3791b67763649cbc07f23173762b3e" },
    ],
    trace_urls: ["https://github.com/BeatyXO/Bibet/commit/843adc6c7d3791b67763649cbc07f23173762b3e"],
    requested_tags: ["open-source", "genlayer", "public-goods", "retrofunding"],
  };
  await write("submit source-backed claim", sponsor, "submit_trace_claim", [roundId, JSON.stringify(claim)]);
  await write("close applications", creator, "close_applications", [roundId]);
  await write("request validator impact review", creator, "request_impact_review", [roundId, "1"]);
  const verdict = await read("get_verdict", [roundId, "1"]);
  console.log("Validator verdict:");
  console.log(JSON.stringify(verdict, null, 2));

  const challengeDeadline = Date.parse(config.challenge_deadline_at);
  const waitMs = challengeDeadline - Date.now() + 2_000;
  if (waitMs > 0) {
    console.log(`Waiting ${Math.ceil(waitMs / 1000)} seconds for challenge deadline.`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  await write("finalize round", creator, "finalize_round", [roundId]);
  const afterledger = await read("get_afterledger", [roundId]);
  console.log("Finalized afterledger:");
  console.log(JSON.stringify(afterledger, null, 2));

  const allocation = await read("get_allocation", [roundId, "1"]) as Record<string, unknown>;
  if (allocation.status === "PENDING" && BigInt(String(allocation.amount)) > 0n) {
    await write("claim contributor allocation", sponsor, "claim_allocation", [roundId, "1"]);
  }
  const sponsors = await read("list_sponsors", [roundId, "0", "20"]) as { sponsors?: Array<{ address: string; refund: string; withdrawn: string }> };
  for (const row of sponsors.sponsors ?? []) {
    if (BigInt(row.refund) > BigInt(row.withdrawn)) {
      const account = row.address.toLowerCase() === creator.address.toLowerCase() ? creator : sponsor;
      await write(`withdraw sponsor refund ${row.address}`, account, "withdraw_sponsor_refund", [roundId]);
    }
  }
  console.log("Final sponsor ledger:");
  console.log(JSON.stringify(await read("list_sponsors", [roundId, "0", "20"]), null, 2));
  console.log("Live proof complete:");
  console.log(JSON.stringify({ roundId, verdict, transactions }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
