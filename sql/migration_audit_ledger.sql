-- Migrasi: Audit Ledger
-- Jalankan sekali di database `evoting` yang sudah ada.
-- Aditif -- tidak mengubah/menghapus tabel `blockchain` atau `audit_logs` yang sudah ada.

CREATE TABLE IF NOT EXISTS audit_ledger_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  block_index INT NOT NULL,
  timestamp BIGINT NOT NULL,
  data JSON NOT NULL,
  previous_hash VARCHAR(255) NOT NULL,
  hash VARCHAR(255) NOT NULL,
  merkle_root VARCHAR(255) NOT NULL,
  signature TEXT NULL,
  public_key TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_audit_block_index (block_index)
);