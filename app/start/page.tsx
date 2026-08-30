import { AppShell } from "../../components/app-shell";
import { StartRoundForm } from "../../components/start-round-form";

export default function StartPage() {
  return (
    <AppShell>
      <section className="createRound pageCreate">
        <div>
          <div className="sectionKicker">START A ROUND</div>
          <h1>Create the funding round</h1>
          <p>
            Start the on-chain round first, then fund and lock it when the budget is ready. BIBET supports injected
            wallets and locally generated browser wallets for Studionet writes.
          </p>
        </div>
        <StartRoundForm />
      </section>
    </AppShell>
  );
}
