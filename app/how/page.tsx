import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppShell } from "../../components/app-shell";

const steps = [
  ["01", "Create round", "Define the title, historical window, rubric, and planned budget note."],
  ["02", "Submit evidence", "Claims point to completed public-good work and supporting proof."],
  ["03", "Validator review", "GenLayer judges evidence quality, including non-deterministic review outcomes."],
  ["04", "Deterministic allocation", "Accepted impact scores are normalized into a reproducible allocation."],
];

export default function HowPage() {
  return (
    <AppShell>
      <section className="pageBand">
        <div className="sectionKicker">HOW IT WORKS</div>
        <h1>Outcome funding with an auditable trail.</h1>
        <p>
          BIBET rewards work after value is visible. The contract keeps the deterministic accounting, while GenLayer
          consensus handles evidence interpretation where human-like judgment is needed.
        </p>
        <div className="stepGrid">
          {steps.map(([number, title, body]) => (
            <article className="stepCard" key={number}>
              <span>{number}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <Link className="textLink" href="/audit">Review the audit surface <ChevronRight size={15} /></Link>
      </section>
    </AppShell>
  );
}
