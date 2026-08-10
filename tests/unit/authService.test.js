jest.mock('../../config/db');
const db = require('../../config/db');
const authService = require('../../services/authService');

function mockUserRow(overrides = {}) {
  return {
    id: 1, nim: '123', nama: 'Fian', password: '$2b$10$hashedvalue',
    sudah_vote: 0, public_key: 'pk', private_key: 'sk-rahasia',
    ...overrides
  };
}

describe('authService.loginUser', () => {
  test('login sukses -> field sensitif (password, private_key) tidak ada di response', async () => {
    const bcrypt = require('bcryptjs');
    const realHash = bcrypt.hashSync('secret123', 10);
    db.query = jest.fn((sql, params, cb) => {
      if (sql.startsWith('SELECT * FROM users')) return cb(null, [mockUserRow({ password: realHash })]);
      if (typeof cb === 'function') return cb(null);
    });

    const req = { session: {}, body: { nim: '123', password: 'secret123' }, headers: {} };
    const res = await authService.loginUser(req, null);

    expect(res.message).toBe('Login berhasil');
    expect(res.user).toBeDefined();
    expect(res.user).not.toHaveProperty('password');
    expect(res.user).not.toHaveProperty('private_key');
    expect(res.user).not.toHaveProperty('public_key');
    // field yang memang dipakai frontend (public/script.js) tetap ada
    expect(res.user).toMatchObject({ id: 1, nim: '123', nama: 'Fian', sudah_vote: 0 });

    // req.session.user (dipakai server-side untuk signing di votingService.js)
    // tetap menyimpan private_key -- hanya RESPONSE API yang dibersihkan
    expect(req.session.user.private_key).toBe('sk-rahasia');
  });

  test('password salah -> tidak ada info user yang bocor', async () => {
    const bcrypt = require('bcryptjs');
    const realHash = bcrypt.hashSync('secret123', 10);
    db.query = jest.fn((sql, params, cb) => cb(null, [mockUserRow({ password: realHash })]));
    const req = { session: {}, body: { nim: '123', password: 'salah' }, headers: {} };
    const res = await authService.loginUser(req, null);
    expect(res.message).toMatch(/NIM atau password salah/);
    expect(res.user).toBeUndefined();
  });

  test('migrasi otomatis plaintext -> bcrypt tetap berjalan, response tetap bersih', async () => {
    db.query = jest.fn((sql, params, cb) => {
      if (sql.startsWith('SELECT * FROM users')) return cb(null, [mockUserRow({ password: 'plaintext123' })]);
      if (sql.startsWith('UPDATE users SET password')) { if (typeof cb === 'function') cb(null); return; }
      if (typeof cb === 'function') return cb(null);
    });
    const req = { session: {}, body: { nim: '123', password: 'plaintext123' }, headers: {} };
    const res = await authService.loginUser(req, null);
    expect(res.message).toBe('Login berhasil');
    expect(res.user).not.toHaveProperty('password');
    expect(res.user).not.toHaveProperty('private_key');
  });
});

describe('authService.verifyAdminCredentials & loginAdmin/logoutAdmin', () => {
  test('kredensial admin salah -> ok:false', async () => {
    const req = { session: {}, body: { username: 'admin', password: 'salah' }, headers: {} };
    const res = await authService.loginAdmin(req, null);
    expect(res.ok).toBe(false);
  });
});