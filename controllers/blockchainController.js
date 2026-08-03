const blockchainService = require("../services/blockchainService");
const { recordAuditLog } = require("../utils/auditLog");

function getBlocks(req, res) {
  res.json(blockchainService.getChain(req.app.locals.votingChain));
}

function validate(req, res) {
  res.json({ valid: blockchainService.validateChain(req.app.locals.votingChain) });
}

async function hack(req, res) {
  blockchainService.hackBlock(req.app.locals.votingChain);
  await recordAuditLog(req.app.locals.auditChain, req, "HACK_ATTEMPT", req.session?.admin ? "admin" : "unknown");
  res.json({ message: "Blockchain berhasil dimanipulasi 😈" });
}

module.exports = { getBlocks, validate, hack };