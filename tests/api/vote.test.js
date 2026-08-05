const request = require('supertest');

jest.mock('../../config/db');
const db = require('../../config/db');
const { createTestApp } = require('./appFactory');

beforeEach(() => {
  db.query = jest.fn((sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };

    if (sql.includes('FROM election_settings')) return safeCb(null, [{ is_open: 1 }]);
    if (sql.startsWith('SELECT sudah_vote')) return safeCb(null, [{ sudah_vote: 0 }]);
    if (sql.includes('FROM candidates WHERE')) return safeCb(null, [{ id: params[0] }]);
    if (sql.startsWith('INSERT INTO votes')) return safeCb(null);
    if (sql.startsWith('UPDATE users SET sudah_vote')) return safeCb(null);
    if (sql.startsWith('UPDATE users SET public_key')) return safeCb(null);

    return safeCb(null, []);
  });
});

describe('Vote API', () => {
  test('successful vote flow via API', async () => {
    const app = createTestApp();
    // create session by logging in user into session store
    const agent = request.agent(app);

    // simulate session.user by setting via endpoint? Simplest: attach cookie by manipulating session store
    // Instead, create a route to set session for tests
    app.post('/__test/session', (req, res) => {
      req.session.user = { id: 42, sudah_vote: 0 };
      req.session.destroy = () => {};
      res.json({ ok: true });
    });

    await agent.post('/__test/session').send();
    const res = await agent.post('/vote').send({ candidate_id: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  test('duplicate vote rejected', async () => {
    // make sudah_vote true
    // override DB behavior for duplicate-vote scenario
    db.query.mockImplementation((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      if (sql.includes('FROM election_settings')) return safeCb(null, [{ is_open: 1 }]);
      if (sql.startsWith('SELECT sudah_vote')) return safeCb(null, [{ sudah_vote: 1 }]);
      return safeCb(null, []);
    });

    const app = createTestApp();
    const agent = request.agent(app);
    app.post('/__test/session', (req, res) => {
      req.session.user = { id: 99, sudah_vote: 1 };
      req.session.destroy = () => {};
      res.json({ ok: true });
    });
    await agent.post('/__test/session').send();
    const res = await agent.post('/vote').send({ candidate_id: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toMatch(/sudah voting|Kamu sudah voting!/);
  });
});
