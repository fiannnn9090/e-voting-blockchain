const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { recordAuditLog } = require("../utils/auditLog");

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD_HASH = "$2b$10$wOm/Y7UnUMT.aZrehPyf9uR6azUQHF0U1t6kVThePCuGIm3y63EMO";

function findUserByNim(nim, callback) {
  db.query("SELECT * FROM users WHERE nim = ?", [nim], callback);
}

function verifyAdminCredentials(username, password) {
  return username === ADMIN_USERNAME && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
}

function loginUser(req, auditChain) {
  return new Promise((resolve) => {
    const { nim, password } = req.body;

    if (!nim || !password) {
      return resolve({ message: "NIM dan password wajib diisi" });
    }

    findUserByNim(nim, async (err, result) => {
      if (err) {
        console.error("Login DB error:", err);
        return resolve({ message: "Database error" });
      }
      if (result.length === 0) {
        return resolve({ message: "NIM atau password salah" });
      }

      const user = result[0];
      const isBcryptHash = typeof user.password === "string" && user.password.startsWith("$2");
      let passwordValid;

      if (isBcryptHash) {
        passwordValid = bcrypt.compareSync(password, user.password);
      } else {
        // Migrasi otomatis: user lama yang password-nya masih plaintext.
        // Kalau cocok, langsung di-hash & disimpan ulang.
        passwordValid = password === user.password;
        if (passwordValid) {
          const newHash = bcrypt.hashSync(password, 10);
          db.query("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
          user.password = newHash;
        }
      }

      if (!passwordValid) {
        return resolve({ message: "NIM atau password salah" });
      }
      req.session.user = user;
      await recordAuditLog(auditChain, req, "LOGIN_USER");
      resolve({ message: "Login berhasil", user: result[0] });
    });
  });
}

async function logoutUser(req, auditChain) {
  await recordAuditLog(auditChain, req, "LOGOUT_USER");
  req.session.destroy();
  return { message: "Logout berhasil" };
}

async function loginAdmin(req, auditChain) {
  const { username, password } = req.body;
  if (verifyAdminCredentials(username, password)) {
    req.session.admin = true;
    await recordAuditLog(auditChain, req, "LOGIN_ADMIN", username);
    return { ok: true };
  } else {
    return { ok: false, message: "Username atau password admin salah" };
  }
}

async function logoutAdmin(req, auditChain) {
  await recordAuditLog(auditChain, req, "LOGOUT_ADMIN", "admin");
  req.session.admin = false;
  return { ok: true };
}

module.exports = {
  ADMIN_USERNAME,
  findUserByNim,
  verifyAdminCredentials,
  loginUser,
  logoutUser,
  loginAdmin,
  logoutAdmin
};