jest.mock('../../config/db');
jest.mock('../../blockchain/keys', () => ({
  verifySignature: jest.fn(() => true)
}));

const { Blockchain, Block } = require('../../blockchain/blockchain');

describe('Blockchain class (unit)', () => {
  test('create chain in-memory, addBlock and validate', async () => {
    const bc = new Blockchain('test_chain');
    // start with manually pushing genesis
    const genesis = bc.createGenesisBlock();
    bc.chain.push(genesis);

    const b = new Block(1, Date.now(), { voter: 1, candidate: 2 }, genesis.hash);
    // mock saveBlock to avoid DB
    bc.saveBlock = jest.fn(() => Promise.resolve());
    await bc.addBlock(b);

    expect(bc.chain.length).toBe(2);
    expect(bc.getLatestBlock()).toBe(b);
    expect(bc.isChainValid()).toBe(true);
  });

  test('tampering a block makes chain invalid', () => {
    const bc = new Blockchain('test_chain');
    const g = bc.createGenesisBlock();
    bc.chain.push(g);

    const b = new Block(1, Date.now(), { voter: 1 }, g.hash);
    b.signature = 'sig';
    b.publicKey = 'pk';
    bc.chain.push(b);

    // tamper data without updating merkleRoot/hash
    bc.hackBlock(1, { voter: 999 });
    expect(bc.isChainValid()).toBe(false);
  });
});
