"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, ExternalLink, RefreshCw, Send } from "lucide-react";
import { createAccount, createClient } from "genlayer-js";
import { BIBET_CHAIN, BIBET_CONTRACT, explorerContract, explorerTx, readClient } from "../lib/config";
import { getGeneratedKey } from "../lib/wallet";
import { useWallet } from "./wallet-provider";

type Afterledger = {
  round: { id: string; title: string; creator: string; status: string; budget: string };
  totals: Record<string, string>;
  claims: Array<Record<string, unknown>>;
  verdicts: Record<string, Record<string, unknown>>;
  challenges: Array<Record<string, unknown>>;
  allocations: Array<Record<string, unknown>>;
  settlements: Array<Record<string, unknown>>;
};

async function readAfterledger(roundId: string) {
  const raw = await readClient.readContract({ address: BIBET_CONTRACT, functionName: "get_afterledger", args: [roundId] });
  return typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
}

export function RoundDetail({ roundId }: { roundId: string }) {
  const { address, mode, openWallet } = useWallet();
  const [state, setState] = useState("Loading afterledger...");
  const [ledger, setLedger] = useState<Afterledger | null>(null);
  const [actionState, setActionState] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("0.001");
  const [claimId, setClaimId] = useState("1");
  const [challengeId, setChallengeId] = useState("1");
  const [claimJson, setClaimJson] = useState(defaultClaimJson());
  const [challengeField, setChallengeField] = useState("evidence_quality");
  const [challengeReason, setChallengeReason] = useState("Challenge whether the evidence proves the claimed public-good impact.");
  const [challengeEvidenceJson, setChallengeEvidenceJson] = useState(JSON.stringify({ evidence_urls: ["https://raw.githubusercontent.com/BeatyXO/Bibet/main/README.md"] }, null, 2));
  const [challengeResponse, setChallengeResponse] = useState("The submitted public evidence and trace URLs demonstrate the completed work and attribution.");

  const refresh = useCallback(async () => {
    setState("Loading afterledger...");
    try {
      setLedger(await readAfterledger(roundId));
      setState("");
    } catch (error) {
      setLedger(null);
      setState(error instanceof Error ? error.message : "Could not load round afterledger.");
    }
  }, [roundId]);

  useEffect(() => {
    queueMicrotask(() => {
      refresh();
    });
  }, [refresh]);

  if (!ledger) {
    return (
      <div className="emptyState">
        <div>
          <h2>{state}</h2>
          <p>Round {roundId} on <code>{BIBET_CONTRACT}</code></p>
        </div>
        <button className="secondaryAction" onClick={refresh}><RefreshCw size={14} />Retry</button>
      </div>
    );
  }

  async function sendWrite(functionName: string, args: unknown[] = [], value = 0n) {
    setActionState(null);
    setLastTx(null);
    try {
      if (!address || mode === "none") {
        openWallet();
        throw new Error("Connect a wallet before sending protocol writes.");
      }
      setActionState(`Preparing ${functionName}...`);
      if (mode === "generated") {
        const key = getGeneratedKey();
        if (!key) throw new Error("Browser wallet key was not found.");
        const account = createAccount(key as `0x${string}`);
        const client = createClient({ chain: BIBET_CHAIN, account });
        const hash = await client.writeContract({ account, address: BIBET_CONTRACT, functionName, args: args as never[], value, consensusMaxRotations: 3 });
        setLastTx(hash);
        setActionState(`Waiting for ${functionName} consensus...`);
        const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
        setActionState(`${functionName} accepted. Status ${receipt.statusName ?? receipt.status}, result ${receipt.resultName ?? receipt.result}.`);
        await refresh();
        return;
      }
      const client = createClient({ chain: BIBET_CHAIN, account: address as `0x${string}`, provider: window.ethereum as never });
      const hash = await client.writeContract({ address: BIBET_CONTRACT, functionName, args: args as never[], value, consensusMaxRotations: 3 });
      setLastTx(hash);
      setActionState(`Waiting for ${functionName} consensus...`);
      const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
      setActionState(`${functionName} accepted. Status ${receipt.statusName ?? receipt.status}, result ${receipt.resultName ?? receipt.result}.`);
      await refresh();
    } catch (error) {
      setActionState(error instanceof Error ? error.message : `Could not execute ${functionName}.`);
    }
  }

  function fundValue() {
    const normalized = Number(fundAmount);
    if (!Number.isFinite(normalized) || normalized <= 0) throw new Error("Funding amount must be positive.");
    return BigInt(Math.floor(normalized * 1_000_000)) * 1_000_000_000_000n;
  }

  function fundRound() {
    try {
      void sendWrite("fund_round", [roundId], fundValue());
    } catch (error) {
      setActionState(error instanceof Error ? error.message : "Could not prepare funding amount.");
    }
  }

  return (
    <div className="detailGrid">
      <section className="detailCard wide">
        <div className="roundHead"><span>ROUND {ledger.round.id}</span><span>{ledger.round.status}</span></div>
        <h2>{ledger.round.title}</h2>
        <p>Creator <code>{ledger.round.creator}</code></p>
        <a className="textLink" href={explorerContract()} target="_blank">Open contract <ExternalLink size={14} /></a>
      </section>
      <section className="detailCard">
        <h3>Totals</h3>
        <dl>{Object.entries(ledger.totals || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      </section>
      <section className="detailCard">
        <h3>Claims</h3>
        <p>{ledger.claims.length} submitted</p>
      </section>
      <section className="detailCard">
        <h3>Verdicts</h3>
        <p>{Object.keys(ledger.verdicts || {}).length} reviewed</p>
      </section>
      <section className="detailCard wide lifecyclePanel">
        <div className="roundHead"><span>OPERATE PROTOCOL</span><span>{address ? `${mode} wallet` : "wallet required"}</span></div>
        <h3>Lifecycle actions</h3>
        <p>Use these controls to run the real contract flow from this round: fund, lock/open, submit or update claims, review, challenge, adjudicate, finalise, and settle.</p>
        <div className="actionGrid">
          <label>Fund amount in GEN<input value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} /></label>
          <button className="primary" onClick={fundRound}><Send size={14} />Fund</button>
          <button className="secondaryAction" onClick={() => sendWrite("lock_round", [roundId])}>Lock / open</button>
          <button className="secondaryAction" onClick={() => sendWrite("close_applications", [roundId])}>Close applications</button>
          <button className="secondaryAction" onClick={() => sendWrite("permissionless_advance", [roundId])}>Permissionless advance</button>
          <button className="secondaryAction" onClick={() => sendWrite("finalize_round", [roundId])}>Finalise</button>
          <button className="secondaryAction" onClick={() => sendWrite("withdraw_unallocated_budget", [roundId])}>Withdraw unallocated</button>
        </div>
        <div className="actionGrid two">
          <label>Claim id<input value={claimId} onChange={(event) => setClaimId(event.target.value)} /></label>
          <button className="secondaryAction" onClick={() => sendWrite("request_impact_review", [roundId, claimId])}>Request review</button>
          <button className="secondaryAction" onClick={() => sendWrite("claim_allocation", [roundId, claimId])}>Claim allocation</button>
        </div>
        <label className="fullLabel">Claim JSON<textarea value={claimJson} onChange={(event) => setClaimJson(event.target.value)} /></label>
        <div className="actionGrid two">
          <button className="secondaryAction" onClick={() => sendWrite("submit_trace_claim", [roundId, claimJson])}>Submit claim</button>
          <button className="secondaryAction" onClick={() => sendWrite("update_claim_before_close", [roundId, claimId, claimJson])}>Update claim</button>
        </div>
        <div className="actionGrid two">
          <label>Challenge id<input value={challengeId} onChange={(event) => setChallengeId(event.target.value)} /></label>
          <label>Challenge field<input value={challengeField} onChange={(event) => setChallengeField(event.target.value)} /></label>
        </div>
        <label className="fullLabel">Challenge reason<textarea value={challengeReason} onChange={(event) => setChallengeReason(event.target.value)} /></label>
        <label className="fullLabel">Challenger evidence JSON<textarea value={challengeEvidenceJson} onChange={(event) => setChallengeEvidenceJson(event.target.value)} /></label>
        <label className="fullLabel">Contributor response<textarea value={challengeResponse} onChange={(event) => setChallengeResponse(event.target.value)} /></label>
        <div className="actionGrid two">
          <button className="secondaryAction" onClick={() => sendWrite("open_challenge", [roundId, claimId, challengeField, challengeReason, challengeEvidenceJson])}>Open challenge</button>
          <button className="secondaryAction" onClick={() => sendWrite("respond_to_challenge", [roundId, challengeId, challengeResponse])}>Respond</button>
          <button className="secondaryAction" onClick={() => sendWrite("adjudicate_challenge", [roundId, challengeId])}>Adjudicate</button>
        </div>
        {!address && <button className="primary" onClick={openWallet}>Connect wallet <ArrowUpRight size={14} /></button>}
        {actionState && <div className="txState">{actionState}{lastTx && <a href={explorerTx(lastTx)} target="_blank">View transaction <ExternalLink size={12} /></a>}</div>}
      </section>
      <section className="detailCard wide">
        <h3>Raw afterledger</h3>
        <pre>{JSON.stringify(ledger, null, 2)}</pre>
      </section>
    </div>
  );
}

function defaultClaimJson() {
  return JSON.stringify(
    {
      artifact_id: "bibet-public-good-artifact",
      title: "Completed public-good artifact",
      completion_date: "2026-08-30",
      impact_statement: "Describe the completed public-good work, who used it, and why the evidence proves impact.",
      evidence_urls: ["https://raw.githubusercontent.com/BeatyXO/Bibet/main/README.md"],
      trace_urls: ["https://raw.githubusercontent.com/BeatyXO/Bibet/main/contracts/bibet.py"],
      contributor_name: "Contributor",
      requested_tags: ["public-goods"],
    },
    null,
    2,
  );
}
