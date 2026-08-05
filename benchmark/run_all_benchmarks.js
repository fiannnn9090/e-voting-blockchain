/*
  Run all finalized benchmarks sequentially and generate summary CSV/JSON/MD
  - RSA (multiple payload sizes)
  - Merkle (multiple tx sizes)
  - Block Creation (multiple tx sizes)
  - Blockchain Verification (multiple block counts)

  Output files:
  - benchmark/benchmark_summary.csv
  - benchmark/benchmark_summary.json
  - benchmark/benchmark_summary.md
*/

const fs = require('fs');
const { generateKeyPair } = require('../blockchain/keys');
const { measureRsaSignTime } = require('./RsaBenchmarkService');
const { measureMerkleTime } = require('./MerkleBenchmarkService');
const { measureBlockCreationTime } = require('./BlockCreationBenchmarkService');
const { measureBlockchainVerificationTime } = require('./BlockchainVerificationBenchmarkService');

async function run() {
  const summary = [];

  // 1) RSA Benchmark (payload sizes)
  const rsaBasePayload = { user_id: 1, candidate_id: 1, timestamp: '2026-01-01T00:00:00Z' };
  const rsaSizes = [128, 256, 512, 1024];
  const rsaRuns = 50;
  const rsaWarmup = 5;
  const kp = generateKeyPair();
  const privateKey = kp.privateKey;

  for (const size of rsaSizes) {
    // Build deterministic payload similar to run_rsa_benchmark.js
    function buildPayloadWithSize(basePayload, targetBytes) {
      let json = JSON.stringify(basePayload);
      let curBytes = Buffer.byteLength(json, 'utf8');
      if (curBytes >= targetBytes) return basePayload;
      const padSize = targetBytes - curBytes;
      const padding = 'a'.repeat(padSize - 10 > 0 ? padSize - 10 : padSize);
      const payload = Object.assign({}, basePayload, { padding });
      let finalJson = JSON.stringify(payload);
      let finalBytes = Buffer.byteLength(finalJson, 'utf8');
      if (finalBytes < targetBytes) {
        const extra = 'b'.repeat(targetBytes - finalBytes);
        payload.padding += extra;
      }
      return payload;
    }

    const payload = buildPayloadWithSize(rsaBasePayload, size);
    const res = await measureRsaSignTime(privateKey, payload, { runs: rsaRuns, warmup: rsaWarmup });
    const stats = res.stats || res;
    const entry = {
      component: 'RSA Signature',
      dataset: `${size} bytes`,
      average: stats.average,
      median: stats.median,
      minimum: stats.min,
      maximum: stats.max
    };
    summary.push(entry);
  }

  // 2) Merkle Benchmark (transaction counts)
  const merkleSizes = [10, 50, 100, 250, 500, 1000];
  const merkleRuns = 50;
  const merkleWarmup = 5;
  for (const n of merkleSizes) {
    const txs = [];
    for (let i = 1; i <= n; i++) {
      txs.push({ tx_id: `tx-${String(i).padStart(6,'0')}`, voter_id: i, candidate_id: (i%10)+1, amount:1, timestamp:'2026-01-01T00:00:00Z', metadata:`deterministic-payload-${String(i).padStart(6,'0')}` });
    }
    const res = await measureMerkleTime(txs, { runs: merkleRuns, warmup: merkleWarmup });
    const stats = res.stats || res;
    const entry = {
      component: 'Merkle Tree',
      dataset: `${n} tx`,
      average: stats.average,
      median: stats.median,
      minimum: stats.min,
      maximum: stats.max
    };
    summary.push(entry);
  }

  // 3) Block Creation Benchmark (transaction counts)
  const blockCreationSizes = [10, 50, 100, 250, 500, 1000];
  const blockCreationRuns = 50;
  const blockCreationWarmup = 5;
  for (const n of blockCreationSizes) {
    const res = await measureBlockCreationTime(n, { runs: blockCreationRuns, warmup: blockCreationWarmup });
    const stats = res.stats || res;
    const entry = {
      component: 'Block Creation',
      dataset: `${n} tx`,
      average: stats.average,
      median: stats.median,
      minimum: stats.min,
      maximum: stats.max
    };
    summary.push(entry);
  }

  // 4) Blockchain Verification Benchmark (block counts)
  const chainSizes = [10, 50, 100, 250, 500, 1000];
  const chainRuns = 50;
  const chainWarmup = 5;
  for (const n of chainSizes) {
    const res = await measureBlockchainVerificationTime(n, { runs: chainRuns, warmup: chainWarmup });
    const stats = res.stats || res;
    const entry = {
      component: 'Blockchain Verification',
      dataset: `${n} blocks`,
      average: stats.average,
      median: stats.median,
      minimum: stats.min,
      maximum: stats.max
    };
    summary.push(entry);
  }

  // Write summary CSV
  const csvHeader = 'Component,Average,Median,Minimum,Maximum,Dataset';
  const csvRows = summary.map(s => `${s.component},${s.average},${s.median},${s.minimum},${s.maximum},"${s.dataset}"`);
  const csv = [csvHeader, ...csvRows].join('\n');
  fs.writeFileSync('benchmark/benchmark_summary.csv', csv, 'utf8');

  // Write JSON
  fs.writeFileSync('benchmark/benchmark_summary.json', JSON.stringify(summary, null, 2), 'utf8');

  // Write Markdown report
  const mdLines = [];
  mdLines.push('# Benchmark Summary\n');
  const grouped = summary.reduce((acc, cur) => {
    acc[cur.component] = acc[cur.component] || [];
    acc[cur.component].push(cur);
    return acc;
  }, {});

  for (const comp of Object.keys(grouped)) {
    mdLines.push(`## ${comp}\n`);
    mdLines.push('| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |');
    mdLines.push('|---:|---:|---:|---:|---:|');
    for (const row of grouped[comp]) {
      mdLines.push(`| ${row.dataset} | ${row.average} | ${row.median} | ${row.minimum} | ${row.maximum} |`);
    }
    mdLines.push('\n');
  }

  // Identify component that contributes the largest execution time (by median across datasets)
  let maxMedian = -Infinity;
  let maxEntry = null;
  for (const e of summary) {
    if (typeof e.median === 'number' && e.median > maxMedian) {
      maxMedian = e.median;
      maxEntry = e;
    }
  }

  if (maxEntry) {
    mdLines.push('## Dominant Component\n');
    mdLines.push(`The component with the largest median execution time in these experiments is **${maxEntry.component}** (dataset: ${maxEntry.dataset}) with median = ${maxEntry.median} ms and average = ${maxEntry.average} ms.`);
  }

  fs.writeFileSync('benchmark/benchmark_summary.md', mdLines.join('\n'), 'utf8');

  // Attempt to gracefully close any resources that may keep the Node event loop alive.
  // The shared DB connection (config/db) uses a persistent mysql connection that may
  // have been initialized indirectly by required modules. If present, call end()
  // and await its completion so the process can exit naturally.
  async function closeResources() {
    try {
      const db = require('../config/db');
      if (db && typeof db.end === 'function') {
        await new Promise((resolve) => {
          try {
            db.end(() => resolve());
          } catch (e) {
            // Some mysql clients may throw synchronously; ignore and resolve.
            resolve();
          }
        });
      }
    } catch (e) {
      // ignore errors during cleanup
    }
  }

  await closeResources();

}

run().catch(err => {
  console.error('Error running benchmarks:', err);
  process.exit(1);
});
