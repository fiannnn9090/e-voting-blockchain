const SHA256 = require("crypto-js/sha256");
const db = require("../config/db");
const { verifySignature } = require("./keys");
const { getMerkleRoot, verifyMerkleRoot } = require("./merkle");

class Block {
  // signature & publicKey opsional -> genesis block tetap bisa dibuat tanpa signature
  constructor(index, timestamp, data, previousHash = "", signature = null, publicKey = null) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;             // tetap dipertahankan (backward compatible, dipakai server.js & frontend)

    // Block sekarang dianggap berisi DAFTAR transaksi. Selama ini tiap
    // block cuma punya 1 vote, jadi kalau `data` bukan array, bungkus
    // jadi array 1 elemen -> tidak perlu ubah cara server.js manggil Block().
    this.transactions = Array.isArray(data) ? data : [data];

    this.previousHash = previousHash;
    this.signature = signature;   // tanda tangan digital atas `data`, ditandatangani pakai private key voter
    this.publicKey = publicKey;   // public key voter, dipakai untuk verifikasi signature

    // Merkle Root dari seluruh transaksi dalam block ini
    this.merkleRoot = getMerkleRoot(this.transactions);

    this.hash = this.calculateHash();
  }

  calculateHash() {
    // Hash block sekarang dihitung dari Merkle Root, bukan lagi dari
    // JSON.stringify(data) mentah. Ini standar pada blockchain nyata:
    // block hash mengikat SATU representasi ringkas (Merkle Root) dari
    // SELURUH transaksi, bukan data mentah satu per satu.
    return SHA256(
      this.index +
      this.previousHash +
      this.timestamp +
      this.merkleRoot
    ).toString();
  }
}

class Blockchain {
  // tableName: nama tabel penyimpanan block untuk instance ledger ini.
  // Default "blockchain" -> mempertahankan perilaku asli (dipakai Vote Ledger
  // saat ini) tanpa perubahan apa pun bagi kode yang sudah memanggil
  // `new Blockchain()` / `Blockchain.create()` tanpa argumen.
  constructor(tableName = "blockchain") {
    this.chain = [];
    this.tableName = tableName;
  }

  // Gunakan ini untuk inisialisasi: const votingChain = await Blockchain.create()
  // Untuk ledger lain, mis. Candidate Ledger:
  //   const candidateChain = await Blockchain.create("candidate_ledger_blocks")
  static async create(tableName = "blockchain") {
    const bc = new Blockchain(tableName);
    await bc.loadBlockchain();

    if (bc.chain.length === 0) {
      const genesis = bc.createGenesisBlock();
      await bc.saveBlock(genesis);
      bc.chain.push(genesis);
    }

    return bc;
  }

  createGenesisBlock() {
    return new Block(0, Date.now(), "Genesis Block", "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  async addBlock(newBlock) {
    newBlock.previousHash = this.getLatestBlock().hash;
    newBlock.hash = newBlock.calculateHash();
    this.chain.push(newBlock);
    await this.saveBlock(newBlock);
  }

  saveBlock(block) {
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO ${this.tableName} (block_index, timestamp, data, previous_hash, hash, signature, public_key, merkle_root)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          block.index,
          block.timestamp,
          JSON.stringify(block.data),
          block.previousHash,
          block.hash,
          block.signature || null,
          block.publicKey || null,
          block.merkleRoot
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  loadBlockchain() {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM ${this.tableName} ORDER BY block_index ASC`,
        (err, rows) => {
          if (err) return reject(err);

          this.chain = rows.map(row => {
            const block = new Block(
              row.block_index,
              row.timestamp,
              JSON.parse(row.data),
              row.previous_hash,
              row.signature || null,
              row.public_key || null
            );
            block.hash = row.hash;             // pakai hash asli dari DB
            block.merkleRoot = row.merkle_root; // pakai merkle root asli dari DB
            return block;
          });

          resolve();
        }
      );
    });
  }

  async resetChain() {
    await new Promise((resolve, reject) => {
      db.query(`DELETE FROM ${this.tableName}`, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const genesis = this.createGenesisBlock();
    await this.saveBlock(genesis);
    this.chain = [genesis];
  }

  hackBlock(index, newData) {
    if (index > 0 && index < this.chain.length) {
      this.chain[index].data = newData;
      this.chain[index].transactions = [newData];
      // Sengaja TIDAK update merkleRoot maupun hash supaya chain jadi invalid
    }
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];

      // ── Lapisan 1 (existing, tidak diubah secara konsep): integritas hash SHA-256 ──
      // Bedanya sekarang hash dihitung dari merkleRoot, bukan dari data mentah
      // (lihat calculateHash()) -- Block.calculateHash() dipakai ulang di sini
      // supaya rumusnya selalu konsisten dengan cara block itu sendiri menghitung hash.
      const recalculatedHash = curr.calculateHash();
      if (curr.hash !== recalculatedHash) return false;
      if (curr.previousHash !== prev.hash) return false;

      // ── Lapisan 2 (baru): integritas Merkle Root ──
      // Pastikan merkleRoot yang tersimpan benar-benar hasil hitungan dari
      // transaksi yang ada di block ini. Kalau salah 1 transaksi diubah,
      // root hasil rekalkulasi pasti berbeda -> block dianggap tidak valid.
      const merkleValid = verifyMerkleRoot(curr.transactions, curr.merkleRoot);
      if (!merkleValid) return false;

      // ── Lapisan 3 (existing): autentikasi digital signature ──
      // Setiap block hasil voting (index > 0) wajib punya signature + publicKey
      // yang valid. Kalau tidak ada / tidak cocok, block dianggap tidak valid.
      const signatureValid = verifySignature(curr.publicKey, curr.data, curr.signature);
      if (!signatureValid) return false;
    }
    return true;
  }
}

module.exports = { Blockchain, Block };