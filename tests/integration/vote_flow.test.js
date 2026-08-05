jest.mock('../../config/db');

const db = require('../../config/db');
const { Blockchain, Block } = require('../../blockchain/blockchain');
const votingService = require('../../services/votingService');

// Provide a simple mock implementation for db.query used across the flow.
beforeEach(() => {
  db.query = jest.fn((sql, params, cb) => {
    // normalize args
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }

    // helper to safely call cb only when provided
    const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };

    // election_settings
    if (sql.includes('FROM election_settings')) {
      return safeCb(null, [{ is_open: 1 }]);
    }

    if (sql.startsWith('SELECT sudah_vote')) {
      return safeCb(null, [{ sudah_vote: 0 }]);
    }

    if (sql.includes('FROM candidates WHERE')) {
      return safeCb(null, [{ id: params[0] }]);
    }

    // votes insert
    if (sql.startsWith('INSERT INTO votes')) {
      return safeCb(null);
    }

    // update users set sudah_vote
    if (sql.startsWith('UPDATE users SET sudah_vote')) {
      return safeCb(null);
    }

    // update users set public/private keys
    if (sql.startsWith('UPDATE users SET public_key')) {
      return safeCb(null);
    }

    // fallback
    return safeCb(null, []);
  });
});


describe('Integration test - Vote process -> blockchain -> audit', () => {
  test('full vote flow succeeds and appends block + audit log', async () => {
    const votingChain = new Blockchain('test_votes');
    const auditChain = new Blockchain('test_audit');

    // push genesis blocks manually
    votingChain.chain.push(votingChain.createGenesisBlock());
    auditChain.chain.push(auditChain.createGenesisBlock());

    // mock saveBlock to avoid DB but allow addBlock to push chain
    votingChain.saveBlock = jest.fn(() => Promise.resolve());
    auditChain.saveBlock = jest.fn(() => Promise.resolve());

    // simulate request
    const req = {
      session: { user: { id: 10, sudah_vote: 0 }, destroy: jest.fn() },
      body: { candidate_id: 5 },
      headers: {},
      sessionID: 'sess123',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' }
    };

    const result = await votingService.castVote(req, votingChain, auditChain);
    expect(result).toHaveProperty('message');
    expect(result.message).toMatch(/Voting berhasil|Vote tersimpan/);
    // chain should have new block appended
    expect(votingChain.chain.length).toBeGreaterThan(1);
    // auditChain should have appended log
    expect(auditChain.chain.length).toBeGreaterThan(1);
    // blockchain validity should be true (signatures verified via keys module)
    expect(votingChain.isChainValid()).toBe(true);
  }, 10000);
});
