// Endpoint baca untuk Audit Ledger (dokumen desain §3: GET /admin/audit-ledger/blocks).

function getBlocks(req, res) {
  res.json(req.app.locals.auditChain.chain);
}

function validate(req, res) {
  res.json({ valid: req.app.locals.auditChain.isChainValid() });
}

module.exports = { getBlocks, validate };