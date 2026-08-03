const db = require("../config/db");

function getAllTransactionsInOrder(candidateChain) {
  const allTx = [];
  for (const block of candidateChain.chain) {
    if (block.index === 0) continue;
    for (const tx of block.transactions) {
      allTx.push({ ...tx, __block_index: block.index });
    }
  }
  return allTx;
}

function upsertCandidateRow({ candidate_ref, nama_kandidat, deskripsi, foto_url, status, last_tx_id, verified_at_block_index }) {
  return new Promise((resolve, reject) => {
    db.query("SELECT id FROM candidates WHERE candidate_ref = ?", [candidate_ref], (err, rows) => {
      if (err) return reject(err);

      if (rows.length > 0) {
        db.query(
          `UPDATE candidates
           SET nama_kandidat = ?, deskripsi = ?, foto_url = ?, status = ?, last_tx_id = ?, verified_at_block_index = ?
           WHERE candidate_ref = ?`,
          [nama_kandidat, deskripsi, foto_url, status, last_tx_id, verified_at_block_index, candidate_ref],
          (err) => err ? reject(err) : resolve(rows[0].id)
        );
      } else {
        db.query(
          `INSERT INTO candidates (nama_kandidat, deskripsi, foto_url, candidate_ref, status, last_tx_id, verified_at_block_index)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [nama_kandidat, deskripsi, foto_url, candidate_ref, status, last_tx_id, verified_at_block_index],
          (err, result) => err ? reject(err) : resolve(result.insertId)
        );
      }
    });
  });
}

function updateSyncState(lastSyncedBlockIndex) {
  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE candidate_ledger_sync_state SET last_synced_block_index = ?, last_synced_at = NOW() WHERE id = 1",
      [lastSyncedBlockIndex],
      (err) => err ? reject(err) : resolve()
    );
  });
}

function applyTxToState(prevState, tx) {
  let { nama_kandidat, deskripsi, foto_url, status } = prevState;

  switch (tx.tx_type) {
    case "CANDIDATE_CREATE":
      nama_kandidat = tx.payload.nama_kandidat;
      deskripsi = tx.payload.deskripsi ?? null;
      foto_url = tx.payload.foto_url ?? null;
      status = "ACTIVE";
      break;
    case "CANDIDATE_UPDATE":
      nama_kandidat = tx.payload.nama_kandidat;
      if (tx.payload.deskripsi !== undefined) deskripsi = tx.payload.deskripsi;
      if (tx.payload.foto_url !== undefined) foto_url = tx.payload.foto_url;
      break;
    case "CANDIDATE_DEACTIVATE":
      status = "INACTIVE";
      break;
    case "CANDIDATE_REACTIVATE":
      status = "ACTIVE";
      break;
    case "CANDIDATE_CORRECTION":
      if (tx.payload.deskripsi !== undefined) deskripsi = tx.payload.deskripsi;
      if (tx.payload.foto_url !== undefined) foto_url = tx.payload.foto_url;
      break;
  }

  return { nama_kandidat, deskripsi, foto_url, status };
}

async function projectSingleTransaction(tx, blockIndex) {
  const existing = await new Promise((resolve, reject) => {
    db.query(
      "SELECT nama_kandidat, deskripsi, foto_url, status FROM candidates WHERE candidate_ref = ?",
      [tx.candidate_ref],
      (err, rows) => err ? reject(err) : resolve(rows[0] || { nama_kandidat: null, deskripsi: null, foto_url: null, status: "ACTIVE" })
    );
  });

  const next = applyTxToState(existing, tx);

  await upsertCandidateRow({
    candidate_ref: tx.candidate_ref,
    ...next,
    last_tx_id: tx.tx_id,
    verified_at_block_index: blockIndex
  });

  await updateSyncState(blockIndex);
}

async function resyncFromGenesis(candidateChain) {
  const allTx = getAllTransactionsInOrder(candidateChain);

  const voidedTxIds = new Set();
  for (const tx of allTx) {
    if (tx.tx_type === "CANDIDATE_VOID" && tx.payload?.void_tx_id) voidedTxIds.add(tx.payload.void_tx_id);
  }

  const stateByRef = new Map();
  for (const tx of allTx) {
    if (tx.tx_type === "CANDIDATE_VOID") continue;
    if (voidedTxIds.has(tx.tx_id)) continue;

    const prev = stateByRef.get(tx.candidate_ref) || { nama_kandidat: null, deskripsi: null, foto_url: null, status: "ACTIVE" };
    const next = applyTxToState(prev, tx);
    stateByRef.set(tx.candidate_ref, { ...next, last_tx_id: tx.tx_id, verified_at_block_index: tx.__block_index });
  }

  for (const [candidate_ref, state] of stateByRef.entries()) {
    await upsertCandidateRow({ candidate_ref, ...state });
  }

  const latestBlockIndex = candidateChain.chain.length > 0 ? candidateChain.chain[candidateChain.chain.length - 1].index : -1;
  await updateSyncState(latestBlockIndex);
  return { candidatesProcessed: stateByRef.size, latestBlockIndex };
}

async function syncAfterTransaction(tx, blockIndex, candidateChain) {
  if (tx.tx_type === "CANDIDATE_VOID") return resyncFromGenesis(candidateChain);
  await projectSingleTransaction(tx, blockIndex);
  return { candidatesProcessed: 1, latestBlockIndex: blockIndex };
}

function getActiveCandidates(callback) {
  db.query(
    "SELECT id, candidate_ref, nama_kandidat, deskripsi, foto_url, verified_at_block_index FROM candidates WHERE status = 'ACTIVE' ORDER BY id",
    callback
  );
}

function getAllCandidates(callback) {
  db.query(
    "SELECT id, candidate_ref, nama_kandidat, deskripsi, foto_url, status, last_tx_id, verified_at_block_index FROM candidates ORDER BY id",
    callback
  );
}

async function migrateLegacyCandidates(candidateChain) {
  const candidateLedgerService = require("./candidateLedgerService");
  const legacyRows = await new Promise((resolve, reject) => {
    db.query("SELECT id, nama_kandidat FROM candidates WHERE candidate_ref IS NULL", (err, rows) => err ? reject(err) : resolve(rows));
  });

  const migrated = [];
  for (const row of legacyRows) {
    const result = await candidateLedgerService.submitTransaction(
      { tx_type: "CANDIDATE_CREATE", payload: { nama_kandidat: row.nama_kandidat }, actorUsername: "migration" },
      candidateChain
    );
    if (!result.ok) continue;

    await new Promise((resolve, reject) => {
      db.query(
        "UPDATE candidates SET candidate_ref = ?, status = 'ACTIVE', last_tx_id = ?, verified_at_block_index = ? WHERE id = ?",
        [result.transaction.candidate_ref, result.transaction.tx_id, result.blockIndex, row.id],
        (err) => err ? reject(err) : resolve()
      );
    });
    migrated.push({ id: row.id, nama_kandidat: row.nama_kandidat, candidate_ref: result.transaction.candidate_ref });
  }
  return migrated;
}

module.exports = {
  resyncFromGenesis,
  syncAfterTransaction,
  getActiveCandidates,
  getAllCandidates,
  migrateLegacyCandidates
};