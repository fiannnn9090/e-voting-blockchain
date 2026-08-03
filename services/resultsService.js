const db = require("../config/db");

/**
 * Ambil rekap hasil voting per kandidat.
 * callback(err, result) -> result adalah array baris hasil query (sama seperti db.query asli).
 */
function getResults(callback) {
  db.query(`
    SELECT
      candidates.nama_kandidat,
      COUNT(votes.candidate_id) AS total_vote
    FROM candidates
    LEFT JOIN votes ON candidates.id = votes.candidate_id
    GROUP BY candidates.id, candidates.nama_kandidat
    ORDER BY candidates.id
  `, callback);
}

module.exports = { getResults };