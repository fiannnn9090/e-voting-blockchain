const crypto = require("crypto");
const db = require("../config/db");
const { Block } = require("../blockchain/blockchain");
const { signData } = require("../blockchain/keys");
const { getSystemKeys } = require("../config/systemKeys");

// Jenis transaksi yang sah (dokumen desain §3).
const TX_TYPES = [
  "CANDIDATE_CREATE",
  "CANDIDATE_UPDATE",
  "CANDIDATE_DEACTIVATE",
  "CANDIDATE_REACTIVATE",
  "CANDIDATE_CORRECTION",
  "CANDIDATE_VOID"
];

// Transaksi yang DILARANG saat ledger dalam mode locked (dokumen desain §2).
const LOCKED_FORBIDDEN_TYPES = [
  "CANDIDATE_CREATE",
  "CANDIDATE_UPDATE",
  "CANDIDATE_DEACTIVATE",
  "CANDIDATE_REACTIVATE"
];

// Field yang boleh disentuh oleh CANDIDATE_CORRECTION saat locked (dokumen desain §2):
// hanya field deskriptif non-esensial. "nama_kandidat" sengaja TIDAK dimasukkan
// supaya identitas kandidat yang sudah dipilih voter tidak bisa diam-diam berubah
// makna di tengah masa voting.
const CORRECTION_ALLOWED_FIELDS_WHEN_LOCKED = ["deskripsi", "foto_url"];

function generateTxId() {
  return "TX-" + crypto.randomUUID();
}

function generateCandidateRef() {
  return "CAND-" + crypto.randomUUID();
}

/**
 * Cek apakah Candidate Ledger sedang dalam mode locked.
 * Kriteria SAMA PERSIS dengan pengecekan status pemilihan di votingService.castVote()
 * (is_open, start_time) -- supaya definisi "voting sudah berjalan" konsisten
 * di seluruh sistem, bukan dua sumber kebenaran berbeda.
 */
function isLedgerLocked() {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM election_settings LIMIT 1", (err, settings) => {
      if (err) return reject(err);
      if (!settings || settings.length === 0) return resolve(false);

      const setting = settings[0];
      const now = new Date();

      if (setting.is_open) return resolve(true);
      if (setting.start_time && now >= new Date(setting.start_time)) return resolve(true);

      resolve(false);
    });
  });
}

/**
 * Ambil last_tx_id kandidat dari proyeksi (tabel candidates), dipakai untuk
 * membentuk prev_tx_ref (dokumen desain §1) dan untuk memastikan candidate_ref
 * yang direferensikan transaksi non-CREATE benar-benar sudah pernah dibuat.
 */
function findCandidateProjection(candidate_ref) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, nama_kandidat, status, last_tx_id FROM candidates WHERE candidate_ref = ?",
      [candidate_ref],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || null);
      }
    );
  });
}

/**
 * Validasi transaksi sebelum ditulis ke ledger (dokumen desain §4, Lapis 2).
 * Mengembalikan { valid: true } atau { valid: false, message }.
 */
async function validateTransaction({ tx_type, candidate_ref, payload, reason }, locked) {
  if (!TX_TYPES.includes(tx_type)) {
    return { valid: false, message: `Jenis transaksi tidak dikenal: ${tx_type}` };
  }

  // ── Pengecekan mode locked ──
  if (locked && LOCKED_FORBIDDEN_TYPES.includes(tx_type)) {
    return {
      valid: false,
      message: "Candidate Ledger sedang terkunci (voting berjalan). Hanya CANDIDATE_CORRECTION dan CANDIDATE_VOID yang diizinkan."
    };
  }

  // ── Validasi khusus per jenis transaksi ──
  if (tx_type === "CANDIDATE_CREATE") {
    if (!payload || !payload.nama_kandidat || !payload.nama_kandidat.trim()) {
      return { valid: false, message: "nama_kandidat wajib diisi untuk CANDIDATE_CREATE" };
    }
    return { valid: true };
  }

  // Selain CREATE, candidate_ref wajib merujuk kandidat yang sudah ada
  // (transaksi CREATE-nya sudah pernah tercatat di ledger).
  if (!candidate_ref) {
    return { valid: false, message: "candidate_ref wajib diisi untuk transaksi selain CANDIDATE_CREATE" };
  }
  const existing = await findCandidateProjection(candidate_ref);
  if (!existing) {
    return { valid: false, message: `candidate_ref ${candidate_ref} tidak ditemukan di ledger` };
  }

  if (tx_type === "CANDIDATE_UPDATE") {
    if (!payload || !payload.nama_kandidat || !payload.nama_kandidat.trim()) {
      return { valid: false, message: "nama_kandidat wajib diisi untuk CANDIDATE_UPDATE" };
    }
  }

  if (tx_type === "CANDIDATE_CORRECTION") {
    if (!reason || !reason.trim()) {
      return { valid: false, message: "reason wajib diisi untuk CANDIDATE_CORRECTION" };
    }
    if (locked) {
      const fields = Object.keys(payload || {});
      const disallowed = fields.filter(f => !CORRECTION_ALLOWED_FIELDS_WHEN_LOCKED.includes(f));
      if (disallowed.length > 0) {
        return {
          valid: false,
          message: `Saat ledger locked, CANDIDATE_CORRECTION hanya boleh mengubah: ${CORRECTION_ALLOWED_FIELDS_WHEN_LOCKED.join(", ")}. Field tidak diizinkan: ${disallowed.join(", ")}`
        };
      }
    }
  }

  if (tx_type === "CANDIDATE_VOID") {
    if (!reason || !reason.trim()) {
      return { valid: false, message: "reason wajib diisi untuk CANDIDATE_VOID" };
    }
    if (!payload || !payload.void_tx_id) {
      return { valid: false, message: "payload.void_tx_id wajib diisi untuk CANDIDATE_VOID (referensi transaksi yang dibatalkan)" };
    }
  }

  return { valid: true };
}

/**
 * Ajukan satu transaksi ke Candidate Ledger: validasi, bentuk transaksi,
 * tanda tangani dengan system key, bungkus jadi Block baru, tambahkan ke chain.
 *
 * candidateChain: instance Blockchain (tableName = "candidate_ledger_blocks"),
 * dibuat sekali saat startup server, sama seperti pola votingChain.
 *
 * @returns {Promise<Object>} { ok, message?, transaction?, blockIndex? }
 */
async function submitTransaction({ tx_type, candidate_ref, payload, reason, actorUsername }, candidateChain) {
  const locked = await isLedgerLocked();

  const validation = await validateTransaction({ tx_type, candidate_ref, payload, reason }, locked);
  if (!validation.valid) {
    return { ok: false, message: validation.message };
  }

  // candidate_ref baru dibuat HANYA saat CREATE (dokumen desain §1: "dihasilkan
  // sekali saat transaksi CREATE pertama, dipakai konsisten oleh transaksi berikutnya").
  const resolvedCandidateRef = tx_type === "CANDIDATE_CREATE"
    ? generateCandidateRef()
    : candidate_ref;

  // prev_tx_ref: rantai riwayat per-kandidat (dokumen desain §1).
  let prevTxRef = null;
  if (tx_type !== "CANDIDATE_CREATE") {
    const existing = await findCandidateProjection(resolvedCandidateRef);
    prevTxRef = existing ? existing.last_tx_id : null;
  }

  const { publicKey, privateKey } = getSystemKeys();
  const timestamp = Date.now();

  const transaction = {
    tx_id: generateTxId(),
    candidate_ref: resolvedCandidateRef,
    tx_type,
    payload: payload || {},
    prev_tx_ref: prevTxRef,
    actor_public_key: publicKey,
    actor: actorUsername || "admin",
    reason: reason || null,
    timestamp
  };

  // Signature atas isi transaksi (dokumen desain §1). Memakai system key
  // karena project ini belum memiliki infrastruktur keypair per-admin
  // (lihat catatan di bagian atas file ini).
  transaction.signature = signData(privateKey, transaction);

  // Block ini membungkus 1 transaksi (konsisten dengan pola block Vote/Audit
  // Ledger yang sudah ada di project ini: 1 aksi = 1 block). Struktur transaksi
  // dirancang sebagai array supaya kompatibel jika ke depannya 1 block perlu
  // menampung banyak transaksi sekaligus, tanpa perlu ubah skema block.
  const newBlock = new Block(
    candidateChain.chain.length,
    timestamp,
    [transaction],
    "",             // previousHash di-set otomatis di addBlock()
    signData(privateKey, [transaction]), // signature block-level, atas seluruh isi block
    publicKey
  );

  await candidateChain.addBlock(newBlock);

  return {
    ok: true,
    transaction,
    blockIndex: newBlock.index
  };
}

module.exports = {
  TX_TYPES,
  isLedgerLocked,
  findCandidateProjection,
  validateTransaction,
  submitTransaction
};