import assert from "node:assert/strict";

function allocate(budget: bigint, scores: number[], maxShareBps: bigint) {
  const cap = (budget * maxShareBps) / 10_000n;
  const amounts = scores.map(() => 0n);
  const total = scores.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (budget <= 0n || total <= 0 || cap <= 0n) return { amounts, unallocated: budget };
  let allocated = 0n;
  let remaining = budget;
  let active = scores.map((score, idx) => ({ score: Math.max(0, score), idx })).filter((item) => item.score > 0);
  while (remaining > 0n && active.length > 0) {
    const activeTotal = active.reduce((sum, item) => sum + item.score, 0);
    let changed = false;
    const remainders: Array<{ idx: number; rem: bigint; score: number }> = [];
    for (const item of active) {
      const room = cap - amounts[item.idx];
      if (room <= 0n) continue;
      const numerator = remaining * BigInt(item.score);
      const share = numerator / BigInt(activeTotal) > room ? room : numerator / BigInt(activeTotal);
      if (share > 0n) {
        amounts[item.idx] += share;
        allocated += share;
        changed = true;
      }
      remainders.push({ idx: item.idx, rem: numerator % BigInt(activeTotal), score: item.score });
    }
    remaining = budget - allocated;
    active = active.filter((item) => amounts[item.idx] < cap);
    if (!changed) {
      const candidates = remainders.filter((item) => active.some((activeItem) => activeItem.idx === item.idx));
      if (candidates.length === 0) break;
      candidates.sort((a, b) => Number(b.rem - a.rem) || b.score - a.score || a.idx - b.idx);
      amounts[candidates[0].idx] += 1n;
      allocated += 1n;
      remaining = budget - allocated;
    }
  }
  return { amounts, unallocated: remaining };
}

const vectors: Array<[string, bigint, number[], bigint, bigint[], bigint]> = [
  ["equal scores", 100n, [50, 50], 10_000n, [50n, 50n], 0n],
  ["unequal scores", 100n, [80, 20], 10_000n, [80n, 20n], 0n],
  ["single claimant default cap", 100n, [100], 2500n, [25n], 75n],
  ["two equal claimants with 25% cap", 100n, [100, 100], 2500n, [25n, 25n], 50n],
  ["many claimants", 1_000n, [10, 20, 30, 40, 50, 60], 3000n, [47n, 95n, 142n, 190n, 238n, 288n], 0n],
  ["zero scores", 100n, [0, 0, 0], 10_000n, [0n, 0n, 0n], 100n],
  ["one dominant score capped", 100n, [100, 1, 1], 5000n, [50n, 25n, 25n], 0n],
  ["rounding dust", 10n, [1, 1, 1], 10_000n, [4n, 3n, 3n], 0n],
  ["full-cap saturation", 100n, [100, 100, 100, 100], 2500n, [25n, 25n, 25n, 25n], 0n],
  ["all capped before exhaustion", 100n, [100, 100], 2500n, [25n, 25n], 50n],
  ["10000 bps cap", 100n, [99, 1], 10_000n, [99n, 1n], 0n],
  ["tiny budgets", 1n, [100, 100], 2500n, [0n, 0n], 1n],
  ["large integer budget", 10_000_000_000_000_000_000_000n, [70, 30], 10_000n, [7_000_000_000_000_000_000_000n, 3_000_000_000_000_000_000_000n], 0n],
];

for (const [name, budget, scores, capBps, expectedAmounts, expectedUnallocated] of vectors) {
  const result = allocate(budget, scores, capBps);
  assert.deepEqual(result.amounts, expectedAmounts, `${name}: exact vector mismatch`);
  assert.equal(result.unallocated, expectedUnallocated, `${name}: unallocated mismatch`);
  const cap = (budget * capBps) / 10_000n;
  assert(result.amounts.every((amount) => amount <= cap), `${name}: cap violated`);
  assert.equal(result.amounts.reduce((sum, value) => sum + value, 0n) + result.unallocated, budget, `${name}: conservation failed`);
}

console.log(`${vectors.length} exact allocation vector tests passed`);
