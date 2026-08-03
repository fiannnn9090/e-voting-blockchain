const candidateLedgerService = require("../services/candidateLedgerService");
const candidateProjectionService = require("../services/candidateProjectionService");

function getPublicCandidates(req, res) {
  candidateProjectionService.getActiveCandidates((err, result) => {
    if (err) {
      console.error("getPublicCandidates DB error:", err);
      return res.json({ message: "Database error" });
    }
    res.json(result);
  });
}

function getAllCandidatesAdmin(req, res) {
  candidateProjectionService.getAllCandidates((err, result) => {
    if (err) {
      console.error("getAllCandidatesAdmin DB error:", err);
      return res.json({ ok: false, message: "Database error" });
    }
    res.json({ ok: true, candidates: result });
  });
}

async function submitTransaction(req, res) {
  const { tx_type, candidate_ref, payload, reason } = req.body;
  const candidateChain = req.app.locals.candidateChain;
  const actorUsername = req.session?.admin ? "admin" : "unknown";

  const result = await candidateLedgerService.submitTransaction(
    { tx_type, candidate_ref, payload, reason, actorUsername },
    candidateChain
  );

  if (!result.ok) {
    return res.json(result);
  }

  try {
    await candidateProjectionService.syncAfterTransaction(
      result.transaction,
      result.blockIndex,
      candidateChain
    );
  } catch (err) {
    console.error("Gagal sinkronisasi proyeksi Candidate Ledger:", err.message);
    return res.json({
      ok: true,
      transaction: result.transaction,
      blockIndex: result.blockIndex,
      warning: "Transaksi tersimpan di ledger, tapi sinkronisasi proyeksi database gagal. Jalankan resync."
    });
  }

  res.json({ ok: true, transaction: result.transaction, blockIndex: result.blockIndex });
}

function getBlocks(req, res) {
  res.json(req.app.locals.candidateChain.chain);
}

function validate(req, res) {
  res.json({ valid: req.app.locals.candidateChain.isChainValid() });
}

function getHistory(req, res) {
  const { ref } = req.params;
  const candidateChain = req.app.locals.candidateChain;

  const history = [];
  for (const block of candidateChain.chain) {
    if (block.index === 0) continue;
    for (const tx of block.transactions) {
      if (tx.candidate_ref === ref) {
        history.push({ ...tx, block_index: block.index });
      }
    }
  }

  res.json({ ok: true, candidate_ref: ref, history });
}

async function resync(req, res) {
  try {
    const result = await candidateProjectionService.resyncFromGenesis(req.app.locals.candidateChain);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Resync Candidate Ledger error:", err.message);
    res.json({ ok: false, message: "Gagal melakukan resync" });
  }
}

async function getStatus(req, res) {
  try {
    const locked = await candidateLedgerService.isLedgerLocked();
    const candidateChain = req.app.locals.candidateChain;
    res.json({
      ok: true,
      locked,
      mode: locked ? "LOCKED" : "OPEN",
      totalBlocks: candidateChain.chain.length,
      latestBlockIndex: candidateChain.chain.length - 1
    });
  } catch (err) {
    console.error("getStatus Candidate Ledger error:", err.message);
    res.json({ ok: false, message: "Gagal mengambil status ledger" });
  }
}

async function migrateLegacy(req, res) {
  try {
    const migrated = await candidateProjectionService.migrateLegacyCandidates(req.app.locals.candidateChain);
    res.json({ ok: true, migratedCount: migrated.length, migrated });
  } catch (err) {
    console.error("Migrasi kandidat lama gagal:", err.message);
    res.json({ ok: false, message: "Gagal migrasi kandidat lama" });
  }
}

module.exports = {
  getPublicCandidates,
  migrateLegacy,
  getAllCandidatesAdmin,
  submitTransaction,
  getBlocks,
  validate,
  getHistory,
  resync,
  getStatus
};