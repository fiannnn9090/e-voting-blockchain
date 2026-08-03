const express = require("express");
const resultsController = require("../controllers/resultsController");

const router = express.Router();

// ─── Results ──────────────────────────────────────────────────────────────────
router.get("/results", resultsController.getResults);

module.exports = router;