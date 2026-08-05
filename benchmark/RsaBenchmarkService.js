const { signData } = require('../blockchain/keys');

function parseRuns(value) {
  const runs = Number(value);
  if (!Number.isFinite(runs) || runs < 1) return 1;
  return Math.min(1000, Math.floor(runs));
}

function parseWarmup(value) {
  const w = Number(value);
  if (!Number.isFinite(w) || w < 0) return 3;
  return Math.min(100, Math.floor(w));
}

function computeStats(values) {
  if (!values || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = sum / values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = values.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { average: Number(avg.toFixed(3)), min: Number(min.toFixed(3)), max: Number(max.toFixed(3)), median: Number(median.toFixed(3)) };
}

async function measureRsaSignTime(privateKey, data, options = {}) {
  const runs = parseRuns(options.runs || options.count || 10);
  const warmup = parseWarmup(options.warmup || 3);
  const results = [];

  // Warm-up (not measured)
  for (let w = 0; w < warmup; w += 1) {
    try { signData(privateKey, data); } catch (e) { }
  }

  // Measured runs: do NOT store the signature to avoid measurement pollution and sensitive output
  for (let i = 0; i < runs; i += 1) {
    const start = process.hrtime.bigint();
    signData(privateKey, data);
    const end = process.hrtime.bigint();
    const executionTimeMs = Number(end - start) / 1e6;
    results.push({ executionTimeMs: Number(executionTimeMs.toFixed(3)) });
  }

  const values = results.map(r => r.executionTimeMs);
  const stats = computeStats(values);
  return runs === 1 ? { ...results[0], ...stats } : { runs, results, stats };
}

module.exports = { measureRsaSignTime };
