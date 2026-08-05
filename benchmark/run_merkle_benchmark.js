const fs = require('fs');
const { measureMerkleTime, computeStats } = require('./MerkleBenchmarkService');

function generateDeterministicTransactions(n) {
  // deterministic transactions: fixed fields dependent on index
  const txs = [];
  for (let i = 1; i <= n; i++) {
    txs.push({
      tx_id: `tx-${String(i).padStart(6, '0')}`,
      voter_id: i,
      candidate_id: (i % 10) + 1,
      amount: 1,
      timestamp: `2026-01-01T00:00:00Z`,
      metadata: `deterministic-payload-${String(i).padStart(6,'0')}`
    });
  }
  return txs;
}

(async () => {
  console.log('Running benchmark: ' + 'benchmark/run_merkle_benchmark.js');
  const sizes = [10, 50, 100, 250, 500, 1000];
  const runs = 50; // default measured runs
  const warmup = 5; // per requirement

  for (const n of sizes) {
    const txs = generateDeterministicTransactions(n);
    const res = await measureMerkleTime(txs, { runs, warmup });

    // CSV export
    const header = 'Run,Execution Time (ms),Average,Minimum,Maximum,Median,NumTransactions,TreeHeight,LeafHashes,InternalHashes,TotalHashOperations';
    const stats = res.stats || res;
    const metadata = res.metadata || { numTransactions: n, treeHeight: null, leafHashes: null, internalHashes: null, totalHashOperations: null };
    const rows = res.results.map((r, idx) => `${idx + 1},${r.executionTimeMs},${stats.average},${stats.min},${stats.max},${stats.median},${metadata.numTransactions},${metadata.treeHeight},${metadata.leafHashes},${metadata.internalHashes},${metadata.totalHashOperations}`);
    const csv = [header, ...rows].join('\n');
    const outPath = `benchmark/merkle_${n}_tx.csv`;
    fs.writeFileSync(outPath);
    console.log('CSV written to ' + (outPath));
  }

})();
