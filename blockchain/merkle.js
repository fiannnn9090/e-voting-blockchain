const SHA256 = require("crypto-js/sha256");

/**
 * Hash satu transaksi (leaf node) menggunakan SHA-256.
 * Representasi transaksi di-JSON.stringify dulu supaya deterministik.
 */
function hashTransaction(tx) {
  return SHA256(JSON.stringify(tx)).toString();
}

/**
 * Hash gabungan dua node anak (internal node) menjadi satu parent node.
 * H(parent) = SHA256(H(left) + H(right))
 */
function hashPair(left, right) {
  return SHA256(left + right).toString();
}

/**
 * Membangun seluruh layer Merkle Tree dari daftar transaksi, lalu
 * mengembalikan root beserta seluruh layer (berguna untuk membuat proof).
 *
 * Aturan standar Merkle Tree:
 * - Leaf ke-i = SHA256(transaksi ke-i)
 * - Jika jumlah node pada satu layer ganjil, node terakhir diduplikasi
 *   supaya bisa dipasangkan (aturan yang sama dipakai Bitcoin).
 * - Layer di atasnya = SHA256(gabungan tiap pasangan node), diulang
 *   sampai tersisa 1 node -> itulah Merkle Root.
 *
 * @param {Array} transactions - daftar transaksi dalam satu block
 * @returns {{ root: string, layers: string[][] }}
 */
function buildMerkleTree(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    // Block tanpa transaksi (mis. genesis block) -> root didefinisikan
    // sebagai hash string kosong, konsisten & deterministik.
    const emptyRoot = SHA256("").toString();
    return { root: emptyRoot, layers: [[emptyRoot]] };
  }

  let currentLayer = transactions.map(hashTransaction);
  const layers = [currentLayer];

  while (currentLayer.length > 1) {
    const nextLayer = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      // Jika ganjil, duplikasi node terakhir sebagai pasangannya
      const right = currentLayer[i + 1] !== undefined ? currentLayer[i + 1] : left;
      nextLayer.push(hashPair(left, right));
    }

    currentLayer = nextLayer;
    layers.push(currentLayer);
  }

  return { root: currentLayer[0], layers };
}

/**
 * Shortcut untuk langsung mendapatkan Merkle Root dari daftar transaksi.
 */
function getMerkleRoot(transactions) {
  return buildMerkleTree(transactions).root;
}

/**
 * Verifikasi bahwa Merkle Root yang tersimpan di block benar-benar
 * merupakan hasil perhitungan dari transaksi yang ada di block tsb.
 * Kalau ada 1 saja transaksi yang berubah, root hasil rekalkulasi akan
 * berbeda (efek avalanche SHA-256) -> return false.
 */
function verifyMerkleRoot(transactions, expectedRoot) {
  if (!expectedRoot) return false;
  return getMerkleRoot(transactions) === expectedRoot;
}

/**
 * (Bonus, opsional dipakai) Membuat Merkle Proof untuk satu transaksi,
 * yaitu daftar sibling hash yang dibutuhkan untuk membuktikan transaksi
 * tsb termasuk dalam Merkle Root tanpa perlu membuka semua transaksi lain.
 */
function getMerkleProof(transactions, txIndex) {
  const { layers } = buildMerkleTree(transactions);
  const proof = [];
  let index = txIndex;

  for (let level = 0; level < layers.length - 1; level++) {
    const layer = layers[level];
    const isRightNode = index % 2 === 1;
    const pairIndex = isRightNode ? index - 1 : index + 1;
    const siblingHash = layer[pairIndex] !== undefined ? layer[pairIndex] : layer[index];

    proof.push({ hash: siblingHash, position: isRightNode ? "left" : "right" });
    index = Math.floor(index / 2);
  }

  return proof;
}

/**
 * (Bonus, opsional dipakai) Verifikasi Merkle Proof suatu transaksi
 * terhadap Merkle Root, tanpa butuh daftar transaksi lain sama sekali.
 */
function verifyMerkleProof(tx, proof, expectedRoot) {
  let computedHash = hashTransaction(tx);

  for (const step of proof) {
    computedHash = step.position === "left"
      ? hashPair(step.hash, computedHash)
      : hashPair(computedHash, step.hash);
  }

  return computedHash === expectedRoot;
}

module.exports = {
  hashTransaction,
  buildMerkleTree,
  getMerkleRoot,
  verifyMerkleRoot,
  getMerkleProof,
  verifyMerkleProof
};
