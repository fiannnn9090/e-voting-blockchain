const authService = require("../services/authService");

async function login(req, res) {
  const result = await authService.loginUser(req, req.app.locals.auditChain);
  res.json(result);
}

async function logout(req, res) {
  const result = await authService.logoutUser(req, req.app.locals.auditChain);
  res.json(result);
}

async function adminLogin(req, res) {
  const result = await authService.loginAdmin(req, req.app.locals.auditChain);
  res.json(result);
}

async function adminLogout(req, res) {
  const result = await authService.logoutAdmin(req, req.app.locals.auditChain);
  res.json(result);
}

module.exports = { login, logout, adminLogin, adminLogout };