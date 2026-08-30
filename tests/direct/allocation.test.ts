import assert from "node:assert/strict";

type Verdict = { eligibility: string; evidence_quality: string; duplication_risk: string; normalized_impact_score: number };
type Claim = { id: string; contributor: string };

function score(verdict?: Verdict) {
  if (!verdict || verdict.eligibility !== "ELIGIBLE") return 0;
  if (["WEAK", "UNAVAILABLE", "CONTRADICTORY"].includes(verdict.evidence_quality) || verdict.duplication_risk === "HIGH") return 0;
  return Math.max(0, Math.min(100, verdict.normalized_impact_score));
}

function allocate(budget: bigint, scores: number[], maxShareBps: bigint) {
  const claims: Claim[] = scores.map((_, index) => ({ id: String(index + 1), contributor: `0x${index}` }));
  const verdicts = Object.fromEntries(scores.map((value, index) => [String(index + 1), { eligibility: value > 0 ? "ELIGIBLE" : "INSUFFICIENT_EVIDENCE", evidence_quality: "STRONG", duplication_risk: "LOW", normalized_impact_score: value }]));
  const cap = (budget * maxShareBps) / 10_000n;
  const normalized = claims.map((claim) => score(verdicts[claim.id]));
  const total = normalized.reduce((sum, value) => sum + value, 0);
  if (budget <= 0n || total <= 0 || cap <= 0n) return { amounts: claims.map(() => 0n), unallocated: budget };
  const amounts: bigint[] = [];
  const remainders: Array<{ idx: number; rem: bigint; score: number; id: number }> = [];
  let allocated = 0n;
  normalized.forEach((value, idx) => {
    const numerator = budget * BigInt(value);
    const base = numerator / BigInt(total) > cap ? cap : numerator / BigInt(total);
    amounts[idx] = base;
    allocated += base;
    remainders.push({ idx, rem: numerator % BigInt(total), score: value, id: idx + 1 });
  });
  let residual = budget - allocated;
  while (residual > 0n) {
    const candidates = remainders.filter((item) => normalized[item.idx] > 0 && amounts[item.idx] < cap);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => Number(b.rem - a.rem) || b.score - a.score || a.id - b.id);
    const best = candidates[0];
    const room = cap - amounts[best.idx];
    const add = residual < room ? residual : room;
    amounts[best.idx] += add;
    residual -= add;
    best.rem = -1n;
  }
  return { amounts, unallocated: residual };
}

function check(name: string, budget: bigint, scores: number[], capBps: bigint, expectedTotal?: bigint) {
  const result = allocate(budget, scores, capBps);
  const cap = (budget * capBps) / 10_000n;
  const total = result.amounts.reduce((sum, value) => sum + value, 0n);
  assert(total <= budget, `${name}: allocation exceeds budget`);
  for (const amount of result.amounts) assert(amount <= cap, `${name}: cap violated`);
  assert.equal(total + result.unallocated, budget, `${name}: value conservation failed`);
  if (expectedTotal !== undefined) assert.equal(total, expectedTotal, `${name}: unexpected allocated total`);
}

check("equal scores", 100n, [50, 50], 10_000n, 100n);
check("unequal scores", 100n, [80, 20], 10_000n, 100n);
check("single claimant", 100n, [100], 10_000n, 100n);
check("two equal claimants with 25% cap", 100n, [100, 100], 2500n, 50n);
check("many claimants", 1_000n, [10, 20, 30, 40, 50, 60], 3000n, 1_000n);
check("zero scores", 100n, [0, 0, 0], 10_000n, 0n);
check("one dominant score", 100n, [100, 1, 1], 5000n, 100n);
check("rounding dust", 10n, [1, 1, 1], 10_000n, 10n);
check("full-cap saturation", 100n, [100, 100, 100, 100], 2500n, 100n);
check("all capped before exhaustion", 100n, [100, 100], 2500n, 50n);
check("10000 bps cap", 100n, [99, 1], 10_000n, 100n);
check("tiny budgets", 1n, [100, 100], 2500n, 0n);
check("very large integer budgets", 10_000_000_000_000_000_000_000n, [70, 30], 10_000n, 10_000_000_000_000_000_000_000n);

console.log("13 direct allocation tests passed");
