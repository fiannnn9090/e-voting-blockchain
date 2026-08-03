const resultsService = require("../services/resultsService");

// Dipindah dari server.js (GET /results) apa adanya.
function getResults(req, res) {
  resultsService.getResults((err, result) => {
    if (err) {
      console.error("Results DB error:", err);
      return res.json({ message: "Database error" });
    }
    res.json(result);
  });
}

module.exports = { getResults };