-- Migrasi: Candidate Ledger
-- Jalankan sekali di database `evoting` yang sudah ada.
-- Seluruh perubahan bersifat ADDITIVE (tidak menghapus/mengubah kolom/tabel lama),
-- supaya fitur dan data yang sudah ada tetap berjalan normal selama masa transisi.

-- 1. Tabel block untuk Candidate Ledger.
--    Struktur mengikuti pola yang sama dengan tabel `blockchain` yang sudah ada
--    (dipakai Vote Ledger saat ini), supaya konsisten dengan mekanisme
--    hash-chaining + Merkle root + signature yang sudah berjalan di project ini.
CREATE TABLE IF NOT EXISTS candidate_ledger_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  block_index INT NOT NULL,
  timestamp BIGINT NOT NULL,
  data JSON NOT NULL,               -- berisi array transaksi (lihat dokumen desain §1)
  previous_hash VARCHAR(255) NOT NULL,
  hash VARCHAR(255) NOT NULL,
  merkle_root VARCHAR(255) NOT NULL,
  signature TEXT NULL,
  public_key TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_candidate_block_index (block_index)
);

-- 2. Kolom tambahan pada tabel `candidates` yang sudah ada.
--    `id` (auto-increment) TIDAK diubah/dihapus, supaya relasi
--    votes.candidate_id -> candidates.id tetap utuh (lihat catatan desain §6).
ALTER TABLE candidates
  ADD COLUMN candidate_ref VARCHAR(64) NULL,
  ADD COLUMN status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN last_tx_id VARCHAR(64) NULL,
  ADD COLUMN verified_at_block_index INT NULL;

-- candidate_ref adalah identitas logis dari Candidate Ledger, harus unik.
-- Ditambahkan sebagai constraint terpisah (bukan langsung UNIQUE di ADD COLUMN)
-- supaya migrasi tetap aman dijalankan pada tabel yang sudah berisi data lama
-- (baris lama akan punya candidate_ref NULL sampai proses sinkronisasi awal
-- dijalankan / kandidat lama didaftarkan ulang lewat transaksi CANDIDATE_CREATE).
ALTER TABLE candidates
  ADD UNIQUE KEY uniq_candidate_ref (candidate_ref);

-- 3. Tabel penanda progres sinkronisasi proyeksi (dokumen desain §6, poin 3).
--    Menyimpan block terakhir dari Candidate Ledger yang sudah direplay
--    ke dalam tabel `candidates`, supaya proses sinkronisasi bisa
--    dilanjutkan (catch-up) tanpa harus selalu replay dari genesis.
CREATE TABLE IF NOT EXISTS candidate_ledger_sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_synced_block_index INT NOT NULL DEFAULT -1,
  last_synced_at TIMESTAMP NULL
);

INSERT INTO candidate_ledger_sync_state (id, last_synced_block_index, last_synced_at)
VALUES (1, -1, NULL)
ON DUPLICATE KEY UPDATE id = id;