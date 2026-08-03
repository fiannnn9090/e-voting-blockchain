const express = require("express");
const blockchainController = require("../controllers/blockchainController");

const router = express.Router();
const requireAdmin = require("../middleware/requireAdmin");


// ─── Blockchain ───────────────────────────────────────────────────────────────
router.get("/blocks", blockchainController.getBlocks);
router.get("/validate", blockchainController.validate);

router.get("/hack", requireAdmin, blockchainController.hack);

module.exports = router;