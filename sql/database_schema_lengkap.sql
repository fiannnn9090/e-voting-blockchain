-- ============================================================
-- SKEMA DATABASE LENGKAP - E-VOTING PSEUDO-BLOCKCHAIN
-- (Digital Signature + Merkle Tree + Audit Log)
-- Jalankan sekali di database `evoting` yang kosong/baru.
-- ============================================================

CREATE DATABASE IF NOT EXISTS evoting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE evoting;

-- ─── Users (voter) ──────────────────────────────────────────────
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nim VARCHAR(50) NOT NULL UNIQUE,
  nama VARCHAR(150) NOT NULL,
  password VARCHAR(255) NOT NULL,
  sudah_vote BOOLEAN NOT NULL DEFAULT FALSE,
  public_key TEXT NULL,   -- untuk digital signature saat voting
  private_key TEXT NULL   -- untuk digital signature saat voting
);

-- ─── Kandidat ───────────────────────────────────────────────────
CREATE TABLE candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama_kandidat VARCHAR(150) NOT NULL
);

-- ─── Votes ──────────────────────────────────────────────────────
CREATE TABLE votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  candidate_id INT NOT NULL,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- ─── Pengaturan Pemilihan ───────────────────────────────────────
CREATE TABLE election_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_name VARCHAR(150) NOT NULL DEFAULT 'Pemilihan',
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  start_time DATETIME NULL,
  end_time DATETIME NULL
);

-- Baris default wajib ada (server.js selalu asumsikan id = 1 sudah ada)
INSERT INTO election_settings (id, election_name, is_open) VALUES (1, 'Pemilihan Ketua', FALSE);

-- ─── Blockchain (hash chain + digital signature + merkle root) ──
CREATE TABLE blockchain (
  id INT AUTO_INCREMENT PRIMARY KEY,
  block_index INT NOT NULL,
  timestamp BIGINT NOT NULL,
  data TEXT NOT NULL,
  previous_hash VARCHAR(255) NOT NULL,
  hash VARCHAR(255) NOT NULL,
  signature TEXT NULL,        -- tanda tangan digital atas transaksi block ini
  public_key TEXT NULL,       -- public key yang dipakai untuk sign block ini
  merkle_root VARCHAR(255) NULL  -- merkle root dari seluruh transaksi di block ini
);

-- ─── Audit Log ──────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  username VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Setelah ini dijalankan:
-- - Tambahkan kandidat lewat: INSERT INTO candidates (nama_kandidat) VALUES (...);
-- - Tambahkan user voter lewat admin panel (/admin.html), BUKAN lewat SQL manual,
--   supaya otomatis dapat public_key/private_key.
-- - Genesis block di tabel `blockchain` dibuat OTOMATIS oleh server.js
--   saat pertama kali dijalankan (Blockchain.create()) -- jangan diisi manual.
-- - Login admin (admin/admin123) hardcoded di server.js, tidak perlu row di DB.
-- ============================================================
