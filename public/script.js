let chart;
let currentUser = null;

function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "show " + type;
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.className = ""; }, 3000);
}

// Pengganti window.confirm() bawaan browser dengan modal custom yang senada
// dengan desain project. Mengembalikan Promise<boolean> — resolve(true) kalau
// user klik "Ya, Lanjutkan", resolve(false) kalau klik "Batal".
function showConfirmDialog(message, opts = {}) {
  return new Promise(function(resolve) {
    const overlay  = document.getElementById("customConfirmOverlay");
    const titleEl  = document.getElementById("customConfirmTitle");
    const msgEl    = document.getElementById("customConfirmMessage");
    const iconEl   = document.getElementById("customConfirmIcon");
    const okBtn    = document.getElementById("customConfirmOkBtn");
    const cancelBtn = document.getElementById("customConfirmCancelBtn");

    titleEl.textContent = opts.title || "Konfirmasi";
    msgEl.textContent   = message;
    iconEl.textContent  = opts.icon || "⚠️";
    okBtn.textContent   = opts.confirmText || "Ya, Lanjutkan";
    okBtn.className     = "btn " + (opts.tone === "primary" ? "btn-primary" : "btn-danger");

    overlay.style.display = "flex";
    requestAnimationFrame(function() { overlay.classList.add("show"); });

    function cleanup(result) {
      overlay.classList.remove("show");
      setTimeout(function() { overlay.style.display = "none"; }, 150);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk()     { cleanup(true); }
    function onCancel() { cleanup(false); }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

function login() {
  const nim = document.getElementById("nim").value.trim();
  const password = document.getElementById("password").value;

  if (!nim || !password) {
    toast("NIM dan password tidak boleh kosong!", "error");
    return;
  }

  fetch("/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nim, password })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.user) {
      currentUser = data.user;
      document.getElementById("votingArea").style.display = "block";
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("userInfo").textContent = "👤 " + (data.user.nama || data.user.nim);
      if (data.user.sudah_vote) {
        toast("Kamu sudah pernah voting sebelumnya.", "info");
      } else {
        toast("Login berhasil! Silakan pilih kandidat.", "success");
      }
      // Kartu kandidat sekarang dimuat dinamis dari Candidate Ledger --
      // updateVoteButtons() dijalankan SETELAH kartu selesai dirender,
      // supaya status "sudah vote" diterapkan ke tombol yang tepat.
      loadCandidates().then(function() {
        updateVoteButtons(data.user.sudah_vote);
      });
      loadBlocks();
      validateChain();
      loadResults();
    } else {
      toast(data.message || "Login gagal", "error");
    }
  })
  .catch(function(err) {
    console.error("Fetch error:", err);
    toast("Tidak bisa terhubung ke server.", "error");
  });
}

function logout() {
  fetch("/logout")
  .finally(function() {
    currentUser = null;
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("votingArea").style.display = "none";
    document.getElementById("nim").value = "";
    document.getElementById("password").value = "";
  });
}

// Escape sederhana supaya nama kandidat (data dari database, bisa diisi admin)
// tidak dirender sebagai HTML mentah saat disisipkan ke dalam kartu.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/**
 * Ambil daftar kandidat ACTIVE dari Candidate Ledger (GET /candidates) dan
 * render sebagai kartu ke dalam #voteContainer. Struktur & class CSS kartu
 * dibuat identik dengan kartu hardcoded sebelumnya, supaya tampilan tidak berubah.
 */
function loadCandidates() {
  return fetch("/candidates")
  .then(function(res) { return res.json(); })
  .then(function(data) {
    const container = document.getElementById("voteContainer");
    container.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p style='color:var(--muted)'>Belum ada kandidat terdaftar.</p>";
      return;
    }

    data.forEach(function(candidate, i) {
      const nomor = String(i + 1).padStart(2, "0");
      const namaAman = escapeHtml(candidate.nama_kandidat);

      const card = document.createElement("div");
      card.className = "card";
      card.id = "card-" + candidate.id;
      card.innerHTML =
        "<div class='card-number'>" + nomor + "</div>" +
        "<h2>" + namaAman + "</h2>" +
        "<button class='btn btn-primary vote-btn'>Pilih " + namaAman + "</button>";

      card.querySelector(".vote-btn").addEventListener("click", function() {
        vote(candidate.id, candidate.nama_kandidat);
      });

      container.appendChild(card);
    });
  })
  .catch(function() {
    document.getElementById("voteContainer").innerHTML = "<p style='color:var(--muted)'>Gagal memuat daftar kandidat.</p>";
  });
}

function vote(candidateId, candidateName) {
  if (currentUser && currentUser.sudah_vote) {
    toast("Kamu sudah voting!", "error");
    return;
  }

  const displayName = candidateName || ("Kandidat #" + candidateId);

  showConfirmDialog(
    "Yakin memilih " + displayName + "? Pilihan tidak bisa diubah.",
    { title: "Konfirmasi Pilihan", icon: "🗳️", confirmText: "Ya, Pilih Ini", tone: "primary" }
  ).then(function(confirmed) {
    if (!confirmed) return;

    fetch("/vote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.message.includes("berhasil")) {
        if (currentUser) {
          currentUser.sudah_vote = true;
          updateVoteButtons(true);
        }
        loadBlocks();
        validateChain();
        loadResults();
        showConfirmation(displayName);
      } else {
        toast(data.message, "error");
      }
    })
    .catch(function() { toast("Gagal mengirim vote.", "error"); });
  });
}

function showConfirmation(candidateName) {
  var overlay = document.getElementById("confirmOverlay");
  var now = new Date();

  document.getElementById("confirmName").textContent = "Nama: " + (currentUser.nama || currentUser.nim);
  document.getElementById("confirmNim").textContent = currentUser.nim;
  document.getElementById("confirmCandidate").textContent = candidateName;
  document.getElementById("confirmTime").textContent = now.toLocaleString("id-ID");

  overlay.style.display = "flex";
}

function tutupKonfirmasi() {
  document.getElementById("confirmOverlay").style.display = "none";
  logout();
}

function updateVoteButtons(sudahVote) {
  document.querySelectorAll(".vote-btn").forEach(function(btn) {
    btn.disabled = sudahVote;
    if (sudahVote) btn.textContent = "Sudah Memilih";
  });
  document.querySelectorAll(".card").forEach(function(card) {
    card.style.opacity = sudahVote ? "0.55" : "1";
  });
}

function loadBlocks() {
  fetch("/blocks")
  .then(function(res) { return res.json(); })
  .then(function(data) {
    const blocksDiv = document.getElementById("blocks");
    blocksDiv.innerHTML = "";
    data.forEach(function(block) {
      const isGenesis = block.index === 0;
      blocksDiv.innerHTML += "<div class='block'>" +
        "<h3>Block #" + block.index + (isGenesis ? " — Genesis" : "") + "</h3>" +
        "<p><b>Timestamp:</b> " + new Date(block.timestamp).toLocaleString("id-ID") + "</p>" +
        "<p><b>Data:</b> " + JSON.stringify(block.data) + "</p>" +
        "<p><b>Hash:</b><br><span class='hash-value'>" + block.hash + "</span></p>" +
        "<p><b>Previous Hash:</b><br><span class='hash-value'>" + block.previousHash + "</span></p>" +
        "</div>";
    });
  })
  .catch(function() {
    document.getElementById("blocks").innerHTML = "<p style='color:var(--muted)'>Gagal memuat blockchain.</p>";
  });
}

function validateChain() {
  fetch("/validate")
  .then(function(res) { return res.json(); })
  .then(function(data) {
    const el = document.getElementById("status");
    if (data.valid) {
      el.textContent = "✅ Chain Valid";
      el.style.color = "var(--success)";
    } else {
      el.textContent = "❌ Chain Rusak!";
      el.style.color = "var(--danger)";
    }
  })
  .catch(function() {
    document.getElementById("status").textContent = "⚠ Tidak bisa validasi";
  });
}

function hackBlockchain() {
  showConfirmDialog(
    "Demo: Manipulasi data blockchain? Chain akan menjadi invalid.",
    { title: "Demo Serangan", icon: "☠️", confirmText: "Ya, Manipulasi" }
  ).then(function(confirmed) {
    if (!confirmed) return;

    fetch("/hack")
    .then(function(res) { return res.json(); })
    .then(function(data) {
      toast(data.message, "error");
      loadBlocks();
      validateChain();
    })
    .catch(function() { toast("Gagal menghubungi server.", "error"); });
  });
}

function loadResults() {
  fetch("/results")
  .then(function(res) { return res.json(); })
  .then(function(data) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";
    const labels = [];
    const totals = [];
    data.forEach(function(result) {
      resultsDiv.innerHTML += "<div class='result-card'>" +
        "<h2>" + result.nama_kandidat + "</h2>" +
        "<h1>" + result.total_vote + "</h1>" +
        "<p>Suara</p></div>";
      labels.push(result.nama_kandidat);
      totals.push(Number(result.total_vote));
    });
    renderChart(labels, totals);
  })
  .catch(function() {
    document.getElementById("results").innerHTML = "<p style='color:var(--muted)'>Gagal memuat hasil.</p>";
  });
}

function renderChart(labels, totals) {
  const ctx = document.getElementById("voteChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Jumlah Suara",
        data: totals,
        backgroundColor: ["rgba(0,119,255,0.7)", "rgba(0,194,255,0.7)", "rgba(46,213,115,0.7)", "rgba(255,165,2,0.7)"],
        borderColor: ["#0077ff", "#00c2ff", "#2ed573", "#ffa502"],
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#5a7a9a", font: { family: "JetBrains Mono", size: 12 } }, grid: { color: "rgba(30,45,69,0.8)" } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: "#5a7a9a", font: { family: "JetBrains Mono", size: 12 } }, grid: { color: "rgba(30,45,69,0.8)" } }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function() {
  ["nim", "password"].forEach(function(id) {
    document.getElementById(id).addEventListener("keydown", function(e) {
      if (e.key === "Enter") login();
    });
  });
});