const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { generateKeyPair } = require("../blockchain/keys");
const { recordAuditLog } = require("../utils/auditLog");
const { resetChain } = require("./blockchainService");

function getUsers(callback) {
  db.query(
    "SELECT id, nim, nama, sudah_vote FROM users ORDER BY id",
    callback
  );
}

function addUser(req, auditChain) {
  return new Promise((resolve) => {
    const { nim, nama, password } = req.body;

    if (!nim || !nama || !password) {
      return resolve({ ok: false, message: "NIM, nama, dan password wajib diisi" });
    }

    db.query("SELECT id FROM users WHERE nim = ?", [nim], (err, result) => {
      if (err) return resolve({ ok: false, message: "Database error" });
      if (result.length > 0) {
        return resolve({ ok: false, message: `NIM ${nim} sudah terdaftar` });
      }

      const { publicKey, privateKey } = generateKeyPair();
      const hashedPassword = bcrypt.hashSync(password, 10);

      db.query(
        "INSERT INTO users (nim, nama, password, sudah_vote, public_key, private_key) VALUES (?, ?, ?, FALSE, ?, ?)",
        [nim, nama, hashedPassword, publicKey, privateKey],
        async (err) => {
          if (err) return resolve({ ok: false, message: "Gagal menambahkan user" });
          await recordAuditLog(auditChain, req, "ADD_USER", `admin (nim baru: ${nim})`);
          resolve({ ok: true });
        }
      );
    });
  });
}

function deleteUser(req, auditChain) {
  return new Promise((resolve) => {
    const { id } = req.params;
    db.query("DELETE FROM users WHERE id = ?", [id], async (err) => {
      if (err) return resolve({ ok: false, message: "Gagal hapus user" });
      await recordAuditLog(auditChain, req, "DELETE_USER", `admin (id user: ${id})`);
      resolve({ ok: true });
    });
  });
}

function resetUserVote(req, auditChain) {
  return new Promise((resolve) => {
    const { id } = req.params;

    db.query("DELETE FROM votes WHERE user_id = ?", [id], (err) => {
      if (err) return resolve({ ok: false, message: "Gagal hapus vote" });

      db.query("UPDATE users SET sudah_vote = FALSE WHERE id = ?", [id], async (err) => {
        if (err) return resolve({ ok: false, message: "Gagal reset status" });
        await recordAuditLog(auditChain, req, "RESET_VOTE_USER", `admin (id user: ${id})`);
        resolve({ ok: true });
      });
    });
  });
}

function resetAll(req, votingChain, auditChain) {
  return new Promise((resolve) => {
    db.query("DELETE FROM votes", async (err) => {
      if (err) return resolve({ ok: false, message: "Gagal hapus semua vote" });

      db.query("UPDATE users SET sudah_vote = FALSE", async (err) => {
        if (err) return resolve({ ok: false, message: "Gagal reset semua status" });

        try {
          await resetChain(votingChain);
          await recordAuditLog(auditChain, req, "RESET_VOTE_ALL", "admin");
          resolve({ ok: true });
        } catch (e) {
          console.error("Reset blockchain error:", e);
          resolve({ ok: false, message: "Gagal reset blockchain" });
        }
      });
    });
  });
}

module.exports = { getUsers, addUser, deleteUser, resetUserVote, resetAll };