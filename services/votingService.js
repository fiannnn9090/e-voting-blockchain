const db = require("../config/db");
const { Block } = require("../blockchain/blockchain");
const { generateKeyPair, signData } = require("../blockchain/keys");
const { recordAuditLog } = require("../utils/auditLog");

/**
 * Proses vote untuk user yang sedang login.
 * votingChain & auditChain diteruskan dari luar karena instance-nya dibuat
 * sekali saat startup server. Sejak pemisahan ledger: block vote masuk ke
 * votingChain, catatan audit ("VOTE") masuk ke auditChain -- keduanya
 * ledger yang terpisah, bukan lagi digabung dalam 1 chain.
 *
 * @returns {Promise<Object>} object yang akan dikirim sebagai JSON response
 */
function castVote(req, votingChain, auditChain) {
  return new Promise((resolve) => {
    if (!req.session.user) {
      return resolve({ message: "Harus login dulu" });
    }

    db.query("SELECT * FROM election_settings LIMIT 1", (err, settings) => {
      if (err) return resolve({ message: "Database error" });

      if (!settings || settings.length === 0) {
        return resolve({ message: "Pengaturan voting tidak ditemukan." });
      }

      const setting = settings[0];
      const now = new Date();

      if (!setting.is_open) {
        return resolve({ message: "Voting belum dibuka oleh panitia." });
      }
      if (setting.start_time && now < new Date(setting.start_time)) {
        return resolve({ message: "Voting belum dimulai." });
      }
      if (setting.end_time && now > new Date(setting.end_time)) {
        return resolve({ message: "Waktu voting sudah berakhir." });
      }

      const user_id = req.session.user.id;
      const { candidate_id } = req.body;

      if (!candidate_id) {
        return resolve({ message: "Kandidat tidak valid" });
      }

      db.query("SELECT sudah_vote FROM users WHERE id = ?", [user_id], (err, result) => {
        if (err) return resolve({ message: "Database error" });

        if (result[0].sudah_vote) {
          return resolve({ message: "Kamu sudah voting!" });
        }

        db.query("SELECT id FROM candidates WHERE id = ?", [candidate_id], (err, candidates) => {
          if (err) return resolve({ message: "Database error" });
          if (candidates.length === 0) {
            return resolve({ message: "Kandidat tidak ditemukan." });
          }

          db.query(
            "INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)",
            [user_id, candidate_id],
            (err) => {
              if (err) return resolve({ message: "Gagal menyimpan vote" });

              db.query(
                "UPDATE users SET sudah_vote = TRUE WHERE id = ?",
                [user_id],
                async (err) => {
                  if (err) return resolve({ message: "Vote tersimpan tapi gagal update status" });

                  try {
                    let { public_key: publicKey, private_key: privateKey } = req.session.user;

                    if (!publicKey || !privateKey) {
                      const generated = generateKeyPair();
                      publicKey = generated.publicKey;
                      privateKey = generated.privateKey;
                      db.query(
                        "UPDATE users SET public_key = ?, private_key = ? WHERE id = ?",
                        [publicKey, privateKey, user_id]
                      );
                    }

                    const voteData = { voter: user_id, candidate: candidate_id };
                    const signature = signData(privateKey, voteData);

                    const newBlock = new Block(
                      votingChain.chain.length,
                      Date.now(),
                      voteData,
                      "",
                      signature,
                      publicKey
                    );
                    await votingChain.addBlock(newBlock);
                    await recordAuditLog(auditChain, req, "VOTE");

                    req.session.user.sudah_vote = true;
                    resolve({ message: "Voting berhasil! 🔥" });
                    setTimeout(() => req.session.destroy(), 3000);
                  } catch (e) {
                    console.error("Blockchain error:", e);
                    resolve({ message: "Vote tersimpan tapi gagal catat di blockchain" });
                  }
                }
              );
            }
          );
        });
      });
    });
  });
}

module.exports = { castVote };