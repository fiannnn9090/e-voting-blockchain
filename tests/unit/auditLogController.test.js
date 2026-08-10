const { PassThrough } = require('stream');

jest.mock('../../services/auditLogService');
const auditLogService = require('../../services/auditLogService');
const { list, filterOptions, exportPdf, exportExcel } = require('../../controllers/auditLogController');

function mockRes() {
  const res = new PassThrough();
  res.json = jest.fn();
  res.status = jest.fn(() => res);
  res.setHeader = jest.fn();
  return res;
}

describe('auditLogController.list', () => {
  test('sukses -> res.json({ ok: true, ...result })', () => {
    auditLogService.getAuditLogs.mockImplementation((opts, cb) => cb(null, { total: 2, rows: [{ id: 1 }] }));
    const req = { query: {} };
    const res = mockRes();
    list(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, total: 2, rows: [{ id: 1 }] });
  });

  test('gagal -> res.json({ ok:false, message })', () => {
    auditLogService.getAuditLogs.mockImplementation((opts, cb) => cb(new Error('db down')));
    const req = { query: {} };
    const res = mockRes();
    list(req, res);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Database error' });
  });
});

describe('auditLogController.filterOptions', () => {
  test('sukses -> daftar action unik', () => {
    auditLogService.getDistinctActions.mockImplementation((cb) => cb(null, [{ action: 'LOGIN' }, { action: 'VOTE' }]));
    const res = mockRes();
    filterOptions({}, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, actions: ['LOGIN', 'VOTE'] });
  });

  test('gagal -> ok:false', () => {
    auditLogService.getDistinctActions.mockImplementation((cb) => cb(new Error('fail')));
    const res = mockRes();
    filterOptions({}, res);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Database error' });
  });
});

describe('auditLogController.exportPdf', () => {
  test('gagal -> status 500 + json error, tidak mengirim body PDF', () => {
    auditLogService.getAuditLogsForExport.mockImplementation((opts, cb) => cb(new Error('timeout')));
    const req = { query: {} };
    const res = mockRes();
    exportPdf(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Gagal export PDF' });
  });

  test('sukses -> set header Content-Type PDF dan Content-Disposition attachment', (done) => {
    auditLogService.getAuditLogsForExport.mockImplementation((opts, cb) =>
      cb(null, [{ timestamp: Date.now(), username: 'u', action: 'LOGIN', ip_address: '127.0.0.1', session_id: 's', block_index: 1 }])
    );
    const req = { query: {} };
    const res = mockRes();
    res.on('finish', () => {
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=audit-log.pdf');
      done();
    });
    exportPdf(req, res);
  });
});

describe('auditLogController.exportExcel', () => {
  test('gagal -> status 500 + json error', async () => {
    auditLogService.getAuditLogsForExport.mockImplementation((opts, cb) => cb(new Error('timeout')));
    const req = { query: {} };
    const res = mockRes();
    await exportExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'Gagal export Excel' });
  });

  test('sukses -> set header Content-Type xlsx dan Content-Disposition attachment', async () => {
    auditLogService.getAuditLogsForExport.mockImplementation((opts, cb) =>
      cb(null, [{ timestamp: Date.now(), username: 'u', action: 'LOGIN', ip_address: '127.0.0.1', session_id: 's', block_index: 1 }])
    );
    const req = { query: {} };
    const res = mockRes();
    res.end = jest.fn();
    await exportExcel(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename=audit-log.xlsx');
  });
});