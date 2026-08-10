jest.mock('../../config/db');
const db = require('../../config/db');
const votingService = require('../../services/votingService');
const { generateKeyPair } = require('../../blockchain/keys');

// Fixture RSA keypair asli (bukan dummy string) supaya signData() pada
// castVote() bisa benar-benar berhasil, dan jalur eksekusi bisa mencapai
// votingChain.addBlock() saat diuji.
const { privateKey: validPrivateKey, publicKey: validPublicKey } = generateKeyPair();

beforeEach(() => {
  db.query = jest.fn((sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
    // default: election settings open
    if (sql.includes('FROM election_settings')) return safeCb(null, [{ is_open: 1 }]);
    if (sql.startsWith('SELECT sudah_vote')) return safeCb(null, [{ sudah_vote: 0 }]);
    if (sql.includes('FROM candidates WHERE')) return safeCb(null, [{ id: params[0] }]);
    if (sql.startsWith('INSERT INTO votes')) return safeCb(null);
    if (sql.startsWith('UPDATE users SET sudah_vote')) return safeCb(null);
    if (sql.startsWith('UPDATE users SET public_key')) return safeCb(null);
    return safeCb(null, []);
  });
});

describe('votingService negative and edge cases', () => {
  test('not logged in', async () => {
    const req = { session: {} };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ] }, null);
    expect(res).toHaveProperty('message');
    expect(res.message).toMatch(/Harus login dulu/);
  });

  test('missing candidate_id', async () => {
    const req = { session: { user: { id: 1 } } };
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ is_open: 1 }]);
    });
    // provide empty body
    req.body = {};
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res).toHaveProperty('message');
  });

  test('database error on settings', async () => {
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(new Error('dbfail'));
    });
    const req = { session: { user: { id: 1 } }, body: { candidate_id: 1 } };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res.message).toMatch(/Database error/);
  });

  test('voting not open', async () => {
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ is_open: 0 }]);
    });
    const req = { session: { user: { id: 1 } }, body: { candidate_id: 1 } };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res.message).toMatch(/Voting belum dibuka/);
  });

  test('voting not yet started (start_time in future)', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ is_open: 1, start_time: future }]);
    });
    const req = { session: { user: { id: 1 } }, body: { candidate_id: 1 } };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res.message).toMatch(/Voting belum dimulai/);
  });

  test('voting already ended (end_time past)', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ is_open: 1, end_time: past }]);
    });
    const req = { session: { user: { id: 1 } }, body: { candidate_id: 1 } };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res.message).toMatch(/Waktu voting sudah berakhir/);
  });

  test('user already voted', async () => {
    // election settings ok
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ is_open: 1 }]);
    });
    // sudah_vote true
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ sudah_vote: 1 }]);
    });

    const req = { session: { user: { id: 2 } }, body: { candidate_id: 1 } };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res.message).toMatch(/sudah voting|Kamu sudah voting!/i);
  });

  test('candidate not found', async () => {
    // settings ok
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ is_open: 1 }]);
    });
    // sudah_vote false
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, [{ sudah_vote: 0 }]);
    });
    // candidates empty
    db.query.mockImplementationOnce((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      return safeCb(null, []);
    });

    const req = { session: { user: { id: 3 } }, body: { candidate_id: 999 } };
    const res = await votingService.castVote(req, { chain: [ { hash: 'h' } ], createGenesisBlock: () => {} }, null);
    expect(res.message).toMatch(/Kandidat tidak ditemukan/);
  });

  test('blockchain.addBlock throws - returns blockchain error message', async () => {
    // happy path until addBlock
    db.query.mockImplementation((sql, params, cb) => {
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

    const req = {
      session: {
        user: { id: 4, public_key: validPublicKey, private_key: validPrivateKey, destroy: () => {} }
      },
      body: { candidate_id: 1 }
    };
    const votingChain = { chain: [], addBlock: jest.fn(() => { throw new Error('boom'); }) };
    const res = await votingService.castVote(req, votingChain, null);

    // Pastikan jalur eksekusi benar-benar mencapai addBlock() -- bukan gagal
    // lebih awal di signData() akibat private key yang tidak valid.
    expect(votingChain.addBlock).toHaveBeenCalledTimes(1);
    expect(res.message).toMatch(/Vote tersimpan tapi gagal catat di blockchain/);
  });
});