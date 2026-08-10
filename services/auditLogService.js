const db = require("../config/db");

const SORTABLE_COLUMNS = ["timestamp", "username", "action", "ip_address"];

function getAuditLogs(opts, callback) {
  const {
    action, username, dateFrom, dateTo, search,
    sortBy = "timestamp", sortDir = "DESC",
    page = 1, limit = 50,
    // maxAllowedLimit: internal callers (mis. getAuditLogsForExport) may
    // override this limit to fetch more rows for full document export.
    // External/user-facing requests (endpoint list, via req.query) always
    // remain capped at the default 500 -- this parameter is never derived
    // from req.query, so it cannot be influenced by an untrusted client.
    maxAllowedLimit = 500
  } = opts;

  const where = [];
  const params = [];

  if (action) { where.push("action = ?"); params.push(action); }
  if (username) { where.push("username = ?"); params.push(username); }
  if (dateFrom) { where.push("timestamp >= ?"); params.push(new Date(dateFrom).getTime()); }
  if (dateTo) { where.push("timestamp <= ?"); params.push(new Date(dateTo).getTime()); }
  if (search) {
    where.push("(username LIKE ? OR action LIKE ? OR ip_address LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
  const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) ? sortBy : "timestamp";
  const safeSortDir = sortDir === "ASC" ? "ASC" : "DESC";
  const safeLimit = Math.min(parseInt(limit) || 50, maxAllowedLimit);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;

  db.query(`SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`, params, (err, countResult) => {
    if (err) return callback(err);

    db.query(
      `SELECT id, timestamp, username, action, ip_address, session_id, block_index
       FROM audit_logs ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortDir}
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset],
      (err, rows) => {
        if (err) return callback(err);
        callback(null, { total: countResult[0].total, rows });
      }
    );
  });
}

function getDistinctActions(callback) {
  db.query("SELECT DISTINCT action FROM audit_logs ORDER BY action", callback);
}

function getAuditLogsForExport(opts, callback) {
  // Pemanggil tepercaya (internal) -- boleh melewati batas pagination 500
  // yang berlaku untuk endpoint list (input pengguna via req.query).
  getAuditLogs({ ...opts, page: 1, limit: 5000, maxAllowedLimit: 5000 }, (err, result) => {
    if (err) return callback(err);
    callback(null, result.rows);
  });
}

module.exports = { getAuditLogs, getDistinctActions, getAuditLogsForExport, SORTABLE_COLUMNS };