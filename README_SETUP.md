# E-Voting Pseudo-Blockchain — Setup

Project ini sudah dilengkapi:
1. **Digital Signature** (RSA-2048) per voter — `blockchain/keys.js`
2. **Merkle Tree** per block — `blockchain/merkle.js`
3. **Blockchain inti** dengan validasi 3 lapis (hash chain → merkle root → signature) — `blockchain/blockchain.js`
4. **Audit Log** (tabel DB + tercatat sebagai block blockchain, ditandatangani pakai system keypair) — `utils/auditLog.js` + `config/systemKeys.js`

## Cara setup dari nol

### 1. Install dependency
```bash
npm install
```

### 2. Buat database
1. Buat database MySQL.
2. Jalankan semua sql
3. npm install
4. npm start

### 3. Sesuaikan koneksi database
Cek `config/db.js`, sesuaikan host/user/password/nama database kalau berbeda dari default.

### 4. Tambahkan kandidat (kalau belum ada)
```sql
INSERT INTO candidates (nama_kandidat) VALUES ('Kandidat A'), ('Kandidat B');
```

### 5. Jalankan server
```bash
node server.js
```
Kalau berhasil akan muncul:
```
Database connected
✅ Blockchain loaded dari MySQL
Server running on http://localhost:3000
Admin panel: http://localhost:3000/admin.html
```
Genesis block otomatis dibuat saat pertama kali run (tabel `blockchain` kosong).

### 6. Login admin & mulai voting
- Buka `http://localhost:3000/admin.html`
- Login: `admin` / `admin123`
- Tambahkan user voter lewat admin panel (otomatis dapat keypair signature)
- Buka voting lewat toggle di admin panel

## Endpoint untuk verifikasi integritas blockchain

| Endpoint | Fungsi |
|---|---|
| `GET /blocks` | Lihat semua block (termasuk hash, signature, merkleRoot) |
| `GET /validate` | Cek apakah seluruh chain masih valid |
| `GET /hack` | Demo serangan: mengubah data block index 1 tanpa update hash/signature |

## File penting

| File | Fungsi |
|---|---|
| `server.js` | Semua route Express |
| `blockchain/blockchain.js` | Class `Block` & `Blockchain`, validasi 3 lapis |
| `blockchain/keys.js` | Generate keypair, sign, verify (per voter) |
| `blockchain/merkle.js` | Bangun & verifikasi Merkle Tree |
| `config/systemKeys.js` | Keypair sistem untuk menandatangani block audit log (auto-generate, disimpan di `config/system-keys.json`) |
| `utils/auditLog.js` | Catat aktivitas ke tabel `audit_logs` + block blockchain |
| `database_schema_lengkap.sql` | Skema database lengkap (pakai ini kalau database hilang/mau setup dari nol) |
| `migration_digital_signature.sql` | Migrasi bertahap (kalau cuma nambah kolom di database yang sudah ada) |

## Catatan penting

- File `config/system-keys.json` akan **otomatis dibuat** saat pertama kali ada aktivitas yang perlu dicatat audit log. **Jangan dihapus** setelah itu — kalau dihapus lalu server generate ulang, block audit log lama akan gagal verifikasi signature (karena public key-nya sudah beda).
- Private key voter & system disimpan di sisi server (database / file), bukan murni PKI end-to-end. Ini cukup untuk kebutuhan integritas & autentikasi data pada skala KP/akademik.
