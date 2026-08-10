const { getBlocks, validate } = require('../../controllers/auditLedgerController');

function mockRes() {
  return { json: jest.fn() };
}

describe('auditLedgerController', () => {
  test('getBlocks mengembalikan seluruh chain Audit Ledger apa adanya', () => {
    const chain = [{ index: 0 }, { index: 1 }];
    const req = { app: { locals: { auditChain: { chain } } } };
    const res = mockRes();
    getBlocks(req, res);
    expect(res.json).toHaveBeenCalledWith(chain);
  });

  test('validate mengembalikan hasil isChainValid() apa adanya (true)', () => {
    const req = { app: { locals: { auditChain: { isChainValid: () => true } } } };
    const res = mockRes();
    validate(req, res);
    expect(res.json).toHaveBeenCalledWith({ valid: true });
  });

  test('validate mengembalikan false ketika chain tidak valid (mendeteksi tamper)', () => {
    const req = { app: { locals: { auditChain: { isChainValid: () => false } } } };
    const res = mockRes();
    validate(req, res);
    expect(res.json).toHaveBeenCalledWith({ valid: false });
  });
});