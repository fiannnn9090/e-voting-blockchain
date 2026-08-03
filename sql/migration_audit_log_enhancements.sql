-- Migrasi: Audit Log enhancements (filter/search/sort/export)
-- Jalankan sekali di database `evoting`. Aditif, tidak menghapus data lama.

ALTER TABLE audit_logs
  ADD COLUMN block_index INT NULL COMMENT 'index block di audit_ledger_blocks yang menyimpan entri ini';

CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_username ON audit_logs (username);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp);