const {
  listBlocks, getBlockDetail, getMerkleTree, getMerkleProofForTx,
  verifyBlockSignature, getHealth
} = require('../../controllers/explorerController');

function mockRes() {
  return { json: jest.fn() };
}

function fakeChain(blocks) {
  return {
    chain: blocks,
    isChainValid: () => true
  };
}

function fakeBlock(index, transactions, extra = {}) {
  return {
    index, timestamp: 1000 + index, transactions,
    data: transactions.length === 1 ? transactions[0] : transactions,
    hash: `h${index}`, previousHash: `h${index - 1}`, merkleRoot: `mr${index}`,
    signature: 'sig', publicKey: 'pk',
    ...extra
  };
}

describe('explorerController: ledger tidak dikenal', () => {
  const req = { params: { ledger: 'unknown', index: '0' }, app: { locals: {} }, query: {} };

  test.each([
    ['listBlocks', listBlocks],
    ['getBlockDetail', getBlockDetail],
    ['getMerkleTree', getMerkleTree],
    ['getMerkleProofForTx', getMerkleProofForTx],
    ['verifyBlockSignature', verifyBlockSignature]
  ])('%s -> ok:false untuk ledger tidak dikenal', (name, fn) => {
    const res = mockRes();
    fn({ ...req, params: { ...req.params, txIndex: '0' } }, res);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Ledger tidak dikenal' });
  });
});

describe('listBlocks', () => {
  test('mengembalikan ringkasan block sesuai pagination', () => {
    const chain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [{ voter: 1 }]), fakeBlock(2, [{ voter: 2 }])]);
    const req = { params: { ledger: 'vote' }, query: { page: '1', limit: '2' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    listBlocks(req, res);
    const arg = res.json.mock.calls[0][0];
    expect(arg.ok).toBe(true);
    expect(arg.total).toBe(3);
    expect(arg.blocks.length).toBe(2);
    expect(arg.blocks[0].index).toBe(0);
  });

  test('resolveChain memetakan ledger candidate/audit dengan benar', () => {
    const candidateChain = fakeChain([fakeBlock(0, [{}])]);
    const auditChain = fakeChain([fakeBlock(0, [{}])]);
    const resC = mockRes();
    listBlocks({ params: { ledger: 'candidate' }, query: {}, app: { locals: { candidateChain } } }, resC);
    expect(resC.json.mock.calls[0][0].ok).toBe(true);

    const resA = mockRes();
    listBlocks({ params: { ledger: 'audit' }, query: {}, app: { locals: { auditChain } } }, resA);
    expect(resA.json.mock.calls[0][0].ok).toBe(true);
  });
});

describe('getBlockDetail', () => {
  test('block ditemukan -> ok:true + isi block', () => {
    const chain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [{ voter: 1 }])]);
    const req = { params: { ledger: 'vote', index: '1' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    getBlockDetail(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, block: chain.chain[1] });
  });

  test('index di luar jangkauan -> Block tidak ditemukan', () => {
    const chain = fakeChain([fakeBlock(0, [{}])]);
    const req = { params: { ledger: 'vote', index: '99' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    getBlockDetail(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Block tidak ditemukan' });
  });
});

describe('getMerkleTree & getMerkleProofForTx', () => {
  test('getMerkleTree mengembalikan root dan layers sesuai transaksi block', () => {
    const chain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [{ a: 1 }, { a: 2 }])]);
    const req = { params: { ledger: 'vote', index: '1' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    getMerkleTree(req, res);
    const arg = res.json.mock.calls[0][0];
    expect(arg.ok).toBe(true);
    expect(arg.root).toBeDefined();
    expect(Array.isArray(arg.layers)).toBe(true);
  });

  test('getMerkleProofForTx: transaksi ditemukan -> proof valid; txIndex tidak ada -> pesan error', () => {
    const chain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [{ a: 1 }, { a: 2 }])]);
    const okReq = { params: { ledger: 'vote', index: '1', txIndex: '0' }, app: { locals: { votingChain: chain } } };
    const resOk = mockRes();
    getMerkleProofForTx(okReq, resOk);
    expect(resOk.json.mock.calls[0][0].ok).toBe(true);

    const missingReq = { params: { ledger: 'vote', index: '1', txIndex: '9' }, app: { locals: { votingChain: chain } } };
    const resMissing = mockRes();
    getMerkleProofForTx(missingReq, resMissing);
    expect(resMissing.json).toHaveBeenCalledWith({ ok: false, message: 'Transaksi tidak ditemukan' });
  });
});

describe('verifyBlockSignature', () => {
  test('genesis block (index 0) -> valid: null, tidak memanggil verifySignature', () => {
    const chain = fakeChain([fakeBlock(0, [{}])]);
    const req = { params: { ledger: 'vote', index: '0' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    verifyBlockSignature(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, index: 0, valid: null, note: 'Genesis block tidak memiliki signature' });
  });

  test('block non-genesis dengan signature valid -> valid: true', () => {
    // gunakan signature RSA asli supaya verifySignature() sungguhan diuji, bukan mock
    const { generateKeyPair, signData } = require('../../blockchain/keys');
    const { publicKey, privateKey } = generateKeyPair();
    const data = { voter: 1, candidate: 2 };
    const signature = signData(privateKey, data);
    const chain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [data], { data, signature, publicKey })]);
    const req = { params: { ledger: 'vote', index: '1' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    verifyBlockSignature(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, index: 1, valid: true, publicKey });
  });

  test('block dengan data dimanipulasi -> valid: false (mendeteksi tamper)', () => {
    const { generateKeyPair, signData } = require('../../blockchain/keys');
    const { publicKey, privateKey } = generateKeyPair();
    const original = { voter: 1, candidate: 2 };
    const signature = signData(privateKey, original);
    const tampered = { voter: 1, candidate: 999 }; // data diubah setelah ditandatangani
    const chain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [tampered], { data: tampered, signature, publicKey })]);
    const req = { params: { ledger: 'vote', index: '1' }, app: { locals: { votingChain: chain } } };
    const res = mockRes();
    verifyBlockSignature(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, index: 1, valid: false, publicKey });
  });
});

describe('getHealth', () => {
  test('merangkum status ketiga ledger sekaligus', () => {
    const votingChain = fakeChain([fakeBlock(0, [{}]), fakeBlock(1, [{}])]);
    const candidateChain = fakeChain([fakeBlock(0, [{}])]);
    // auditChain sengaja belum siap (null) untuk menguji jalur "Ledger belum siap"
    const req = { app: { locals: { votingChain, candidateChain, auditChain: null } } };
    const res = mockRes();
    getHealth(req, res);
    const arg = res.json.mock.calls[0][0];
    expect(arg.ok).toBe(true);
    expect(arg.ledgers.vote.ok).toBe(true);
    expect(arg.ledgers.vote.totalBlocks).toBe(2);
    expect(arg.ledgers.candidate.ok).toBe(true);
    expect(arg.ledgers.audit).toEqual({ ok: false, message: 'Ledger belum siap' });
    expect(arg.checkedAt).toBeDefined();
  });
});