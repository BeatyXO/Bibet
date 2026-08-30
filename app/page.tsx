import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { AppShell } from "../components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow"><span />RETROACTIVE PUBLIC GOODS FUNDING</div>
          <h1>Fund what<br /><em>proved</em> its value.</h1>
          <p className="lead">
            BIBET turns completed public-good work into accountable funding. Evidence is reviewed by GenLayer validators.
            Allocation follows a transparent deterministic formula after review.
          </p>
          <div className="heroCtas">
            <Link className="primary" href="/rounds">Explore rounds <ArrowUpRight size={16} /></Link>
            <Link className="textLink" href="/start">Start a round <ChevronRight size={15} /></Link>
          </div>
        </div>
        <div className="strata">
          <div className="strataLabel">IMPACT STRATA <span>HISTORICAL WINDOW / LOCKED PER ROUND</span></div>
          <div className="layers">
            <div className="layer l1"><b>03</b><span>COMMUNITY REACH</span></div>
            <div className="layer l2"><b>02</b><span>PROVEN DEPTH</span></div>
            <div className="layer l3"><b>01</b><span>ATTRIBUTABLE WORK</span></div>
            <div className="layer l4"><b>00</b><span>EVIDENCE CORE</span></div>
          </div>
          <div className="strataFoot"><span>0.00</span><span>IMPACT BANDS</span><span>1.00</span></div>
        </div>
      </section>
      <section className="homeSplit">
        <div>
          <div className="sectionKicker">BUILT ON GENLAYER STUDIONET</div>
          <h2>Separate app screens.<br />No demo ledger noise.</h2>
        </div>
        <p>
          The live app keeps the homepage focused and sends round browsing, creation, process notes, and audit details to
          their own pages.
        </p>
      </section>
    </AppShell>
  );
}
