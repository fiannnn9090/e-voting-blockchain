const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const adminSettingsController = require("../controllers/adminSettingsController");
const adminUserController = require("../controllers/adminUserController");
const auditLedgerController = require("../controllers/auditLedgerController");
const router = express.Router();
const auditLogController = require("../controllers/auditLogController");

// ─── Admin: Election Settings ─────────────────────────────────────────────────
router.get("/admin/settings", requireAdmin, adminSettingsController.getSettings);
router.post("/admin/settings/toggle", requireAdmin, adminSettingsController.toggle);
router.post("/admin/settings/schedule", requireAdmin, adminSettingsController.schedule);

// ─── Admin: CRUD Users ────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, adminUserController.getUsers);
router.post("/admin/users", requireAdmin, adminUserController.addUser);
router.delete("/admin/users/:id", requireAdmin, adminUserController.deleteUser);
router.post("/admin/users/:id/reset", requireAdmin, adminUserController.resetUserVote);
router.post("/admin/reset-all", requireAdmin, adminUserController.resetAll);

// ─── Admin: Audit Ledger ──────────────────────────────────────────
router.get("/admin/audit-ledger/blocks", requireAdmin, auditLedgerController.getBlocks);
router.get("/admin/audit-ledger/validate", requireAdmin, auditLedgerController.validate);

// ─── Admin: Audit Log (filter/search/sort/export) ─────────────────────────────
router.get("/admin/audit-log", requireAdmin, auditLogController.list);
router.get("/admin/audit-log/filter-options", requireAdmin, auditLogController.filterOptions);
router.get("/admin/audit-log/export/pdf", requireAdmin, auditLogController.exportPdf);
router.get("/admin/audit-log/export/excel", requireAdmin, auditLogController.exportExcel);

module.exports = router;