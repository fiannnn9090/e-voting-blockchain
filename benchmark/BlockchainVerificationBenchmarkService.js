const { Blockchain, Block } = require('../blockchain/blockchain');
const { generateKeyPair, signData } = require('../blockchain/keys');
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

function generateDeterministicTxForBlock(blockIndex) {
  return {
    tx_id: `blk-${String(blockIndex).padStart(6,'0')}`,
    voter_id: blockIndex,
    candidate_id: (blockIndex % 10) + 1,
    amount: 1,
    timestamp: `2026-01-01T00:00:00Z`,
    metadata: `block-payload-${String(blockIndex).padStart(6,'0')}`
  };
}

async function prepareChain(numBlocks) {
  // Generate one RSA key pair used for signing all blocks (deterministic per run)
  const { publicKey, privateKey } = generateKeyPair();

  const chain = [];
  // genesis
  const genesis = new Block(0, 1609459200000, 'Genesis Block', '0');
  chain.push(genesis);

  for (let i = 1; i < numBlocks; i++) {
    const tx = generateDeterministicTxForBlock(i);
    const data = tx; // one transaction per block
    const signature = signData(privateKey, data);
    const b = new Block(i, 1609459200000, data, chain[chain.length - 1].hash, signature, publicKey);
    chain.push(b);
  }

  const bc = new Blockchain('benchmark_tmp');
  bc.chain = chain;
  return bc;
}

async function measureBlockchainVerificationTime(numBlocks, options = {}) {
  const runs = parseRuns(options.runs || 50);
  const warmup = parseWarmup(options.warmup || 5);
  const bc = await prepareChain(numBlocks);
  const results = [];

  // Warm-up
  for (let w = 0; w < warmup; w += 1) {
    try {
      bc.isChainValid();
    } catch (e) { /* ignore */ }
  }

  for (let i = 0; i < runs; i += 1) {
    const start = process.hrtime.bigint();
    const valid = bc.isChainValid();
    const end = process.hrtime.bigint();
    const executionTimeMs = Number(end - start) / 1e6;
    results.push({ executionTimeMs: Number(executionTimeMs.toFixed(3)), valid });
  }

  const values = results.map(r => r.executionTimeMs);
  const stats = computeStats(values);
  const metadata = { numBlocks };
  return runs === 1 ? { ...results[0], ...stats, metadata } : { runs, results, stats, metadata };
}

module.exports = { measureBlockchainVerificationTime };
