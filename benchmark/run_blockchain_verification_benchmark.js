const fs = require('fs');
const { measureBlockchainVerificationTime } = require('./BlockchainVerificationBenchmarkService');

(async () => {
  console.log('Running benchmark: ' + 'benchmark/run_blockchain_verification_benchmark.js');
  const sizes = [10, 50, 100, 250, 500, 1000];
  const runs = 50;
  const warmup = 5;

  for (const n of sizes) {
    const res = await measureBlockchainVerificationTime(n, { runs, warmup });

    // CSV export
    const header = 'Run,Execution Time (ms),Average,Minimum,Maximum,Median,NumBlocks,Valid';
    const stats = res.stats || res;
    const metadata = res.metadata || { numBlocks: n };
    const rows = res.results.map((r, idx) => `${idx + 1},${r.executionTimeMs},${stats.average},${stats.min},${stats.max},${stats.median},${metadata.numBlocks},${r.valid}`);
    const csv = [header, ...rows].join('\n');
    const outPath = `benchmark/blockchain_verification_${n}_blocks.csv`;
    fs.writeFileSync(outPath);
    console.log('CSV written to ' + (outPath));
  }
})();
