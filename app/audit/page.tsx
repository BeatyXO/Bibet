import { CircleHelp, ExternalLink, ShieldCheck } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { BIBET_CONTRACT, explorerContract } from "../../lib/config";

export default function AuditPage() {
  return (
    <AppShell>
      <section className="audit pageAudit">
        <div className="auditVisual">
          <div className="stamp"><ShieldCheck size={18} /><span>CONSENSUS<br />VERIFIED</span></div>
          <div className="auditLine"><span>01</span><b>Evidence review result</b><i>GENLAYER</i></div>
          <div className="auditLine"><span>02</span><b>Impact bands normalized</b><i>DETERMINISTIC</i></div>
          <div className="auditLine"><span>03</span><b>Allocation record</b><i>CONTRACT</i></div>
        </div>
        <div className="auditCopy">
          <div className="sectionKicker">THE AFTERLEDGER</div>
          <h1>See the layers.<br /><em>Trust the record.</em></h1>
          <p>
            Every finalized round can publish evidence fingerprints, validator outcomes, locked rubric inputs, and the
            deterministic allocation path.
          </p>
          <div className="auditNote">
            <CircleHelp size={16} />
            <span>Weak or conflicting evidence can resolve as <b>INSUFFICIENT EVIDENCE</b>. BIBET should never force certainty where the proof is thin.</span>
          </div>
          <a className="textLink" href={explorerContract(BIBET_CONTRACT)} target="_blank">
            Open BIBET contract <ExternalLink size={15} />
          </a>
        </div>
      </section>
    </AppShell>
  );
}
