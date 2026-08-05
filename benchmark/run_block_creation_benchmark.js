const fs = require('fs');
const { measureBlockCreationTime } = require('./BlockCreationBenchmarkService');

(async () => {
  console.log('Running benchmark: ' + 'benchmark/run_block_creation_benchmark.js');
  const sizes = [10, 50, 100, 250, 500, 1000];
  const runs = 50;
  const warmup = 5;

  for (const n of sizes) {
    const res = await measureBlockCreationTime(n, { runs, warmup });

    // CSV export
    const header = 'Run,Execution Time (ms),Average,Minimum,Maximum,Median,NumTransactions';
    const stats = res.stats || res;
    const metadata = res.metadata || { numTransactions: n };
    const rows = res.results.map((r, idx) => `${idx + 1},${r.executionTimeMs},${stats.average},${stats.min},${stats.max},${stats.median},${metadata.numTransactions}`);
    const csv = [header, ...rows].join('\n');
    const outPath = `benchmark/block_creation_${n}_tx.csv`;
    fs.writeFileSync(outPath);
    console.log('CSV written to ' + (outPath));
  }
})();
