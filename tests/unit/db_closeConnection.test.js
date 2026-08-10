jest.unmock('../../config/db');

function makeFakeConnection() {
  return {
    connect: jest.fn((cb) => cb && cb(null)),
    end: jest.fn((cb) => cb && cb(null)),
    query: jest.fn((sql, params, cb) => { if (typeof params === 'function') params(null, []); else if (cb) cb(null, []); })
  };
}

describe('config/db.js closeConnection()', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('tidak membuat koneksi baru jika belum pernah dipakai sama sekali', async () => {
    const fakeConn = makeFakeConnection();
    const createConnection = jest.fn(() => fakeConn);
    jest.doMock('mysql2', () => ({ createConnection }));

    const db = require('../../config/db');
    await db.closeConnection();

    // BUG REGRESSION: sebelumnya, memanggil db.end() lewat Proxy akan memicu
    // initDbConnection() -> membuat koneksi baru HANYA untuk langsung ditutup.
    // closeConnection() yang benar harus no-op jika belum pernah connect.
    expect(createConnection).not.toHaveBeenCalled();
    expect(fakeConn.end).not.toHaveBeenCalled();
  });

  test('menutup koneksi yang sudah terinisialisasi (mis. setelah db.query dipakai)', async () => {
    const fakeConn = makeFakeConnection();
    const createConnection = jest.fn(() => fakeConn);
    jest.doMock('mysql2', () => ({ createConnection }));

    const db = require('../../config/db');
    // memicu inisialisasi koneksi lewat Proxy get-trap
    await new Promise((resolve) => db.query('SELECT 1', [], () => resolve()));
    expect(createConnection).toHaveBeenCalledTimes(1);

    await db.closeConnection();
    expect(fakeConn.end).toHaveBeenCalledTimes(1);
  });

  test('setelah closeConnection(), pemanggilan db.query berikutnya reconnect otomatis (bukan pakai koneksi mati)', async () => {
    const fakeConn1 = makeFakeConnection();
    const fakeConn2 = makeFakeConnection();
    const createConnection = jest.fn()
      .mockReturnValueOnce(fakeConn1)
      .mockReturnValueOnce(fakeConn2);
    jest.doMock('mysql2', () => ({ createConnection }));

    const db = require('../../config/db');
    await new Promise((resolve) => db.query('SELECT 1', [], () => resolve()));
    await db.closeConnection();

    await new Promise((resolve) => db.query('SELECT 2', [], () => resolve()));

    expect(createConnection).toHaveBeenCalledTimes(2); // koneksi lama ditutup, koneksi baru dibuat
    expect(fakeConn2.query).toHaveBeenCalled();
  });
});