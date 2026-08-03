const votingService = require("../services/votingService");

async function vote(req, res) {
  const result = await votingService.castVote(req, req.app.locals.votingChain, req.app.locals.auditChain);
  res.json(result);
}

module.exports = { vote };