"use client";

import Link from "next/link";
import { ArrowUpRight, DatabaseZap, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BIBET_CONTRACT, readClient } from "../lib/config";

type RoundSummary = {
  id: string;
  title: string;
  creator: string;
  status: string;
  funded_budget: string;
  claims_count: number;
  allocated_amount: string;
  claimed_amount: string;
  unallocated_amount: string;
};

async function readJson(functionName: string, args: string[] = []) {
  const raw = await readClient.readContract({ address: BIBET_CONTRACT, functionName, args });
  return typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
}

export function RoundsLedger() {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [state, setState] = useState("Loading live rounds...");

  const loadRounds = useCallback(async () => {
    setState("Loading live rounds...");
    try {
      const countRaw = await readClient.readContract({ address: BIBET_CONTRACT, functionName: "get_round_count", args: [] });
      const count = Number(countRaw || 0);
      const loaded: RoundSummary[] = [];
      for (let id = 1; id <= count; id += 1) loaded.push(await readJson("get_round_summary", [String(id)]));
      setRounds(loaded.reverse());
      setState(loaded.length ? "" : "No indexed public rounds loaded yet.");
    } catch (error) {
      setRounds([]);
      setState(error instanceof Error ? error.message : "Could not load rounds from the contract.");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadRounds();
    });
  }, [loadRounds]);

  return (
    <div className="ledgerPanel">
      <button className="secondaryAction" onClick={loadRounds}><RefreshCw size={14} />Refresh</button>
      {rounds.length === 0 ? (
        <div className="emptyState">
          <DatabaseZap size={22} />
          <div>
            <h2>{state}</h2>
            <p>Contract: <code>{BIBET_CONTRACT}</code></p>
          </div>
          <Link className="primary" href="/start">Start round <ArrowUpRight size={15} /></Link>
        </div>
      ) : (
        <div className="ledgerGrid">
          {rounds.map((round) => (
            <article className="ledgerCard" key={round.id}>
              <div className="roundHead"><span>ROUND {round.id}</span><span>{round.status}</span></div>
              <h2>{round.title}</h2>
              <p>Creator <code>{round.creator}</code></p>
              <dl>
                <div><dt>Funded</dt><dd>{round.funded_budget}</dd></div>
                <div><dt>Claims</dt><dd>{round.claims_count}</dd></div>
                <div><dt>Allocated</dt><dd>{round.allocated_amount}</dd></div>
                <div><dt>Claimed</dt><dd>{round.claimed_amount}</dd></div>
                <div><dt>Unallocated</dt><dd>{round.unallocated_amount}</dd></div>
              </dl>
              <Link className="textLink" href={`/rounds/${round.id}`}>Open round <ArrowUpRight size={14} /></Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
