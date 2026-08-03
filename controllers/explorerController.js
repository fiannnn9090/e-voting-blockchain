const { buildMerkleTree, getMerkleProof } = require("../blockchain/merkle");
const { verifySignature } = require("../blockchain/keys");

const LEDGER_MAP = { vote: "votingChain", candidate: "candidateChain", audit: "auditChain" };

function resolveChain(req, ledgerName) {
  const key = LEDGER_MAP[ledgerName];
  return key ? req.app.locals[key] : null;
}

function listBlocks(req, res) {
  const chain = resolveChain(req, req.params.ledger);
  if (!chain) return res.json({ ok: false, message: "Ledger tidak dikenal" });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const start = (page - 1) * limit;

  const summary = chain.chain.slice(start, start + limit).map(b => ({
    index: b.index, timestamp: b.timestamp, txCount: b.transactions.length,
    hash: b.hash, previousHash: b.previousHash, merkleRoot: b.merkleRoot
  }));

  res.json({ ok: true, total: chain.chain.length, page, limit, blocks: summary });
}

function getBlockDetail(req, res) {
  const chain = resolveChain(req, req.params.ledger);
  if (!chain) return res.json({ ok: false, message: "Ledger tidak dikenal" });
  const block = chain.chain[parseInt(req.params.index)];
  if (!block) return res.json({ ok: false, message: "Block tidak ditemukan" });
  res.json({ ok: true, block });
}

function getMerkleTree(req, res) {
  const chain = resolveChain(req, req.params.ledger);
  if (!chain) return res.json({ ok: false, message: "Ledger tidak dikenal" });
  const block = chain.chain[parseInt(req.params.index)];
  if (!block) return res.json({ ok: false, message: "Block tidak ditemukan" });
  const { root, layers } = buildMerkleTree(block.transactions);
  res.json({ ok: true, root, layers });
}

function getMerkleProofForTx(req, res) {
  const chain = resolveChain(req, req.params.ledger);
  if (!chain) return res.json({ ok: false, message: "Ledger tidak dikenal" });
  const block = chain.chain[parseInt(req.params.index)];
  if (!block) return res.json({ ok: false, message: "Block tidak ditemukan" });
  const txIndex = parseInt(req.params.txIndex);
  if (!block.transactions[txIndex]) return res.json({ ok: false, message: "Transaksi tidak ditemukan" });
  const proof = getMerkleProof(block.transactions, txIndex);
  res.json({ ok: true, transaction: block.transactions[txIndex], proof, root: block.merkleRoot });
}

function verifyBlockSignature(req, res) {
  const chain = resolveChain(req, req.params.ledger);
  if (!chain) return res.json({ ok: false, message: "Ledger tidak dikenal" });
  const block = chain.chain[parseInt(req.params.index)];
  if (!block) return res.json({ ok: false, message: "Block tidak ditemukan" });
  if (block.index === 0) {
    return res.json({ ok: true, index: 0, valid: null, note: "Genesis block tidak memiliki signature" });
  }
  const valid = verifySignature(block.publicKey, block.data, block.signature);
  res.json({ ok: true, index: block.index, valid, publicKey: block.publicKey });
}

function getHealth(req, res) {
  const result = {};
  for (const [name, key] of Object.entries(LEDGER_MAP)) {
    const chain = req.app.locals[key];
    if (!chain) { result[name] = { ok: false, message: "Ledger belum siap" }; continue; }
    result[name] = {
      ok: true,
      valid: chain.isChainValid(),
      totalBlocks: chain.chain.length,
      latestBlockIndex: chain.chain.length - 1,
      latestBlockTime: chain.chain.length > 0 ? chain.chain[chain.chain.length - 1].timestamp : null
    };
  }
  res.json({ ok: true, ledgers: result, checkedAt: Date.now() });
}

module.exports = { listBlocks, getBlockDetail, getMerkleTree, getMerkleProofForTx, verifyBlockSignature, getHealth };