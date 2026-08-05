const { generateKeyPair, signData, verifySignature } = require('../../blockchain/keys');

describe('Keys and Signatures', () => {
  test('generateKeyPair returns public/private keys', () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(typeof publicKey).toBe('string');
    expect(typeof privateKey).toBe('string');
    expect(publicKey.length).toBeGreaterThan(0);
    expect(privateKey.length).toBeGreaterThan(0);
  });

  test('signData and verifySignature - normal case', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const data = { voter: 1, candidate: 2 };
    const sig = signData(privateKey, data);
    expect(typeof sig).toBe('string');
    const ok = verifySignature(publicKey, data, sig);
    expect(ok).toBe(true);
  });

  test('verifySignature returns false with invalid signature', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const data = { voter: 1, candidate: 2 };
    const sig = signData(privateKey, data);
    // tamper signature
    const tampered = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    expect(verifySignature(publicKey, data, tampered)).toBe(false);
  });

  test('verifySignature false when publicKey missing or signature missing', () => {
    const data = { voter: 1 };
    expect(verifySignature(null, data, 'abc')).toBe(false);
    expect(verifySignature('a', data, null)).toBe(false);
  });
});
