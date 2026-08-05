jest.mock('../../config/db');

const db = require('../../config/db');
const { Blockchain, Block } = require('../../blockchain/blockchain');

describe('Blockchain DB interactions (unit)', () => {
  beforeEach(() => {
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };

      if (sql.startsWith('SELECT * FROM')) {
        // simulate existing rows with one block
        const rows = [{ block_index: 0, timestamp: 1, data: JSON.stringify('Genesis Block'), previous_hash: '0', hash: 'h', signature: null, public_key: null, merkle_root: 'mr' }];
        return safeCb(null, rows);
      }

      return safeCb(null, []);
    });
  });

  test('create() loads from db and creates genesis when empty', async () => {
    // simulate empty table first
    db.query.mockImplementationOnce((sql, params, cb) => { if (typeof params === 'function') { cb = params; params = []; } const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); }; return safeCb(null, []); });
    const bc = await Blockchain.create('test_blocks');
    expect(Array.isArray(bc.chain)).toBe(true);
    expect(bc.chain.length).toBeGreaterThanOrEqual(1);
  });

  test('loadBlockchain maps rows to Block instances', async () => {
    const bc = new Blockchain('test_blocks');
    await bc.loadBlockchain();
    expect(bc.chain.length).toBeGreaterThanOrEqual(1);
    expect(bc.chain[0].index).toBeDefined();
  });

  test('saveBlock calls db.query', async () => {
    const bc = new Blockchain('test_blocks');
    const block = new Block(0, 1, 'Genesis', '0');
    await expect(bc.saveBlock(block)).resolves.toBeUndefined();
    expect(db.query).toHaveBeenCalled();
  });
});
