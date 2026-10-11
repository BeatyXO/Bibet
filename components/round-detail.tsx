"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ExternalLink, RefreshCw, Send } from "lucide-react";
import { createClient } from "genlayer-js";
import { BIBET_CHAIN, BIBET_CONTRACT, explorerContract, explorerTx, readClient } from "../lib/config";
import { ensureInjectedChain } from "../lib/wallet";
import { finalizedExecution } from "../lib/receipt";
import { useWallet } from "./wallet-provider";

type Afterledger = {
  round: {
    id: string;
    title: string;
    creator: string;
    status: string;
    budget: string;
    funding_snapshot?: string;
    config?: {
      funding_model?: string;
      application_close_after?: string;
      review_deadline_at?: string;
      challenge_deadline_at?: string;
      finalization_deadline_at?: string;
    };
  };
  totals: Record<string, string>;
  claims: Array<Record<string, unknown>>;
  verdicts: Record<string, Record<string, unknown>>;
  challenges: Array<Record<string, unknown>>;
  allocations: Array<Record<string, unknown>>;
  settlements: Array<Record<string, unknown>>;
  sponsors?: Array<{ address: string; amount: string; refund: string; withdrawn: string }>;
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
  const [challengeEvidenceJson, setChallengeEvidenceJson] = useState(JSON.stringify({ evidence_manifest: [] }, null, 2));
  const [challengeResponse, setChallengeResponse] = useState("The submitted public evidence and trace URLs demonstrate the completed work and attribution.");
  const [nowMs, setNowMs] = useState(0);
  const pending = useRef(false);
  const [sponsorPage, setSponsorPage] = useState(0);
  const [sponsorRows, setSponsorRows] = useState<Array<{ address: string; amount: string; refund: string; withdrawn: string }>>([]);
  const [walletSponsor, setWalletSponsor] = useState<{ address: string; amount: string; refund: string; withdrawn: string } | null>(null);

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
    let active = true;
    readClient.readContract({ address: BIBET_CONTRACT, functionName: "list_sponsors", args: [roundId, String(sponsorPage * 20), "20"] })
      .then(raw => { const page = typeof raw === "string" ? JSON.parse(raw) : raw; if (active) setSponsorRows(page.sponsors || []); })
      .catch(() => { if (active) setSponsorRows([]); });
    return () => { active = false; };
  }, [roundId, sponsorPage, ledger]);

  useEffect(() => {
    if (!address) return;
    let active = true;
    readClient.readContract({ address: BIBET_CONTRACT, functionName: "get_sponsor", args: [roundId, address] })
      .then(raw => { const row = typeof raw === "string" ? JSON.parse(raw) : raw; if (active) setWalletSponsor(row.address ? row : null); })
      .catch(() => { if (active) setWalletSponsor(null); });
    return () => { active = false; };
  }, [roundId, address, ledger]);

  useEffect(() => {
    queueMicrotask(() => {
      refresh();
    });
  }, [refresh]);

  useEffect(() => {
    const key = `bibet.pending.round.${roundId}`;
    const hash = window.localStorage.getItem(key);
    if (!hash) return;
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) { window.localStorage.removeItem(key); return; }
    pending.current = true;
    let active = true;
    queueMicrotask(() => { if (active) setActionState(`Recovering pending transaction ${hash}...`); });
    readClient.waitForTransactionReceipt({ hash: hash as never, interval: 5000, retries: 90 })
      .then(receipt => {
        if (!active) return;
        const outcome = finalizedExecution(receipt);
        setActionState(`Recovered transaction: ${outcome.message}`);
        setLastTx(hash);
        if (["FINALIZED", "7"].includes(String(receipt.statusName ?? receipt.status))) window.localStorage.removeItem(key);
        if (outcome.ok) void refresh();
      })
      .catch(error => { if (active) setActionState(error instanceof Error ? error.message : "Pending transaction recovery failed."); })
      .finally(() => { pending.current = false; });
    return () => { active = false; };
  }, [roundId, refresh]);

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());
    window.queueMicrotask(updateClock);
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    if (pending.current) return;
    if (window.localStorage.getItem(`bibet.pending.round.${roundId}`)) {
      setActionState("A transaction for this round is still pending. Refresh to recover its result before sending another.");
      return;
    }
    pending.current = true;
    setActionState(null);
    setLastTx(null);
    try {
      if (!address || mode === "none") {
        openWallet();
        throw new Error("Connect a wallet before sending protocol writes.");
      }
      setActionState(`Preparing ${functionName}...`);
      await ensureInjectedChain(BIBET_CHAIN);
      const client = createClient({ chain: BIBET_CHAIN, account: address as `0x${string}`, provider: window.ethereum as never });
      const hash = await client.writeContract({ address: BIBET_CONTRACT, functionName, args: args as never[], value, consensusMaxRotations: 3 });
      setLastTx(hash);
      window.localStorage.setItem(`bibet.pending.round.${roundId}`, hash);
      setActionState(`Waiting for ${functionName} consensus...`);
      const receipt = await client.waitForTransactionReceipt({ hash, interval: 5000, retries: 90 });
      const outcome = finalizedExecution(receipt);
      setActionState(`${functionName}: ${outcome.message}`);
      if (["FINALIZED", "7"].includes(String(receipt.statusName ?? receipt.status))) window.localStorage.removeItem(`bibet.pending.round.${roundId}`);
      if (outcome.ok) await refresh();
    } catch (error) {
      setActionState(error instanceof Error ? error.message : `Could not execute ${functionName}.`);
    } finally {
      pending.current = false;
    }
  }

  function fundValue() {
    const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(fundAmount.trim());
    if (!match) throw new Error("Enter a positive GEN amount with at most 18 decimal places.");
    const amount = BigInt(match[1]) * 10n ** 18n + BigInt((match[2] || "").padEnd(18, "0"));
    if (amount <= 0n) throw new Error("Funding amount must be positive.");
    return amount;
  }

  function fundRound() {
    try {
      void sendWrite("fund_round", [roundId], fundValue());
    } catch (error) {
      setActionState(error instanceof Error ? error.message : "Could not prepare funding amount.");
    }
  }

  const status = ledger.round.status;
  const community = ledger.round.config?.funding_model === "community";
  const mySponsor = walletSponsor;
  const myRefund = mySponsor ? BigInt(mySponsor.refund) - BigInt(mySponsor.withdrawn) : 0n;
  const isCreator = Boolean(address && ledger.round.creator.toLowerCase() === address.toLowerCase());
  const hasWallet = Boolean(address && mode !== "none");
  const deadlinePassed = (value?: string) => (value && nowMs ? Date.parse(value) <= nowMs : false);
  const canFund = hasWallet && (community || isCreator) && (status === "DRAFT" || status === "FUNDING");
  const canLock = hasWallet && isCreator && (status === "DRAFT" || status === "FUNDING");
  const canSubmit = hasWallet && status === "OPEN";
  const canClose = hasWallet && isCreator && status === "OPEN";
  const canReview = hasWallet && status === "REVIEW" && !deadlinePassed(ledger.round.config?.review_deadline_at);
  const canExpire = hasWallet && status === "REVIEW" && deadlinePassed(ledger.round.config?.review_deadline_at);
  const canChallenge = hasWallet && status === "REVIEW" && !deadlinePassed(ledger.round.config?.challenge_deadline_at);
  const canFinalize = hasWallet && isCreator && status === "REVIEW" && deadlinePassed(ledger.round.config?.challenge_deadline_at);
  const canSettle = hasWallet && status === "FINALIZED";
  const walletHint = hasWallet ? "" : "Connect wallet to send writes.";

  return (
    <div className="detailGrid">
      <section className="detailCard wide">
        <div className="roundHead"><span>ROUND {ledger.round.id}</span><span>{ledger.round.status}</span></div>
        <h2>{ledger.round.title}</h2>
        <p>Creator <code>{ledger.round.creator}</code></p>
        <p>{community ? "Community funded: unused funds belong proportionally to sponsors." : "Creator funded: unused funds return to the creator."}</p>
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
          <button className="primary" disabled={!canFund} title={walletHint || "Funding closes when the creator locks the round."} onClick={fundRound}><Send size={14} />Fund</button>
          <p>Exact deposit: {(() => { try { return `${fundValue()} wei`; } catch { return "Invalid amount"; } })()}</p>
          <button className="secondaryAction" disabled={!canLock} title={walletHint || "Creator only while draft/funding."} onClick={() => sendWrite("lock_round", [roundId])}>Lock / open</button>
          <button className="secondaryAction" disabled={!canClose} title={walletHint || "Creator only while open."} onClick={() => sendWrite("close_applications", [roundId])}>Close applications</button>
          <button className="secondaryAction" disabled={!hasWallet || status === "FINALIZED" || status === "CANCELLED"} title={walletHint || "Moves open/review rounds when configured deadlines allow it."} onClick={() => sendWrite("permissionless_advance", [roundId])}>Permissionless advance</button>
          <button className="secondaryAction" disabled={!canFinalize} title={walletHint || "Creator only after challenge deadline and all challenges are resolved."} onClick={() => sendWrite("finalize_round", [roundId])}>Finalise</button>
          {community ? <button className="secondaryAction" disabled={!hasWallet || !((status === "FINALIZED" || status === "CANCELED") && myRefund > 0n)} onClick={() => sendWrite("withdraw_sponsor_refund", [roundId])}>Withdraw my refund ({myRefund.toString()} wei)</button> : <button className="secondaryAction" disabled={!canSettle || !isCreator} title={walletHint || "Creator only after finalization."} onClick={() => sendWrite("withdraw_unallocated_budget", [roundId])}>Withdraw unallocated</button>}
        </div>
        <div className="actionGrid two">
          <label>Claim id<input value={claimId} onChange={(event) => setClaimId(event.target.value)} /></label>
          <button className="secondaryAction" disabled={!canReview} title={walletHint || "Available during review before the review deadline."} onClick={() => sendWrite("request_impact_review", [roundId, claimId])}>Request review</button>
          <button className="secondaryAction" disabled={!canExpire} title={walletHint || "Available after the review deadline for unreviewed claims."} onClick={() => sendWrite("expire_unreviewed_claim", [roundId, claimId])}>Expire unreviewed</button>
          <button className="secondaryAction" disabled={!canSettle} title={walletHint || "Contributor can claim after finalization."} onClick={() => sendWrite("claim_allocation", [roundId, claimId])}>Claim allocation</button>
        </div>
        <label className="fullLabel">Claim JSON<textarea value={claimJson} onChange={(event) => setClaimJson(event.target.value)} /></label>
        <div className="actionGrid two">
          <button className="secondaryAction" disabled={!canSubmit} title={walletHint || "Available while applications are open."} onClick={() => sendWrite("submit_trace_claim", [roundId, claimJson])}>Submit claim</button>
          <button className="secondaryAction" disabled={!canSubmit} title={walletHint || "Contributor can update before applications close."} onClick={() => sendWrite("update_claim_before_close", [roundId, claimId, claimJson])}>Update claim</button>
        </div>
        <div className="actionGrid two">
          <label>Challenge id<input value={challengeId} onChange={(event) => setChallengeId(event.target.value)} /></label>
          <label>Challenge field<input value={challengeField} onChange={(event) => setChallengeField(event.target.value)} /></label>
        </div>
        <label className="fullLabel">Challenge reason<textarea value={challengeReason} onChange={(event) => setChallengeReason(event.target.value)} /></label>
        <label className="fullLabel">Challenger evidence JSON<textarea value={challengeEvidenceJson} onChange={(event) => setChallengeEvidenceJson(event.target.value)} /></label>
        <label className="fullLabel">Contributor response<textarea value={challengeResponse} onChange={(event) => setChallengeResponse(event.target.value)} /></label>
        <div className="actionGrid two">
          <button className="secondaryAction" disabled={!canChallenge} title={walletHint || "Available during review before challenge deadline."} onClick={() => sendWrite("open_challenge", [roundId, claimId, challengeField, challengeReason, challengeEvidenceJson])}>Open challenge</button>
          <button className="secondaryAction" disabled={!canChallenge} title={walletHint || "Contributor can respond before challenge deadline."} onClick={() => sendWrite("respond_to_challenge", [roundId, challengeId, challengeResponse])}>Respond</button>
          <button className="secondaryAction" disabled={!canChallenge && status !== "REVIEW"} title={walletHint || "Adjudicates an open or answered challenge."} onClick={() => sendWrite("adjudicate_challenge", [roundId, challengeId])}>Adjudicate</button>
        </div>
        {!address && <button className="primary" onClick={openWallet}>Connect wallet <ArrowUpRight size={14} /></button>}
        {actionState && <div className="txState">{actionState}{lastTx && <a href={explorerTx(lastTx)} target="_blank">View transaction <ExternalLink size={12} /></a>}</div>}
      </section>
      {community && <section className="detailCard wide"><h3>Sponsor ledger</h3><p>{ledger.totals.sponsor_count || "0"} sponsors · Funding {status === "DRAFT" || status === "FUNDING" ? "open" : "closed"} · Your contribution {mySponsor?.amount || "0"} wei · Your refund entitlement {mySponsor?.refund || "0"} wei</p><dl>{sponsorRows.map(row => <div key={row.address}><dt><code>{row.address}</code></dt><dd>{row.amount} wei funded · {row.refund} wei refund · {row.withdrawn} wei withdrawn</dd></div>)}</dl><button className="secondaryAction" disabled={sponsorPage === 0} onClick={() => setSponsorPage(page => page - 1)}>Previous</button><button className="secondaryAction" disabled={(sponsorPage + 1) * 20 >= Number(ledger.totals.sponsor_count || 0)} onClick={() => setSponsorPage(page => page + 1)}>Next</button></section>}
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
      evidence_manifest: [],
      trace_urls: ["https://raw.githubusercontent.com/BeatyXO/Bibet/main/contracts/bibet.py"],
      contributor_name: "Contributor",
      requested_tags: ["public-goods"],
    },
    null,
    2,
  );
}
