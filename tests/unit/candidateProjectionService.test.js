jest.mock('../../config/db');
const db = require('../../config/db');
const {
  resyncFromGenesis,
  syncAfterTransaction,
  getActiveCandidates,
  getAllCandidates
} = require('../../services/candidateProjectionService');

function mockDbHappyPath({ existingRows = [] } = {}) {
  db.query = jest.fn((sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    if (sql.startsWith('SELECT id FROM candidates')) return cb(null, existingRows);
    if (sql.startsWith('SELECT nama_kandidat')) return cb(null, existingRows);
    return cb(null, { insertId: 99 });
  });
}

function block(index, transactions) {
  return { index, transactions };
}

describe('resyncFromGenesis', () => {
  test('membangun proyeksi dari CREATE -> UPDATE, mengabaikan block genesis (index 0)', async () => {
    mockDbHappyPath();
    const chain = {
      chain: [
        block(0, []), // genesis, harus di-skip
        block(1, [{ tx_id: 'TX-1', tx_type: 'CANDIDATE_CREATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'A' } }]),
        block(2, [{ tx_id: 'TX-2', tx_type: 'CANDIDATE_UPDATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'A Updated' } }])
      ]
    };
    const res = await resyncFromGenesis(chain);
    expect(res.candidatesProcessed).toBe(1);
    expect(res.latestBlockIndex).toBe(2);
  });

  test('transaksi yang di-VOID tidak ikut membentuk state akhir', async () => {
    mockDbHappyPath();
    const upsertCalls = [];
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (sql.startsWith('SELECT id FROM candidates')) return cb(null, []);
      if (sql.startsWith('INSERT INTO candidates')) { upsertCalls.push(params); return cb(null, { insertId: 1 }); }
      return cb(null, []);
    });

    const chain = {
      chain: [
        block(0, []),
        block(1, [{ tx_id: 'TX-1', tx_type: 'CANDIDATE_CREATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'A' } }]),
        block(2, [{ tx_id: 'TX-2', tx_type: 'CANDIDATE_UPDATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'Salah Update' } }]),
        block(3, [{ tx_id: 'TX-3', tx_type: 'CANDIDATE_VOID', candidate_ref: 'CAND-1', payload: { void_tx_id: 'TX-2' } }])
      ]
    };
    await resyncFromGenesis(chain);

    // Baris terakhir yang di-upsert untuk CAND-1 harus mencerminkan TX-1 (CREATE),
    // bukan TX-2 (CANDIDATE_UPDATE) karena TX-2 sudah di-void oleh TX-3.
    const lastUpsertForCand1 = upsertCalls[upsertCalls.length - 1];
    expect(lastUpsertForCand1).toContain('A'); // nama_kandidat dari CREATE, bukan "Salah Update"
    expect(lastUpsertForCand1).not.toContain('Salah Update');
  });
});

describe('syncAfterTransaction', () => {
  test('tx VOID memicu resyncFromGenesis penuh (bukan projectSingleTransaction)', async () => {
    mockDbHappyPath();
    const chain = { chain: [block(0, [])] };
    const res = await syncAfterTransaction(
      { tx_type: 'CANDIDATE_VOID', candidate_ref: 'CAND-1', payload: { void_tx_id: 'TX-1' } },
      1,
      chain
    );
    expect(res).toHaveProperty('candidatesProcessed');
    expect(res).toHaveProperty('latestBlockIndex');
  });

  test('tx non-VOID memicu projectSingleTransaction (update satu baris saja)', async () => {
    mockDbHappyPath({ existingRows: [{ id: 1, nama_kandidat: 'A', deskripsi: null, foto_url: null, status: 'ACTIVE' }] });
    const res = await syncAfterTransaction(
      { tx_id: 'TX-2', tx_type: 'CANDIDATE_UPDATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'B' } },
      2,
      { chain: [] }
    );
    expect(res).toEqual({ candidatesProcessed: 1, latestBlockIndex: 2 });
  });
});

describe('applyTxToState via resyncFromGenesis (DEACTIVATE/REACTIVATE/CORRECTION)', () => {
  test('DEACTIVATE -> status INACTIVE, REACTIVATE -> status ACTIVE lagi', async () => {
    mockDbHappyPath();
    const upsertCalls = [];
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (sql.startsWith('SELECT id FROM candidates')) return cb(null, []);
      if (sql.startsWith('INSERT INTO candidates')) { upsertCalls.push(params); return cb(null, { insertId: 1 }); }
      return cb(null, []);
    });
    const chain = {
      chain: [
        block(0, []),
        block(1, [{ tx_id: 'TX-1', tx_type: 'CANDIDATE_CREATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'A' } }]),
        block(2, [{ tx_id: 'TX-2', tx_type: 'CANDIDATE_DEACTIVATE', candidate_ref: 'CAND-1', payload: {} }]),
        block(3, [{ tx_id: 'TX-3', tx_type: 'CANDIDATE_REACTIVATE', candidate_ref: 'CAND-1', payload: {} }])
      ]
    };
    await resyncFromGenesis(chain);
    const finalStatus = upsertCalls[upsertCalls.length - 1][4]; // urutan param: nama,deskripsi,foto,status,...
    expect(finalStatus).toBe('ACTIVE');
  });

  test('CANDIDATE_CORRECTION mengubah deskripsi tanpa mengubah nama_kandidat', async () => {
    mockDbHappyPath();
    const upsertCalls = [];
    db.query = jest.fn((sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (sql.startsWith('SELECT id FROM candidates')) return cb(null, []);
      if (sql.startsWith('INSERT INTO candidates')) { upsertCalls.push(params); return cb(null, { insertId: 1 }); }
      return cb(null, []);
    });
    const chain = {
      chain: [
        block(0, []),
        block(1, [{ tx_id: 'TX-1', tx_type: 'CANDIDATE_CREATE', candidate_ref: 'CAND-1', payload: { nama_kandidat: 'A' } }]),
        block(2, [{ tx_id: 'TX-2', tx_type: 'CANDIDATE_CORRECTION', candidate_ref: 'CAND-1', payload: { deskripsi: 'Deskripsi baru' } }])
      ]
    };
    await resyncFromGenesis(chain);
    const last = upsertCalls[upsertCalls.length - 1];
    expect(last[0]).toBe('A'); // nama_kandidat tidak berubah
    expect(last[1]).toBe('Deskripsi baru');
  });
});

describe('getActiveCandidates / getAllCandidates', () => {
  test('getActiveCandidates hanya query status ACTIVE', (done) => {
    db.query = jest.fn((sql, cb) => { expect(sql).toMatch(/status = 'ACTIVE'/); cb(null, []); });
    getActiveCandidates((err, rows) => { expect(err).toBeNull(); expect(rows).toEqual([]); done(); });
  });

  test('getAllCandidates tidak memfilter status', (done) => {
    db.query = jest.fn((sql, cb) => { expect(sql).not.toMatch(/WHERE status/); cb(null, []); });
    getAllCandidates((err, rows) => { expect(err).toBeNull(); expect(rows).toEqual([]); done(); });
  });
});