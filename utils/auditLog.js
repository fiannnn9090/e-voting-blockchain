const db = require("../config/db");
const { Block } = require("../blockchain/blockchain");
const { signData } = require("../blockchain/keys");
const { getSystemKeys } = require("../config/systemKeys");

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

async function recordAuditLog(auditChain, req, action, usernameOverride = null) {
  const timestamp = Date.now();
  const username =
    usernameOverride ||
    req.session?.user?.nim ||
    (req.session?.admin ? "admin" : "unknown");
  const ipAddress = getClientIp(req);
  const sessionId = req.sessionID || "no-session";

  const logEntry = { type: "audit_log", action, user: username, ip: ipAddress, sessionId, timestamp };

  let blockIndex = null;

  if (auditChain) {
    try {
      const { publicKey, privateKey } = getSystemKeys();
      const signature = signData(privateKey, logEntry);
      const logBlock = new Block(auditChain.chain.length, timestamp, logEntry, "", signature, publicKey);
      await auditChain.addBlock(logBlock);
      blockIndex = logBlock.index;
    } catch (err) {
      console.error("Gagal mencatat audit log ke Audit Ledger:", err.message);
    }
  }

  try {
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO audit_logs (timestamp, username, action, ip_address, session_id, block_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [timestamp, username, action, ipAddress, sessionId, blockIndex],
        (err) => err ? reject(err) : resolve()
      );
    });
  } catch (err) {
    console.error("Gagal mencatat audit log ke tabel audit_logs:", err.message);
  }
}

module.exports = { recordAuditLog };