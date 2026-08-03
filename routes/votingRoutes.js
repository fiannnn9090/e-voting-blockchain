const express = require("express");
const votingController = require("../controllers/votingController");

const router = express.Router();

// ─── Voting ───────────────────────────────────────────────────────────────────
router.post("/vote", votingController.vote);

module.exports = router;