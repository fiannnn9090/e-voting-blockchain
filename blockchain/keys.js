const crypto = require("crypto");

/**
 * Generate pasangan public/private key (RSA-2048) untuk satu user.
 * Dipanggil sekali saat user dibuat (lihat perubahan di server.js -> POST /admin/users).
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  return { publicKey, privateKey };
}

/**
 * Tanda tangani data vote menggunakan private key milik voter.
 * `data` adalah object (misal { voter, candidate }), akan di-JSON.stringify
 * dulu supaya representasinya konsisten dengan saat verifikasi.
 */
function signData(privateKey, data) {
  const payload = JSON.stringify(data);
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(payload);
  signer.end();
  return signer.sign(privateKey, "hex");
}

/**
 * Verifikasi signature suatu block menggunakan public key voter tsb.
 * Return true/false.
 */
function verifySignature(publicKey, data, signature) {
  if (!publicKey || !signature) return false;
  try {
    const payload = JSON.stringify(data);
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(payload);
    verifier.end();
    return verifier.verify(publicKey, signature, "hex");
  } catch (err) {
    // public key rusak / signature format salah -> anggap tidak valid
    return false;
  }
}

module.exports = { generateKeyPair, signData, verifySignature };
