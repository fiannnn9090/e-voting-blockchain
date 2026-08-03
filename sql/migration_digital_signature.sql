-- Migrasi: menambahkan dukungan Digital Signature
-- Jalankan sekali di database `evoting` yang sudah ada.

-- 1. Setiap user butuh pasangan public/private key
ALTER TABLE users
  ADD COLUMN public_key TEXT NULL,
  ADD COLUMN private_key TEXT NULL;

-- 2. Setiap block butuh menyimpan signature + public key yang dipakai untuk sign
ALTER TABLE blockchain
  ADD COLUMN signature TEXT NULL,
  ADD COLUMN public_key TEXT NULL;
