const userAdminService = require("../services/userAdminService");

function getUsers(req, res) {
  userAdminService.getUsers((err, result) => {
    if (err) return res.json({ message: "Database error" });
    res.json(result);
  });
}

async function addUser(req, res) {
  const result = await userAdminService.addUser(req, req.app.locals.auditChain);
  res.json(result);
}

async function deleteUser(req, res) {
  const result = await userAdminService.deleteUser(req, req.app.locals.auditChain);
  res.json(result);
}

async function resetUserVote(req, res) {
  const result = await userAdminService.resetUserVote(req, req.app.locals.auditChain);
  res.json(result);
}

async function resetAll(req, res) {
  const result = await userAdminService.resetAll(req, req.app.locals.votingChain, req.app.locals.auditChain);
  res.json(result);
}

module.exports = { getUsers, addUser, deleteUser, resetUserVote, resetAll };