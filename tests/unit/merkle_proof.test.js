const { getMerkleProof, verifyMerkleProof, hashTransaction, buildMerkleTree } = require('../../blockchain/merkle');

describe('Merkle proof utilities', () => {
  test('getMerkleProof and verifyMerkleProof - normal case', () => {
    const txs = [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }];
    const proof = getMerkleProof(txs, 2); // proof for tx index 2
    expect(Array.isArray(proof)).toBe(true);
    const root = buildMerkleTree(txs).root;
    const ok = verifyMerkleProof(txs[2], proof, root);
    expect(ok).toBe(true);
  });

  test('verifyMerkleProof fails for wrong root', () => {
    const txs = [{ a: 1 }, { b: 2 }];
    const proof = getMerkleProof(txs, 1);
    const fakeRoot = '00';
    expect(verifyMerkleProof(txs[1], proof, fakeRoot)).toBe(false);
  });
});
