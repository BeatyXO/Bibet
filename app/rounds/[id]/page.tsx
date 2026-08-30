import { AppShell } from "../../../components/app-shell";
import { RoundDetail } from "../../../components/round-detail";

export default async function RoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <section className="pageBand">
        <div className="sectionKicker">ROUND DETAIL</div>
        <h1>Afterledger round {id}</h1>
        <RoundDetail roundId={id} />
      </section>
    </AppShell>
  );
}
