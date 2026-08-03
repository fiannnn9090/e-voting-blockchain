const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bodyParser = require("body-parser");
const { Blockchain } = require("./blockchain/blockchain");

const publicRoutes = require("./routes/publicRoutes");
const authRoutes = require("./routes/authRoutes");
const votingRoutes = require("./routes/votingRoutes");
const blockchainRoutes = require("./routes/blockchainRoutes");
const resultsRoutes = require("./routes/resultsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const candidateRoutes = require("./routes/candidateRoutes");
const explorerRoutes = require("./routes/explorerRoutes");

const app = express();

const sessionStore = new MySQLStore({
  host: "localhost",
  user: "root",
  password: "",
  database: "evoting",
  port: 3306
});

app.use(bodyParser.json());
app.use(session({
  store: sessionStore,
  secret: "evoting-secret",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, sameSite: "lax" }
}));
app.use(express.static("public"));

// ─── Routes ───────────────────────────────────────────────────────────────────
// PENTING: urutan mounting berikut ini mempertahankan perilaku server.js asli —
// khususnya duplikasi route "/hack". blockchainRoutes (berisi versi PERTAMA
// "/hack") harus di-mount SEBELUM adminRoutes (berisi versi KEDUA "/hack"),
// supaya handler yang aktif tetap sama seperti sebelum refactoring.
app.use(publicRoutes);
app.use(authRoutes);
app.use(votingRoutes);
app.use(blockchainRoutes);
app.use(resultsRoutes);
app.use(adminRoutes);
app.use(candidateRoutes);
app.use(explorerRoutes);

// ─── Inisialisasi blockchain ──────────────────────────────────────────────────
// votingChain & candidateChain disimpan di app.locals supaya bisa diakses
// controller lewat req.app.locals.*, tanpa perlu circular require ke server.js.
//
// Blockchain.create() TANPA argumen (Vote Ledger) TIDAK diubah sama sekali --
// tetap mengarah ke tabel "blockchain" persis seperti sebelumnya.
// Blockchain.create("candidate_ledger_blocks") adalah instance BARU untuk
// Candidate Ledger, dijalankan paralel lewat Promise.all() supaya waktu
// startup server tidak bertambah signifikan.

Promise.all([
  Blockchain.create(),
  Blockchain.create("candidate_ledger_blocks"),
  Blockchain.create("audit_ledger_blocks")
]).then(([voteChain, candidateChain, auditChain]) => {
  app.locals.votingChain = voteChain;
  app.locals.candidateChain = candidateChain;
  app.locals.auditChain = auditChain;
  console.log("✅ Vote Ledger loaded dari MySQL");
  console.log("✅ Candidate Ledger loaded dari MySQL");
  console.log("✅ Audit Ledger loaded dari MySQL");

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  });

}).catch(err => {
  console.error("❌ Gagal load blockchain:", err);
  process.exit(1);
});