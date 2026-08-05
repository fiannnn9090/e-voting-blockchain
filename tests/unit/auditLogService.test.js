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
});
