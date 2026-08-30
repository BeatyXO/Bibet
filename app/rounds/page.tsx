import { AppShell } from "../../components/app-shell";
import { RoundsLedger } from "../../components/rounds-ledger";

export default function RoundsPage() {
  return (
    <AppShell>
      <section className="pageBand">
        <div className="sectionKicker">ROUNDS</div>
        <h1>Rounds ledger</h1>
        <p>Live summaries are read directly from the BIBET contract round counter and summary views. No mock rounds are shown.</p>
        <RoundsLedger />
      </section>
    </AppShell>
  );
}
