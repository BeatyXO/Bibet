import Link from "next/link";
import { ArrowUpRight, DatabaseZap } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { BIBET_CONTRACT } from "../../lib/config";

export default function RoundsPage() {
  return (
    <AppShell>
      <section className="pageBand">
        <div className="sectionKicker">ROUNDS</div>
        <h1>Rounds ledger</h1>
        <p>
          Demo cards have been removed. This screen is ready for live round indexing from the BIBET contract instead of
          showing fabricated rounds.
        </p>
        <div className="emptyState">
          <DatabaseZap size={22} />
          <div>
            <h2>No indexed public rounds loaded yet.</h2>
            <p>Contract: <code>{BIBET_CONTRACT}</code></p>
          </div>
          <Link className="primary" href="/start">Start round <ArrowUpRight size={15} /></Link>
        </div>
      </section>
    </AppShell>
  );
}
