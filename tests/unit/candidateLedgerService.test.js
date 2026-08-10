jest.mock('../../config/db');
const db = require('../../config/db');
const {
  isLedgerLocked,
  validateTransaction,
  submitTransaction
} = require('../../services/candidateLedgerService');

function mockSettings(row) {
  db.query = jest.fn((sql, params, cb) => {
    if (typeof params === 'function') { cb = params; }
    if (sql.includes('election_settings')) return cb(null, row ? [row] : []);
    if (sql.includes('candidates WHERE candidate_ref')) return cb(null, []);
    return cb(null, []);
  });
}

describe('isLedgerLocked', () => {
  test('false ketika tidak ada baris election_settings', async () => {
    mockSettings(null);
    expect(await isLedgerLocked()).toBe(false);
  });

  test('true ketika is_open = 1', async () => {
    mockSettings({ is_open: 1, start_time: null });
    expect(await isLedgerLocked()).toBe(true);
  });

  test('true ketika start_time sudah lewat meski is_open = 0', async () => {
    mockSettings({ is_open: 0, start_time: new Date(Date.now() - 60000).toISOString() });
    expect(await isLedgerLocked()).toBe(true);
  });

  test('false ketika start_time di masa depan dan is_open = 0', async () => {
    mockSettings({ is_open: 0, start_time: new Date(Date.now() + 60000).toISOString() });
    expect(await isLedgerLocked()).toBe(false);
  });
});

describe('validateTransaction', () => {
  test('menolak tx_type tidak dikenal', async () => {
    const res = await validateTransaction({ tx_type: 'FOO' }, false);
    expect(res.valid).toBe(false);
  });

  test('CANDIDATE_CREATE ditolak saat locked', async () => {
    const res = await validateTransaction({ tx_type: 'CANDIDATE_CREATE', payload: { nama_kandidat: 'A' } }, true);
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/terkunci/);
  });

  test('CANDIDATE_CREATE valid tanpa locked, wajib nama_kandidat', async () => {
    const ok = await validateTransaction({ tx_type: 'CANDIDATE_CREATE', payload: { nama_kandidat: 'A' } }, false);
    expect(ok.valid).toBe(true);
    const bad = await validateTransaction({ tx_type: 'CANDIDATE_CREATE', payload: {} }, false);
    expect(bad.valid).toBe(false);
  });

  test('CANDIDATE_VOID tetap diizinkan saat locked, wajib reason + void_tx_id', async () => {
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') cb = params;
      if (sql.includes('candidates WHERE candidate_ref')) return cb(null, [{ id: 1, last_tx_id: 'TX-1' }]);
      return cb(null, []);
    });
    const missingFields = await validateTransaction({ tx_type: 'CANDIDATE_VOID', candidate_ref: 'CAND-1' }, true);
    expect(missingFields.valid).toBe(false);

    const ok = await validateTransaction(
      { tx_type: 'CANDIDATE_VOID', candidate_ref: 'CAND-1', reason: 'salah input', payload: { void_tx_id: 'TX-1' } },
      true
    );
    expect(ok.valid).toBe(true);
  });

  test('CANDIDATE_CORRECTION saat locked hanya boleh field deskripsi/foto_url', async () => {
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') cb = params;
      if (sql.includes('candidates WHERE candidate_ref')) return cb(null, [{ id: 1, last_tx_id: 'TX-1' }]);
      return cb(null, []);
    });
    const disallowed = await validateTransaction(
      { tx_type: 'CANDIDATE_CORRECTION', candidate_ref: 'CAND-1', reason: 'r', payload: { nama_kandidat: 'Ganti Nama' } },
      true
    );
    expect(disallowed.valid).toBe(false);
    expect(disallowed.message).toMatch(/nama_kandidat/);

    const allowed = await validateTransaction(
      { tx_type: 'CANDIDATE_CORRECTION', candidate_ref: 'CAND-1', reason: 'r', payload: { deskripsi: 'baru' } },
      true
    );
    expect(allowed.valid).toBe(true);
  });

  test('non-CREATE wajib candidate_ref yang sudah ada di ledger', async () => {
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') cb = params;
      if (sql.includes('candidates WHERE candidate_ref')) return cb(null, []); // tidak ditemukan
      return cb(null, []);
    });
    const res = await validateTransaction(
      { tx_type: 'CANDIDATE_UPDATE', candidate_ref: 'CAND-X', payload: { nama_kandidat: 'A' } },
      false
    );
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/tidak ditemukan/);
  });
});

describe('submitTransaction', () => {
  test('validasi gagal -> addBlock TIDAK dipanggil', async () => {
    mockSettings({ is_open: 0, start_time: null });
    const candidateChain = { chain: [{}], addBlock: jest.fn() };
    const res = await submitTransaction({ tx_type: 'CANDIDATE_CREATE', payload: {} }, candidateChain);
    expect(res.ok).toBe(false);
    expect(candidateChain.addBlock).not.toHaveBeenCalled();
  });

  test('CREATE sukses: generate candidate_ref baru, panggil addBlock, prev_tx_ref null', async () => {
    mockSettings({ is_open: 0, start_time: null });
    const candidateChain = { chain: [{}], addBlock: jest.fn().mockResolvedValue(undefined) };
    const res = await submitTransaction(
      { tx_type: 'CANDIDATE_CREATE', payload: { nama_kandidat: 'Kandidat A' }, actorUsername: 'admin1' },
      candidateChain
    );
    expect(res.ok).toBe(true);
    expect(res.transaction.candidate_ref).toMatch(/^CAND-/);
    expect(res.transaction.prev_tx_ref).toBeNull();
    expect(res.transaction.signature).toBeDefined();
    expect(candidateChain.addBlock).toHaveBeenCalledTimes(1);
  });

  test('UPDATE sukses: prev_tx_ref terisi dari last_tx_id proyeksi yang ada', async () => {
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') cb = params;
      if (sql.includes('election_settings')) return cb(null, []);
      if (sql.includes('candidates WHERE candidate_ref')) return cb(null, [{ id: 1, last_tx_id: 'TX-PREV' }]);
      return cb(null, []);
    });
    const candidateChain = { chain: [{}], addBlock: jest.fn().mockResolvedValue(undefined) };
    const res = await submitTransaction(
      { tx_type: 'CANDIDATE_UPDATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'Baru' } },
      candidateChain
    );
    expect(res.ok).toBe(true);
    expect(res.transaction.prev_tx_ref).toBe('TX-PREV');
    expect(res.transaction.candidate_ref).toBe('CAND-1');
  });
});