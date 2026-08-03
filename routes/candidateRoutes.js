const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const candidateController = require("../controllers/candidateController");

const router = express.Router();

// ─── Candidate Ledger: Publik ─────────────────────────────────────────────────
router.get("/candidates", candidateController.getPublicCandidates);

// ─── Candidate Ledger: Admin ──────────────────────────────────────────────────
router.get("/admin/candidate-ledger/candidates", requireAdmin, candidateController.getAllCandidatesAdmin);
router.post("/admin/candidate-ledger/transactions", requireAdmin, candidateController.submitTransaction);
router.get("/admin/candidate-ledger/blocks", requireAdmin, candidateController.getBlocks);
router.get("/admin/candidate-ledger/validate", requireAdmin, candidateController.validate);
router.get("/admin/candidate-ledger/candidates/:ref/history", requireAdmin, candidateController.getHistory);
router.post("/admin/candidate-ledger/resync", requireAdmin, candidateController.resync);
router.get("/admin/candidate-ledger/status", requireAdmin, candidateController.getStatus);
router.post("/admin/candidate-ledger/migrate-legacy", requireAdmin, candidateController.migrateLegacy);

module.exports = router;