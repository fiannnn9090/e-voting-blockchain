const db = require("../config/db");
const { recordAuditLog } = require("../utils/auditLog");

/**
 * Ambil pengaturan election saat ini.
 * Dipindah dari server.js (GET /admin/settings) apa adanya, tanpa perubahan query.
 * callback(err, result) -> result adalah array baris hasil query (sama seperti db.query asli).
 */
function getSettings(callback) {
  db.query("SELECT * FROM election_settings LIMIT 1", callback);
}

/**
 * Toggle status buka/tutup voting.
 * Dipindah dari server.js (POST /admin/settings/toggle) apa adanya.
 * auditChain diteruskan dari luar (instance Audit Ledger, dibuat sekali saat startup server).
 *
 * @returns {Promise<Object>} object yang akan dikirim sebagai JSON response
 */
function toggleElectionStatus(req, auditChain) {
  return new Promise((resolve) => {
    db.query("SELECT is_open FROM election_settings LIMIT 1", (err, result) => {
      if (err) return resolve({ ok: false, message: "Database error" });

      const newStatus = !result[0].is_open;
      db.query(
        "UPDATE election_settings SET is_open = ? WHERE id = 1",
        [newStatus],
        async (err) => {
          if (err) return resolve({ ok: false, message: "Gagal update status" });
          await recordAuditLog(auditChain, req, "TOGGLE_ELECTION_STATUS", `admin (is_open: ${newStatus})`);
          resolve({ ok: true, is_open: newStatus });
        }
      );
    });
  });
}

/**
 * Update jadwal election (nama, waktu mulai, waktu selesai).
 * Dipindah dari server.js (POST /admin/settings/schedule) apa adanya.
 * auditChain diteruskan dari luar (instance Audit Ledger, dibuat sekali saat startup server).
 *
 * @returns {Promise<Object>} object yang akan dikirim sebagai JSON response
 */
function updateSchedule(req, auditChain) {
  return new Promise((resolve) => {
    const { election_name, start_time, end_time } = req.body;

    if (!election_name || !start_time || !end_time) {
      return resolve({ ok: false, message: "Semua field wajib diisi" });
    }
    if (new Date(start_time) >= new Date(end_time)) {
      return resolve({ ok: false, message: "Waktu mulai harus sebelum waktu selesai" });
    }

    db.query(
      "UPDATE election_settings SET election_name = ?, start_time = ?, end_time = ? WHERE id = 1",
      [election_name, start_time, end_time],
      async (err) => {
        if (err) return resolve({ ok: false, message: "Gagal simpan jadwal" });
        await recordAuditLog(auditChain, req, "UPDATE_ELECTION_SCHEDULE", `admin (${election_name})`);
        resolve({ ok: true });
      }
    );
  });
}

module.exports = { getSettings, toggleElectionStatus, updateSchedule };