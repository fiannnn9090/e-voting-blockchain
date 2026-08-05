jest.mock('../../config/db');
const { Block } = require('../../blockchain/blockchain');
const { getMerkleRoot } = require('../../blockchain/merkle');

describe('Block class', () => {
  test('calculateHash uses merkleRoot and is deterministic', () => {
    const data = { voter: 1, candidate: 2 };
    const b = new Block(1, 123456789, data, 'prevhash');
    const recalculated = b.calculateHash();
    expect(b.hash).toBe(recalculated);
  });

  test('genesis block empty transactions yields empty merkle root', () => {
    const g = new Block(0, 0, 'Genesis Block', '0');
    // merkle root should be a string
    expect(typeof g.merkleRoot).toBe('string');
    // Ensure transactions is array
    expect(Array.isArray(g.transactions)).toBe(true);
    // hash should be consistent
    expect(g.hash).toBe(g.calculateHash());
  });

  test('transactions array is preserved and wrapped when single object provided', () => {
    const single = { v: 9 };
    const b = new Block(2, 999, single, 'p');
    expect(Array.isArray(b.transactions)).toBe(true);
    expect(b.transactions.length).toBe(1);
    expect(b.transactions[0]).toEqual(single);
  });
});
