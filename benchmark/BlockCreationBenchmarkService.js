const { Block } = require('../blockchain/blockchain');
const { computeStats } = require('./MerkleBenchmarkService');

function parseRuns(value) {
  const runs = Number(value);
  if (!Number.isFinite(runs) || runs < 1) return 1;
  return Math.min(1000, Math.floor(runs));
}

function parseWarmup(value) {
  const w = Number(value);
  if (!Number.isFinite(w) || w < 0) return 5;
  return Math.min(100, Math.floor(w));
}

function generateDeterministicTransactions(n) {
  const txs = [];
  for (let i = 1; i <= n; i++) {
    txs.push({
      tx_id: `tx-${String(i).padStart(6, '0')}`,
      voter_id: i,
      candidate_id: (i % 10) + 1,
      amount: 1,
      timestamp: `2026-01-01T00:00:00Z`,
      metadata: `deterministic-payload-${String(i).padStart(6, '0')}`
    });
  }
  return txs;
}

async function measureBlockCreationTime(numTransactions, options = {}) {
  const runs = parseRuns(options.runs || 50);
  const warmup = parseWarmup(options.warmup || 5);
  const transactions = generateDeterministicTransactions(numTransactions);
  const results = [];

  // Warm-up
  for (let w = 0; w < warmup; w += 1) {
    try {
      // keep minimal outside measurement
      new Block(1, 1609459200000, transactions, 'prev');
    } catch (e) { /* ignore */ }
  }

  for (let i = 0; i < runs; i += 1) {
    const start = process.hrtime.bigint();
    const b = new Block(1, 1609459200000, transactions, 'prev');
    const end = process.hrtime.bigint();
    const executionTimeMs = Number(end - start) / 1e6;
    // Avoid keeping block references that could affect GC across runs
    results.push({ executionTimeMs: Number(executionTimeMs.toFixed(3)) });
  }

  const values = results.map(r => r.executionTimeMs);
  const stats = computeStats(values);
  const metadata = { numTransactions };
  return runs === 1 ? { ...results[0], ...stats, metadata } : { runs, results, stats, metadata };
}

module.exports = { measureBlockCreationTime };
