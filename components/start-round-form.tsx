"use client";

import { useState } from "react";
import { ArrowUpRight, ExternalLink, Plus } from "lucide-react";
import { createAccount, createClient } from "genlayer-js";
import { BIBET_CHAIN, BIBET_CONTRACT, explorerTx, readClient } from "../lib/config";
import { getGeneratedKey } from "../lib/wallet";
import { useWallet } from "./wallet-provider";

export function StartRoundForm() {
  const { address, mode, openWallet } = useWallet();
  const [roundTitle, setRoundTitle] = useState("");
  const [roundWindow, setRoundWindow] = useState("");
  const [roundBudget, setRoundBudget] = useState("");
  const [maxShareBps, setMaxShareBps] = useState("2500");
  const [applicationCloseAfter, setApplicationCloseAfter] = useState("");
  const [reviewDeadlineAt, setReviewDeadlineAt] = useState("");
  const [challengeDeadlineAt, setChallengeDeadlineAt] = useState("");
  const [finalizationDeadlineAt, setFinalizationDeadlineAt] = useState("");
  const [txState, setTxState] = useState<string | null>(null);
  const [roundTx, setRoundTx] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const busy = txState?.startsWith("Preparing") || txState?.startsWith("Waiting") || txState?.startsWith("Transaction submitted");

  async function startRound() {
    setTxState(null);
    setRoundTx(null);
    setRoundId(null);
    try {
      if (!address || mode === "none") {
        openWallet();
        throw new Error("Connect a wallet before starting a round.");
      }
      const config = {
        title: roundTitle.trim(),
        round_type: "retroactive_public_goods",
        historical_window: roundWindow.trim(),
        rubric: ["reach", "depth", "durability", "additionality", "public_good_fit"],
        policy_version: "bibet-studionet-v1",
        max_share_bps: Number(maxShareBps),
        planned_budget_gen: roundBudget.trim() || "0",
        application_close_after: isoDeadline(applicationCloseAfter),
        review_deadline_at: isoDeadline(reviewDeadlineAt),
        challenge_deadline_at: isoDeadline(challengeDeadlineAt),
        finalization_deadline_at: isoDeadline(finalizationDeadlineAt),
      };
      if (config.title.length < 4) throw new Error("Round title must be at least 4 characters.");
      if (config.historical_window.length < 7) throw new Error("Add a clear historical window before starting.");
      if (!Number.isInteger(config.max_share_bps) || config.max_share_bps < 100 || config.max_share_bps > 2500) {
        throw new Error("Max recipient share must be between 100 and 2500 bps.");
      }
      validateDeadlineOrder([
        config.application_close_after,
        config.review_deadline_at,
        config.challenge_deadline_at,
        config.finalization_deadline_at,
      ]);
      const beforeRaw = await readClient.readContract({ address: BIBET_CONTRACT, functionName: "get_round_count", args: [] });
      const before = Number(beforeRaw || 0);
      setTxState("Preparing create_round transaction...");

      if (mode === "generated") {
        const key = getGeneratedKey();
        if (!key) throw new Error("Browser wallet key was not found.");
        const account = createAccount(key as `0x${string}`);
        const client = createClient({ chain: BIBET_CHAIN, account });
        const hash = await client.writeContract({ account, address: BIBET_CONTRACT, functionName: "create_round", args: [JSON.stringify(config)], value: 0n, consensusMaxRotations: 3 });
        setRoundTx(hash);
        setTxState("Waiting for GenLayer consensus...");
        const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
        setRoundId(await discoverCreatedRound(before, address, config.title, config.historical_window));
        setTxState(`Round created. Status ${receipt.statusName ?? receipt.status}, result ${receipt.resultName ?? receipt.result}.`);
        return;
      }

      const client = createClient({ chain: BIBET_CHAIN, account: address as `0x${string}`, provider: window.ethereum as never });
      const hash = await client.writeContract({ address: BIBET_CONTRACT, functionName: "create_round", args: [JSON.stringify(config)], value: 0n, consensusMaxRotations: 3 });
      setRoundTx(hash);
      setTxState("Transaction submitted from injected wallet. Waiting for GenLayer consensus...");
      const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
      setRoundId(await discoverCreatedRound(before, address, config.title, config.historical_window));
      setTxState(`Round created. Status ${receipt.statusName ?? receipt.status}, result ${receipt.resultName ?? receipt.result}.`);
    } catch (error) {
      setTxState(error instanceof Error ? error.message : "Could not start the round.");
    }
  }

  return (
    <div className="roundForm">
      <label>Round title<input value={roundTitle} onChange={(event) => setRoundTitle(event.target.value)} placeholder="Example: Open climate tools Q3" /></label>
      <label>Historical window<input value={roundWindow} onChange={(event) => setRoundWindow(event.target.value)} placeholder="Example: 2026-01-01/2026-06-30" /></label>
      <label>Max recipient share bps<input value={maxShareBps} onChange={(event) => setMaxShareBps(event.target.value)} placeholder="2500" /></label>
      <label>Planned budget note<input value={roundBudget} onChange={(event) => setRoundBudget(event.target.value)} placeholder="Example: 50000 GEN" /></label>
      <label>Application close deadline<input type="datetime-local" value={applicationCloseAfter} onChange={(event) => setApplicationCloseAfter(event.target.value)} /></label>
      <label>Review deadline<input type="datetime-local" value={reviewDeadlineAt} onChange={(event) => setReviewDeadlineAt(event.target.value)} /></label>
      <label>Challenge deadline<input type="datetime-local" value={challengeDeadlineAt} onChange={(event) => setChallengeDeadlineAt(event.target.value)} /></label>
      <label>Finalization deadline<input type="datetime-local" value={finalizationDeadlineAt} onChange={(event) => setFinalizationDeadlineAt(event.target.value)} /></label>
      <button className="primary formSubmit" onClick={startRound} disabled={!!busy}><Plus size={16} />Start new round</button>
      {!address && <button className="secondaryAction" onClick={openWallet}>Connect wallet first <ArrowUpRight size={14} /></button>}
      {txState && <div className="txState">{txState}{roundTx && <a href={explorerTx(roundTx)} target="_blank">View transaction <ExternalLink size={12} /></a>}{roundId && <a href={`/rounds/${roundId}`}>Open round {roundId} <ArrowUpRight size={12} /></a>}</div>}
    </div>
  );
}

function isoDeadline(value: string) {
  if (!value.trim()) return "";
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function validateDeadlineOrder(values: string[]) {
  const present = values.filter(Boolean);
  if (present.length !== values.length && present.length > 0) {
    throw new Error("Either fill all lifecycle deadlines or leave all deadline fields blank.");
  }
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] && values[index] && values[index - 1] > values[index]) {
      throw new Error("Deadline order must be application close ≤ review ≤ challenge ≤ finalization.");
    }
  }
}

async function discoverCreatedRound(before: number, creator: string, title: string, historicalWindow: string) {
  const countRaw = await readClient.readContract({ address: BIBET_CONTRACT, functionName: "get_round_count", args: [] });
  const count = Number(countRaw || 0);
  for (let id = count; id > before; id -= 1) {
    const raw = await readClient.readContract({ address: BIBET_CONTRACT, functionName: "get_round", args: [String(id)] });
    const round = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    if (round.creator === creator.toLowerCase() && round.title === title && round.config?.historical_window === historicalWindow) {
      return String(id);
    }
  }
  return null;
}
