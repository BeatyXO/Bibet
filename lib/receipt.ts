type Receipt = {
  statusName?: unknown; status?: unknown; resultName?: unknown;
  txExecutionResultName?: unknown; txExecutionResult?: unknown;
  consensus_data?: { leader_receipt?: Array<{ execution_result?: unknown; error?: unknown; genvm_result?: { error_description?: unknown; stderr?: unknown } }> };
};

export function finalizedExecution(receipt: Receipt): { ok: boolean; message: string } {
  const status = String(receipt.statusName ?? receipt.status ?? "UNKNOWN");
  if (status !== "FINALIZED" && status !== "7") return { ok: false, message: `Transaction ${status.toLowerCase()}; execution not finalized.` };
  const result = String(receipt.resultName ?? "");
  if (["DISAGREE", "MAJORITY_DISAGREE", "NO_MAJORITY", "FAILURE"].includes(result)) return { ok: false, message: `Consensus ${result.toLowerCase()}.` };
  const execution = receipt.txExecutionResultName ?? receipt.consensus_data?.leader_receipt?.[0]?.execution_result ?? receipt.txExecutionResult;
  const leaderReceipt = receipt.consensus_data?.leader_receipt?.[0];
  const error = leaderReceipt?.error ?? leaderReceipt?.genvm_result?.error_description ?? leaderReceipt?.genvm_result?.stderr;
  if (error || execution === "FINISHED_WITH_ERROR" || execution === "ERROR" || execution === 2) return { ok: false, message: `Execution failed${error ? `: ${String(error)}` : "."}` };
  if (execution === "FINISHED_WITH_RETURN" || execution === "SUCCESS" || execution === 1) return { ok: true, message: "Finalized with successful execution." };
  return { ok: false, message: "Finalized; execution result could not be verified." };
}
