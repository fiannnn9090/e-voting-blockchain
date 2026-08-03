// ─── Middleware admin ─────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.json({ message: "Akses ditolak. Login admin dulu." });
  }
  next();
}

module.exports = requireAdmin;