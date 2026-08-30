"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { BIBET_CONTRACT, explorerContract, readClient } from "../lib/config";

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
  const [state, setState] = useState("Loading afterledger...");
  const [ledger, setLedger] = useState<Afterledger | null>(null);

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
      <section className="detailCard wide">
        <h3>Raw afterledger</h3>
        <pre>{JSON.stringify(ledger, null, 2)}</pre>
      </section>
    </div>
  );
}
