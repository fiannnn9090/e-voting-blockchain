const settingsAdminService = require("../services/settingsAdminService");

function getSettings(req, res) {
  settingsAdminService.getSettings((err, result) => {
    if (err) return res.json({ ok: false, message: "Database error" });
    res.json(result[0]);
  });
}

async function toggle(req, res) {
  const result = await settingsAdminService.toggleElectionStatus(req, req.app.locals.auditChain);
  res.json(result);
}

async function schedule(req, res) {
  const result = await settingsAdminService.updateSchedule(req, req.app.locals.auditChain);
  res.json(result);
}

module.exports = { getSettings, toggle, schedule };