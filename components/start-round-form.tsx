"use client";

import { useState } from "react";
import { ArrowUpRight, ExternalLink, Plus } from "lucide-react";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { BIBET_CONTRACT } from "../lib/config";
import { getGeneratedKey } from "../lib/wallet";
import { useWallet } from "./wallet-provider";

export function StartRoundForm() {
  const { address, mode, openWallet } = useWallet();
  const [roundTitle, setRoundTitle] = useState("");
  const [roundWindow, setRoundWindow] = useState("");
  const [roundBudget, setRoundBudget] = useState("");
  const [txState, setTxState] = useState<string | null>(null);
  const [roundTx, setRoundTx] = useState<string | null>(null);
  const busy = txState?.startsWith("Preparing") || txState?.startsWith("Waiting") || txState?.startsWith("Transaction submitted");

  async function startRound() {
    setTxState(null);
    setRoundTx(null);
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
        max_share_bps: 10000,
        planned_budget_gen: roundBudget.trim() || "0",
      };
      if (config.title.length < 4) throw new Error("Round title must be at least 4 characters.");
      if (config.historical_window.length < 7) throw new Error("Add a clear historical window before starting.");
      setTxState("Preparing create_round transaction...");

      if (mode === "generated") {
        const key = getGeneratedKey();
        if (!key) throw new Error("Browser wallet key was not found.");
        const account = createAccount(key as `0x${string}`);
        const client = createClient({ chain: studionet, account });
        const hash = await client.writeContract({ account, address: BIBET_CONTRACT, functionName: "create_round", args: [JSON.stringify(config)], value: 0n, consensusMaxRotations: 3 });
        setRoundTx(hash);
        setTxState("Waiting for GenLayer consensus...");
        const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
        setTxState(`Round created. Status ${receipt.statusName ?? receipt.status}, result ${receipt.resultName ?? receipt.result}.`);
        return;
      }

      const client = createClient({ chain: studionet, account: address as `0x${string}`, provider: window.ethereum as never });
      const hash = await client.writeContract({ address: BIBET_CONTRACT, functionName: "create_round", args: [JSON.stringify(config)], value: 0n, consensusMaxRotations: 3 });
      setRoundTx(hash);
      setTxState("Transaction submitted from injected wallet. Waiting for GenLayer consensus...");
      const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
      setTxState(`Round created. Status ${receipt.statusName ?? receipt.status}, result ${receipt.resultName ?? receipt.result}.`);
    } catch (error) {
      setTxState(error instanceof Error ? error.message : "Could not start the round.");
    }
  }

  return (
    <div className="roundForm">
      <label>Round title<input value={roundTitle} onChange={(event) => setRoundTitle(event.target.value)} placeholder="Example: Open climate tools Q3" /></label>
      <label>Historical window<input value={roundWindow} onChange={(event) => setRoundWindow(event.target.value)} placeholder="Example: 2026-01-01/2026-06-30" /></label>
      <label>Planned budget note<input value={roundBudget} onChange={(event) => setRoundBudget(event.target.value)} placeholder="Example: 50000 GEN" /></label>
      <button className="primary formSubmit" onClick={startRound} disabled={!!busy}><Plus size={16} />Start new round</button>
      {!address && <button className="secondaryAction" onClick={openWallet}>Connect wallet first <ArrowUpRight size={14} /></button>}
      {txState && <div className="txState">{txState}{roundTx && <a href={`https://explorer-studio.genlayer.com/transactions/${roundTx}`} target="_blank">View transaction <ExternalLink size={12} /></a>}</div>}
    </div>
  );
}
