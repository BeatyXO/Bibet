import assert from "node:assert/strict";
import { finalizedExecution } from "../../lib/receipt";

assert.equal(finalizedExecution({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }).ok, true);
assert.equal(finalizedExecution({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" }).ok, false);
assert.equal(finalizedExecution({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }).ok, false);
assert.equal(finalizedExecution({ statusName: "FINALIZED", resultName: "NO_MAJORITY", txExecutionResultName: "FINISHED_WITH_RETURN" }).ok, false);
assert.equal(finalizedExecution({ statusName: "FINALIZED" }).ok, false);
assert.equal(finalizedExecution({ statusName: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "FINISHED_WITH_RETURN" }] } }).ok, true);
console.log("6 transaction receipt cases passed");
