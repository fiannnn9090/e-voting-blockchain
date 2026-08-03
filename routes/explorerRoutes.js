const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const explorerController = require("../controllers/explorerController");

const router = express.Router();

router.get("/admin/explorer/health", requireAdmin, explorerController.getHealth);
router.get("/admin/explorer/:ledger/blocks", requireAdmin, explorerController.listBlocks);
router.get("/admin/explorer/:ledger/blocks/:index", requireAdmin, explorerController.getBlockDetail);
router.get("/admin/explorer/:ledger/blocks/:index/merkle-tree", requireAdmin, explorerController.getMerkleTree);
router.get("/admin/explorer/:ledger/blocks/:index/proof/:txIndex", requireAdmin, explorerController.getMerkleProofForTx);
router.get("/admin/explorer/:ledger/blocks/:index/verify-signature", requireAdmin, explorerController.verifyBlockSignature);

module.exports = router;