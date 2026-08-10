const auditLogService = require('../../services/auditLogService');

jest.mock('../../config/db', () => ({
  query: jest.fn((sql, params, cb) => {
    // handle overloaded call with only callback
    if (typeof params === 'function') return params(null, [{ total: 1 }]);
    if (sql.startsWith('SELECT COUNT')) return cb(null, [{ total: 2 }]);
    // return sample rows for second query
    return cb(null, [{ id: 1, timestamp: Date.now(), username: 'u', action: 'a', ip_address: '127.0.0.1', session_id: 's', block_index: null }]);
  })
}));

const db = require('../../config/db');

describe('Audit Log Service', () => {
  test('getAuditLogs returns total and rows', (done) => {
    auditLogService.getAuditLogs({}, (err, result) => {
      expect(err).toBeNull();
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.rows)).toBe(true);
      done();
    });
  });

  test('getDistinctActions calls DB', (done) => {
    auditLogService.getDistinctActions((err, rows) => {
      expect(err).toBeNull();
      expect(Array.isArray(rows)).toBe(true);
      done();
    });
  });

  test('getAuditLogs with search builds LIKE clause on username/action/ip_address', (done) => {
    const calls = [];
    db.query.mockImplementation((sql, params, cb) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT COUNT')) return cb(null, [{ total: 1 }]);
      return cb(null, [{ id: 1, timestamp: Date.now(), username: 'admin', action: 'LOGIN', ip_address: '10.0.0.1', session_id: 's', block_index: null }]);
    });

    auditLogService.getAuditLogs({ search: 'admin' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows.length).toBe(1);

      // Kedua query (COUNT dan SELECT) harus mengandung klausa LIKE yang sama
      calls.forEach(({ sql, params }) => {
        expect(sql).toContain('(username LIKE ? OR action LIKE ? OR ip_address LIKE ?)');
        expect(params).toEqual(expect.arrayContaining(['%admin%']));
      });
      // tiga parameter LIKE (username, action, ip_address) harus identik nilainya
      const countCallParams = calls.find(c => c.sql.startsWith('SELECT COUNT')).params;
      expect(countCallParams.filter(p => p === '%admin%').length).toBe(3);

      done();
    });
  });

  test('getAuditLogs default (no maxAllowedLimit) stays capped at 500', (done) => {
    let capturedLimitParam;
    db.query.mockImplementation((sql, params, cb) => {
      if (sql.startsWith('SELECT COUNT')) return cb(null, [{ total: 1 }]);
      // params terakhir sebelum offset adalah safeLimit (LIMIT ? OFFSET ?)
      capturedLimitParam = params[params.length - 2];
      return cb(null, []);
    });

    // limit diminta 10000 tanpa maxAllowedLimit -> harus tetap di-cap 500
    auditLogService.getAuditLogs({ limit: 10000 }, (err) => {
      expect(err).toBeNull();
      expect(capturedLimitParam).toBe(500);
      done();
    });
  });

  test('maxAllowedLimit internal dapat menaikkan batas melebihi 500', (done) => {
    let capturedLimitParam;
    db.query.mockImplementation((sql, params, cb) => {
      if (sql.startsWith('SELECT COUNT')) return cb(null, [{ total: 1 }]);
      capturedLimitParam = params[params.length - 2];
      return cb(null, []);
    });

    auditLogService.getAuditLogs({ limit: 5000, maxAllowedLimit: 5000 }, (err) => {
      expect(err).toBeNull();
      expect(capturedLimitParam).toBe(5000);
      done();
    });
  });

  test('limit tidak pernah melebihi maxAllowedLimit yang diberikan', (done) => {
    let capturedLimitParam;
    db.query.mockImplementation((sql, params, cb) => {
      if (sql.startsWith('SELECT COUNT')) return cb(null, [{ total: 1 }]);
      capturedLimitParam = params[params.length - 2];
      return cb(null, []);
    });

    // limit diminta jauh melebihi maxAllowedLimit -> tetap harus di-cap ke maxAllowedLimit
    auditLogService.getAuditLogs({ limit: 999999, maxAllowedLimit: 5000 }, (err) => {
      expect(err).toBeNull();
      expect(capturedLimitParam).toBe(5000);
      done();
    });
  });

  test('getAuditLogsForExport meneruskan maxAllowedLimit: 5000 dan tidak lagi terpotong ke 500', (done) => {
    const calls = [];
    db.query.mockImplementation((sql, params, cb) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT COUNT')) return cb(null, [{ total: 1 }]);
      return cb(null, [{ id: 1, timestamp: Date.now(), username: 'u', action: 'a', ip_address: '127.0.0.1', session_id: 's', block_index: null }]);
    });

    auditLogService.getAuditLogsForExport({ page: 9, limit: 10 }, (err, rows) => {
      expect(err).toBeNull();
      expect(Array.isArray(rows)).toBe(true);

      const selectCall = calls.find(c => c.sql.trim().startsWith('SELECT id'));
      const [safeLimit, offset] = selectCall.params.slice(-2);

      // FIX: sebelumnya safeLimit ter-cap ke 500 akibat bug; sekarang harus 5000
      expect(safeLimit).toBe(5000);
      expect(offset).toBe(0); // page dipaksa 1

      done();
    });
  });

  test('getAuditLogsForExport propagates error from getAuditLogs without modification', (done) => {
    const dbError = new Error('query timeout');
    db.query.mockImplementation((sql, params, cb) => {
      if (sql.startsWith('SELECT COUNT')) return cb(dbError);
      return cb(null, []);
    });

    auditLogService.getAuditLogsForExport({}, (err, rows) => {
      expect(err).toBe(dbError);
      expect(rows).toBeUndefined();
      done();
    });
  });
});