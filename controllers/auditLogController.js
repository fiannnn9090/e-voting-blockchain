const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const auditLogService = require("../services/auditLogService");

function parseFilters(req) {
  return {
    action: req.query.action || null,
    username: req.query.username || null,
    dateFrom: req.query.dateFrom || null,
    dateTo: req.query.dateTo || null,
    search: req.query.search || null,
    sortBy: req.query.sortBy || "timestamp",
    sortDir: req.query.sortDir || "DESC",
    page: req.query.page || 1,
    limit: req.query.limit || 50
  };
}

function list(req, res) {
  auditLogService.getAuditLogs(parseFilters(req), (err, result) => {
    if (err) {
      console.error("Audit log list error:", err.message);
      return res.json({ ok: false, message: "Database error" });
    }
    res.json({ ok: true, ...result });
  });
}

function filterOptions(req, res) {
  auditLogService.getDistinctActions((err, rows) => {
    if (err) return res.json({ ok: false, message: "Database error" });
    res.json({ ok: true, actions: rows.map(r => r.action) });
  });
}

function exportPdf(req, res) {
  auditLogService.getAuditLogsForExport(parseFilters(req), (err, rows) => {
    if (err) {
      console.error("Export PDF error:", err.message);
      return res.status(500).json({ ok: false, message: "Gagal export PDF" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=audit-log.pdf");

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    doc.pipe(res);

    doc.fontSize(16).text("Audit Log — E-Voting Blockchain", { align: "center" });
    doc.fontSize(9).fillColor("gray").text(`Diekspor: ${new Date().toLocaleString("id-ID")} · Total: ${rows.length} entri`, { align: "center" });
    doc.moveDown(1);

    const colX = [30, 140, 220, 340, 450, 560, 650];
    const headers = ["Waktu", "Username", "Aksi", "IP Address", "Session ID", "Block #"];

    doc.fontSize(9).fillColor("black");
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: false }));
    doc.moveDown(0.5);
    doc.moveTo(30, doc.y).lineTo(760, doc.y).stroke();

    rows.forEach(r => {
      const y = doc.y + 4;
      if (y > 520) { doc.addPage({ margin: 30, size: "A4", layout: "landscape" }); }
      const rowY = doc.y + 4;
      doc.fontSize(8);
      doc.text(new Date(Number(r.timestamp)).toLocaleString("id-ID"), colX[0], rowY, { width: 105 });
      doc.text(String(r.username), colX[1], rowY, { width: 75 });
      doc.text(String(r.action), colX[2], rowY, { width: 115 });
      doc.text(String(r.ip_address), colX[3], rowY, { width: 105 });
      doc.text(String(r.session_id).slice(0, 20), colX[4], rowY, { width: 105 });
      doc.text(r.block_index != null ? `#${r.block_index}` : "-", colX[5], rowY, { width: 60 });
      doc.moveDown(1);
    });

    doc.end();
  });
}

async function exportExcel(req, res) {
  auditLogService.getAuditLogsForExport(parseFilters(req), async (err, rows) => {
    if (err) {
      console.error("Export Excel error:", err.message);
      return res.status(500).json({ ok: false, message: "Gagal export Excel" });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Audit Log");

    sheet.columns = [
      { header: "Waktu", key: "waktu", width: 22 },
      { header: "Username", key: "username", width: 16 },
      { header: "Aksi", key: "action", width: 24 },
      { header: "IP Address", key: "ip", width: 18 },
      { header: "Session ID", key: "session", width: 26 },
      { header: "Block Ledger #", key: "block", width: 14 }
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach(r => {
      sheet.addRow({
        waktu: new Date(Number(r.timestamp)).toLocaleString("id-ID"),
        username: r.username,
        action: r.action,
        ip: r.ip_address,
        session: r.session_id,
        block: r.block_index != null ? `#${r.block_index}` : "-"
      });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=audit-log.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  });
}

module.exports = { list, filterOptions, exportPdf, exportExcel };