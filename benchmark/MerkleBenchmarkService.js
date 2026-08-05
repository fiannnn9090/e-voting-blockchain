const { getMerkleRoot } = require('../blockchain/merkle');
const fs = require('fs');

function parseRuns(value) {
  const runs = Number(value);
  if (!Number.isFinite(runs) || runs < 1) return 1;
  return Math.min(1000, Math.floor(runs));
}

function parseWarmup(value) {
  const w = Number(value);
  if (!Number.isFinite(w) || w < 0) return 5; // default 5 warm-up runs per requirement
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

function computeMerkleMetadata(numTransactions) {
  // Compute tree height, leaf/internal hash counts and total hash operations
  // without invoking production merkle code — just a deterministic simulation of the
  // production algorithm which duplicates the last node when a level has odd count.
  const n = Math.max(0, Math.floor(numTransactions));
  if (n === 0) return { numTransactions: 0, treeHeight: 0, leafHashes: 0, internalHashes: 0, totalHashOperations: 0 };

  let nodes = n;
  let levels = 1; // include leaf level
  let internalHashes = 0;

  while (nodes > 1) {
    const parentCount = Math.ceil(nodes / 2);
    internalHashes += parentCount; // one hash per parent node computed at this level
    nodes = parentCount;
    levels += 1;
  }

  const leafHashes = n; // each leaf is hashed once
  const totalHashOperations = leafHashes + internalHashes;
  return {
    numTransactions: n,
    treeHeight: levels,
    leafHashes,
    internalHashes,
    totalHashOperations
  };
}

async function measureMerkleTime(transactions, options = {}) {
  const runs = parseRuns(options.runs || 50);
  const warmup = parseWarmup(options.warmup || 5);
  const results = [];

  // metadata (deterministic, independent of timing)
  const metadata = computeMerkleMetadata(Array.isArray(transactions) ? transactions.length : 0);

  // Warm-up runs (not recorded)
  for (let w = 0; w < warmup; w += 1) {
    try { getMerkleRoot(transactions); } catch (e) { /* ignore */ }
  }

  for (let i = 0; i < runs; i += 1) {
    const start = process.hrtime.bigint();
    const root = getMerkleRoot(transactions);
    const end = process.hrtime.bigint();
    const executionTimeMs = Number(end - start) / 1e6;
    results.push({ executionTimeMs: Number(executionTimeMs.toFixed(3)) });
  }

  const values = results.map(r => r.executionTimeMs);
  const stats = computeStats(values);
  const base = runs === 1 ? { ...results[0], ...stats } : { runs, results, stats };
  return { ...base, metadata };
}

module.exports = { measureMerkleTime, computeStats };
