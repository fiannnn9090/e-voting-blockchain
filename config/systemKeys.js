const fs = require("fs");
const path = require("path");
const { generateKeyPair } = require("../blockchain/keys");

// Audit log tidak ditandatangani oleh voter (bukan hasil aksi voting),
// jadi dibutuhkan 1 keypair milik SISTEM (server) untuk menandatangani
// setiap block audit log. Keypair ini di-generate SEKALI lalu disimpan
// ke disk supaya tetap sama walau server di-restart -- kalau tiap
// restart keypair beda, block audit log lama akan gagal verifikasi
// signature (jadi keliatan invalid padahal aslinya valid).
const KEYS_FILE = path.join(__dirname, "system-keys.json");

let cachedKeys = null;

function getSystemKeys() {
  if (cachedKeys) return cachedKeys;

  if (fs.existsSync(KEYS_FILE)) {
    cachedKeys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
    return cachedKeys;
  }

  const keys = generateKeyPair();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  console.log("🔑 System keypair untuk audit log dibuat di", KEYS_FILE);
  cachedKeys = keys;
  return cachedKeys;
}

module.exports = { getSystemKeys };
