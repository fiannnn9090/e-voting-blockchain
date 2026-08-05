const { buildMerkleTree, getMerkleRoot, verifyMerkleRoot, hashTransaction } = require('../../blockchain/merkle');
const SHA256 = require('crypto-js/sha256');

describe('Merkle Tree', () => {
  test('buildMerkleTree and getMerkleRoot - normal case', () => {
    const txs = [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }];
    const { root, layers } = buildMerkleTree(txs);
    expect(typeof root).toBe('string');
    // top layer length should be 1
    expect(layers[layers.length - 1].length).toBe(1);
    // root should equal recomputed root
    const recomputed = getMerkleRoot(txs);
    expect(recomputed).toBe(root);
  });

  test('empty transactions returns hash of empty string', () => {
    const { root, layers } = buildMerkleTree([]);
    const emptyRoot = SHA256('').toString();
    expect(root).toBe(emptyRoot);
    expect(layers.length).toBe(1);
    expect(layers[0][0]).toBe(emptyRoot);
    expect(verifyMerkleRoot([], root)).toBe(true);
  });

  test('odd number of transactions duplicates last node', () => {
    const txs = [{ x: 1 }, { y: 2 }, { z: 3 }];
    const { layers } = buildMerkleTree(txs);
    // first layer should have 3 leaves
    expect(layers[0].length).toBe(3);
    // next layer should pair last with itself -> length 2
    expect(layers[1].length).toBe(2);
    // verifyMerkleRoot should be true
    expect(verifyMerkleRoot(txs, getMerkleRoot(txs))).toBe(true);
  });

  test('hashTransaction determinism and edge cases', () => {
    const tx = { v: 5 };
    const h1 = hashTransaction(tx);
    const h2 = hashTransaction({ v: 5 });
    expect(h1).toBe(h2);
    // different order should still stringify deterministically in this project
    const h3 = hashTransaction(JSON.parse(JSON.stringify(tx)));
    expect(h1).toBe(h3);
  });
});
