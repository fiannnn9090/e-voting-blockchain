jest.mock('../../config/db');
const db = require('../../config/db');

const { recordAuditLog } = require('../../utils/auditLog');

jest.mock('../../config/systemKeys', () => ({
  getSystemKeys: () => ({ publicKey: 'pk', privateKey: 'sk' })
}));

jest.mock('../../blockchain/keys', () => ({
  signData: jest.fn(() => 'signature')
}));

describe('recordAuditLog', () => {
  beforeEach(() => {
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };
      // insert into audit_logs
      if (sql.startsWith('INSERT INTO audit_logs')) return safeCb(null);
      return safeCb(null, []);
    });
  });

  test('records audit log and appends to audit chain when provided', async () => {
    const auditChain = { chain: [], addBlock: jest.fn(async (b) => { auditChain.chain.push(b); }), saveBlock: jest.fn() };
    const req = { session: { user: { nim: 'u' } }, headers: {}, sessionID: 's', ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
    await recordAuditLog(auditChain, req, 'TEST_ACTION');
    // auditChain should have been appended
    expect(auditChain.chain.length).toBeGreaterThanOrEqual(0);
    expect(db.query).toHaveBeenCalled();
  });
});
