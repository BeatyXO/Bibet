import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { BIBET_CONTRACT } from "../lib/config";

type Hex = `0x${string}`;
type Value = string | number | boolean | bigint | null | Value[] | { [key: string]: Value };
const creatorKey = process.env.BIBET_CREATOR_PK as Hex | undefined;
const sponsorKey = process.env.BIBET_SPONSOR_PK as Hex | undefined;
const proofRoundId: string = process.env.BIBET_PROOF_ROUND_ID ?? "";
if (!creatorKey || !sponsorKey || !proofRoundId) throw new Error("Set proof keys and BIBET_PROOF_ROUND_ID in the environment.");
const creator = createAccount(creatorKey);
const sponsor = createAccount(sponsorKey);
const client = createClient({ chain: studionet, account: creator });

function decoded(raw: unknown): Value {
  return typeof raw === "string" ? JSON.parse(raw || "null") as Value : raw as Value;
}

async function read(method: string, args: Value[] = []) {
  return decoded(await client.readContract({ address: BIBET_CONTRACT, functionName: method, args }));
}

async function write(label: string, account: ReturnType<typeof createAccount>, method: string, args: Value[] = []) {
  const hash = await client.writeContract({ account, address: BIBET_CONTRACT, functionName: method, args, value: 0n, consensusMaxRotations: 8 });
  console.log(`${label} transaction: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, interval: 5_000, retries: 120 });
  const status = receipt.statusName ?? receipt.status;
  const result = receipt.resultName ?? receipt.result;
  console.log(`${label}: ${String(status)} / ${String(result)}`);
  if (!((status === "ACCEPTED" || status === 5) && (result === "MAJORITY_AGREE" || result === 6))) return false;
  return true;
}

async function waitUntil(label: string, timestamp: string) {
  const delay = Date.parse(timestamp) - Date.now() + 2_000;
  if (delay > 0) {
    console.log(`Waiting ${Math.ceil(delay / 1000)}s for ${label}.`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function main() {
  const round = await read("get_round", [proofRoundId]) as { config: { review_deadline_at: string; challenge_deadline_at: string }; verdicts: Record<string, unknown> };
  let verdict = round.verdicts?.["1"];
  if (!verdict) {
    const accepted = await write("retry impact review", creator, "request_impact_review", [proofRoundId, "1"]);
    if (accepted) verdict = await read("get_verdict", [proofRoundId, "1"]);
  }
  if (!verdict) {
    await waitUntil("review deadline", round.config.review_deadline_at);
    if (!(await write("expire unreviewed claim", creator, "expire_unreviewed_claim", [proofRoundId, "1"]))) {
      throw new Error("Could not record the defined unreviewed-claim expiry fallback.");
    }
    verdict = await read("get_verdict", [proofRoundId, "1"]);
  }
  console.log("Final claim verdict:");
  console.log(JSON.stringify(verdict, null, 2));

  await waitUntil("challenge deadline", round.config.challenge_deadline_at);
  if (!(await write("finalize proof round", creator, "finalize_round", [proofRoundId]))) throw new Error("Round finalization failed.");
  const afterledger = await read("get_afterledger", [proofRoundId]);
  console.log("Finalized afterledger:");
  console.log(JSON.stringify(afterledger, null, 2));
  const allocation = await read("get_allocation", [proofRoundId, "1"]) as Record<string, unknown>;
  if (allocation.status === "PENDING" && BigInt(String(allocation.amount)) > 0n) {
    if (!(await write("claim contributor allocation", sponsor, "claim_allocation", [proofRoundId, "1"]))) throw new Error("Allocation claim failed.");
  }
  const ledger = await read("list_sponsors", [proofRoundId, "0", "20"]) as { sponsors?: Array<{ address: string; refund: string; withdrawn: string }> };
  for (const item of ledger.sponsors ?? []) {
    if (BigInt(item.refund) > BigInt(item.withdrawn)) {
      const account = item.address.toLowerCase() === creator.address.toLowerCase() ? creator : sponsor;
      if (!(await write(`withdraw sponsor refund ${item.address}`, account, "withdraw_sponsor_refund", [proofRoundId]))) throw new Error("Sponsor refund withdrawal failed.");
    }
  }
  console.log("Settled sponsor ledger:");
  console.log(JSON.stringify(await read("list_sponsors", [proofRoundId, "0", "20"]), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
