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

  test('resetChain deletes all rows and resets chain to a single genesis block', async () => {
    const bc = new Blockchain('test_blocks');
    // simulasikan chain lama berisi beberapa block sebelum direset
    bc.chain = [
      new Block(0, 1, 'Genesis', '0'),
      new Block(1, 2, { voter: 1, candidate: 1 }, 'prevhash')
    ];

    const deleteCalls = [];
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };

      if (sql.startsWith('DELETE FROM')) {
        deleteCalls.push(sql);
        return safeCb(null); // DELETE berhasil
      }
      if (sql.startsWith('INSERT INTO')) {
        return safeCb(null); // saveBlock(genesis) berhasil
      }
      return safeCb(null, []);
    });

    await bc.resetChain();

    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0]).toContain('test_blocks');
    expect(bc.chain.length).toBe(1);
    expect(bc.chain[0].index).toBe(0);
    expect(bc.chain[0].data).toBe('Genesis Block');
  });

  test('resetChain rejects when DELETE query fails, chain is left untouched', async () => {
    const bc = new Blockchain('test_blocks');
    const originalChain = [
      new Block(0, 1, 'Genesis', '0'),
      new Block(1, 2, { voter: 1, candidate: 1 }, 'prevhash')
    ];
    bc.chain = originalChain;

    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      const safeCb = (...args) => { if (typeof cb === 'function') return cb(...args); };

      if (sql.startsWith('DELETE FROM')) {
        return safeCb(new Error('DB connection lost'));
      }
      return safeCb(null, []);
    });

    await expect(bc.resetChain()).rejects.toThrow('DB connection lost');
    // chain tidak boleh berubah karena resetChain gagal sebelum sempat
    // mengganti this.chain (fail-safe: gagal total, bukan gagal sebagian)
    expect(bc.chain).toBe(originalChain);
    expect(bc.chain.length).toBe(2);
  });
});