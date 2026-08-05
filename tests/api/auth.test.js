const request = require('supertest');

jest.mock('../../config/db');
const db = require('../../config/db');
const { createTestApp } = require('./appFactory');

beforeEach(() => {
  const bcrypt = require('bcryptjs');
  const passwordHash = bcrypt.hashSync('password', 10);

  db.query = jest.fn((sql, params, cb) => {
  if (typeof params === 'function') { cb = params; params = []; }
  const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };

  // loginUser: SELECT * FROM users WHERE nim = ?
  if (sql.includes('FROM users WHERE nim')) {
    // simulate a single user with bcrypt hashed password (hash for 'password')
    return safeCb(null, [{ id: 1, nim: '100', password: passwordHash }]);
  }

  // default: empty rows
  return safeCb(null, []);
  });
});

describe('Auth API', () => {
  test('login success', async () => {
    const app = createTestApp();
    const res = await request(app).post('/login').send({ nim: '100', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Login berhasil');
    expect(res.body).toHaveProperty('user');
  });

  test('invalid login returns error message', async () => {
    const app = createTestApp();
    // mock DB to return no user for this attempt
    db.query.mockImplementationOnce((sql, params, cb) => cb(null, []));
    const res = await request(app).post('/login').send({ nim: 'bad', password: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/NIM atau password salah|NIM dan password wajib diisi/);
  });
});
