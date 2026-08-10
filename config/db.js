const mysql = require("mysql2");

const connectionConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "evoting",
  port: Number(process.env.DB_PORT || 3306)
};

// Export helper to create ad-hoc connections (used by benchmark initializer)
function createAdhocConnection(override = {}) {
  const cfg = Object.assign({}, connectionConfig, override);
  return mysql.createConnection(cfg);
}

module.exports.createAdhocConnection = createAdhocConnection;

let dbConnection = null;

function initDbConnection() {
  if (dbConnection) return dbConnection;

  dbConnection = mysql.createConnection(connectionConfig);
  dbConnection.connect((err) => {
    if (err) {
    } else {
    }
  });

  return dbConnection;
}

/**
 * Menutup koneksi MySQL singleton (jika sudah pernah dibuka) dan
 * mengosongkan cache-nya, supaya proses Node dapat exit secara alami.
 *
 * Design intent: Express server (server.js) TIDAK PERNAH memanggil ini --
 * server memang dimaksudkan hidup selamanya, jadi koneksi singleton memang
 * seharusnya tetap terbuka sepanjang proses berjalan. Helper ini khusus
 * untuk CLI tool satu-kali (mis. validation/run_integrity_validation.js)
 * yang perlu exit otomatis setelah selesai, tanpa process.exit() paksa
 * yang bisa menyembunyikan resource leak lain di masa depan.
 *
 * Aman dipanggil meski koneksi belum pernah dibuka sama sekali (no-op).
 *
 * @returns {Promise<void>}
 */
function closeConnection() {
  return new Promise((resolve) => {
    if (!dbConnection) return resolve();
    const conn = dbConnection;
    dbConnection = null; // reset dulu -- akses berikutnya lazy-reinit koneksi baru
    conn.end(() => resolve()); // abaikan error close, tujuan utamanya proses bisa exit
  });
}

// Anggota milik modul ini sendiri (bukan bagian dari koneksi mysql2).
// Diperiksa LEBIH DULU di trap get/set Proxy di bawah, supaya
// mengakses/mengassign properti ini TIDAK memicu initDbConnection() --
// termasuk closeConnection() itu sendiri, yang harus bisa dipanggil tanpa
// membuka koneksi baru hanya untuk menutupnya.
const ownMembers = { createAdhocConnection, closeConnection };

const db = new Proxy({}, {
  get(target, prop) {
    if (prop in ownMembers) return ownMembers[prop];
    const connection = initDbConnection();
    const value = connection[prop];
    return typeof value === "function" ? value.bind(connection) : value;
  },
  set(target, prop, value) {
    if (prop in ownMembers) { ownMembers[prop] = value; return true; }
    const connection = initDbConnection();
    connection[prop] = value;
    return true;
  },
  has(target, prop) {
    if (prop in ownMembers) return true;
    return prop in initDbConnection();
  },
  ownKeys() {
    return Array.from(new Set([...Reflect.ownKeys(initDbConnection()), ...Object.keys(ownMembers)]));
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop in ownMembers) return { configurable: true, enumerable: true, value: ownMembers[prop] };
    return Object.getOwnPropertyDescriptor(initDbConnection(), prop);
  }
});

module.exports = db;
// attach helper to same export so callers can create ad-hoc connections
module.exports.createAdhocConnection = createAdhocConnection;