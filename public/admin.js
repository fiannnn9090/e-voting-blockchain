let allUsers = [];
let statsChart;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = "", 3000);
}

function adminLogin() {
  const username = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPass").value;

  fetch("/admin/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  }).then(r => r.json()).then(data => {
    if (data.ok) {
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("dashboard").style.display = "block";
      document.getElementById("adminLabel").textContent = username;
      loadDashboardOverview();
    } else toast(data.message || "Login gagal", "error");
  }).catch(() => toast("Tidak bisa terhubung ke server", "error"));
}

function adminLogout() {
  fetch("/admin/logout").then(() => {
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("dashboard").style.display = "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("adminPass").addEventListener("keydown", e => { if (e.key === "Enter") adminLogin(); });
});

const PAGE_LOADERS = {
  dashboard: loadDashboardOverview, users: loadUsers, candidates: loadCandidatesAdmin,
  election: loadSettings, blockchain: loadBlockchainHealth, audit: loadAuditPreview, statistics: loadStatistics
};

document.getElementById("sideNav")?.addEventListener("click", (e) => {
  const link = e.target.closest("[data-page]");
  if (!link) return;
  e.preventDefault();
  const page = link.dataset.page;
  document.querySelectorAll("#sideNav .nav-link").forEach(l => l.classList.remove("active"));
  link.classList.add("active");
  document.querySelectorAll(".section-page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  PAGE_LOADERS[page]?.();
});

function loadDashboardOverview() {
  fetch("/admin/users").then(r => r.json()).then(users => {
    if (!Array.isArray(users)) return;
    document.getElementById("dTotalUsers").textContent = users.length;
    document.getElementById("dVoted").textContent = users.filter(u => u.sudah_vote).length;
  });
  fetch("/admin/candidate-ledger/candidates").then(r => r.json()).then(data => {
    if (!data.ok) return;
    document.getElementById("dCandidates").textContent = data.candidates.filter(c => c.status === "ACTIVE").length;
  });
  fetch("/admin/settings").then(r => r.json()).then(data => {
    document.getElementById("dElectionStatus").textContent = data.is_open ? "🟢 Buka" : "🔴 Tutup";
  });
  fetch("/admin/explorer/health").then(r => r.json()).then(data => {
    const el = document.getElementById("dHealthSummary");
    if (!data.ok) { el.textContent = "Gagal memuat"; return; }
    el.innerHTML = Object.entries(data.ledgers).map(([name, s]) => `${s.valid ? "✅" : "❌"} ${name}: ${s.totalBlocks} block`).join(" &nbsp;|&nbsp; ");
  }).catch(() => {});
}

function loadUsers() {
  fetch("/admin/users").then(r => r.json()).then(data => {
    if (!Array.isArray(data)) { toast("Akses ditolak", "error"); return; }
    allUsers = data;
    renderTable(data);
  }).catch(() => toast("Gagal memuat data", "error"));
}

function renderTable(users) {
  const tbody = document.getElementById("userTable");
  if (users.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Belum ada pemilih.</td></tr>`; return; }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="mono">${escapeHtml(u.nim)}</td>
      <td>${escapeHtml(u.nama) || "—"}</td>
      <td><span class="badge ${u.sudah_vote ? "bg-success" : "bg-secondary"}">${u.sudah_vote ? "Sudah Vote" : "Belum Vote"}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-light" onclick="resetVoteUser(${u.id}, '${escapeHtml(u.nim)}')">Reset</button>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusUser(${u.id}, '${escapeHtml(u.nim)}')">Hapus</button>
      </td>
    </tr>
  `).join("");
}

function filterTable() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  renderTable(allUsers.filter(u => u.nim.toLowerCase().includes(q) || (u.nama || "").toLowerCase().includes(q)));
}

function tambahUser() {
  const nim = document.getElementById("newNim").value.trim();
  const nama = document.getElementById("newNama").value.trim();
  const pass = document.getElementById("newPass").value.trim();
  if (!nim || !nama || !pass) { toast("Semua field wajib diisi", "error"); return; }
  fetch("/admin/users", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nim, nama, password: pass })
  }).then(r => r.json()).then(data => {
    if (data.ok) {
      toast(`Pemilih ${nim} ditambahkan`, "success");
      document.getElementById("newNim").value = ""; document.getElementById("newNama").value = ""; document.getElementById("newPass").value = "";
      loadUsers();
    } else toast(data.message || "Gagal", "error");
  }).catch(() => toast("Gagal terhubung ke server", "error"));
}

function hapusUser(id, nim) {
  if (!confirm(`Hapus pemilih ${nim}?`)) return;
  fetch(`/admin/users/${id}`, { method: "DELETE" }).then(r => r.json()).then(data => {
    if (data.ok) { toast(`${nim} dihapus`, "success"); loadUsers(); } else toast(data.message || "Gagal", "error");
  });
}

function resetVoteUser(id, nim) {
  if (!confirm(`Reset status vote ${nim}?`)) return;
  fetch(`/admin/users/${id}/reset`, { method: "POST" }).then(r => r.json()).then(data => {
    if (data.ok) { toast(`Vote ${nim} direset`, "success"); loadUsers(); } else toast(data.message || "Gagal", "error");
  });
}

function resetSemuaVote() {
  if (!confirm("Reset SEMUA status vote? Aksi ini tidak bisa dibatalkan.")) return;
  fetch("/admin/reset-all", { method: "POST" }).then(r => r.json()).then(data => {
    if (data.ok) toast("Semua vote direset", "success"); else toast(data.message || "Gagal", "error");
  });
}

function tambahKandidat() {
  const nama = document.getElementById("newCandidateNama").value.trim();
  const deskripsi = document.getElementById("newCandidateDeskripsi").value.trim();
  const foto_url = document.getElementById("newCandidateFoto").value.trim();
  if (!nama) { toast("Nama kandidat wajib diisi", "error"); return; }

  const payload = { nama_kandidat: nama };
  if (deskripsi) payload.deskripsi = deskripsi;
  if (foto_url) payload.foto_url = foto_url;

  fetch("/admin/candidate-ledger/transactions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_type: "CANDIDATE_CREATE", payload })
  }).then(r => r.json()).then(data => {
    if (data.ok) {
      toast(`Kandidat "${nama}" ditambahkan`, "success");
      document.getElementById("newCandidateNama").value = "";
      document.getElementById("newCandidateDeskripsi").value = "";
      document.getElementById("newCandidateFoto").value = "";
      loadCandidatesAdmin();
    } else toast(data.message || "Gagal", "error");
  }).catch(() => toast("Gagal terhubung ke server", "error"));
}

function loadCandidatesAdmin() {
  fetch("/admin/candidate-ledger/candidates").then(r => r.json()).then(data => {
    const tbody = document.getElementById("candidateTable");
    if (!data.ok || data.candidates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada kandidat.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.candidates.map(c => {
      const nama = escapeHtml(c.nama_kandidat);
      const deskripsi = escapeHtml(c.deskripsi) || "-";
      const foto = c.foto_url ? `<img src="${escapeHtml(c.foto_url)}" class="candidate-photo" onerror="this.style.display='none'">` : "-";
      const isActive = c.status === "ACTIVE";
      const btn = isActive
        ? `<button class="btn btn-sm btn-outline-danger" onclick="toggleKandidat('${c.candidate_ref}','${nama}','CANDIDATE_DEACTIVATE')">Nonaktifkan</button>`
        : `<button class="btn btn-sm btn-outline-light" onclick="toggleKandidat('${c.candidate_ref}','${nama}','CANDIDATE_REACTIVATE')">Aktifkan</button>`;
      return `<tr><td>${foto}</td><td>${nama}</td><td class="small text-muted">${deskripsi}</td><td><span class="badge ${isActive ? "bg-success" : "bg-secondary"}">${isActive ? "Aktif" : "Nonaktif"}</span></td><td>${btn}</td></tr>`;
    }).join("");
  }).catch(() => toast("Gagal memuat kandidat", "error"));

  fetch("/admin/candidate-ledger/status").then(r => r.json()).then(data => {
    const el = document.getElementById("candidateLedgerStatus");
    if (!data.ok) return;
    el.textContent = `Mode ledger: ${data.mode === "LOCKED" ? "🔒 TERKUNCI" : "🔓 TERBUKA"} · ${data.totalBlocks} block`;
  }).catch(() => {});
}

function toggleKandidat(ref, nama, txType) {
  const action = txType === "CANDIDATE_DEACTIVATE" ? "nonaktifkan" : "aktifkan";
  if (!confirm(`Yakin ${action} kandidat "${nama}"?`)) return;
  fetch("/admin/candidate-ledger/transactions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tx_type: txType, candidate_ref: ref })
  }).then(r => r.json()).then(data => {
    if (data.ok) { toast(`Kandidat "${nama}" di-${action}`, "success"); loadCandidatesAdmin(); } else toast(data.message || "Gagal", "error");
  });
}

function loadSettings() {
  fetch("/admin/settings").then(r => r.json()).then(data => {
    document.getElementById("electionName").value = data.election_name || "";
    document.getElementById("startTime").value = data.start_time ? new Date(data.start_time).toISOString().slice(0, 16) : "";
    document.getElementById("endTime").value = data.end_time ? new Date(data.end_time).toISOString().slice(0, 16) : "";
    updateToggleUI(data.is_open);
  }).catch(() => toast("Gagal memuat pengaturan", "error"));
}

function updateToggleUI(isOpen) {
  const badge = document.getElementById("votingStatus");
  const btn = document.getElementById("toggleBtn");
  badge.textContent = isOpen ? "● DIBUKA" : "● DITUTUP";
  badge.className = "badge " + (isOpen ? "bg-success" : "bg-danger");
  btn.textContent = isOpen ? "Tutup Voting" : "Buka Voting";
  btn.className = "btn btn-sm " + (isOpen ? "btn-danger" : "btn-primary");
}

function toggleVoting() {
  fetch("/admin/settings/toggle", { method: "POST" }).then(r => r.json()).then(data => {
    if (data.ok) { updateToggleUI(data.is_open); toast("Status voting diubah", "success"); } else toast(data.message || "Gagal", "error");
  });
}

function saveSchedule() {
  const election_name = document.getElementById("electionName").value.trim();
  const start_time = document.getElementById("startTime").value;
  const end_time = document.getElementById("endTime").value;
  if (!election_name || !start_time || !end_time) { toast("Semua field wajib diisi", "error"); return; }
  fetch("/admin/settings/schedule", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ election_name, start_time, end_time })
  }).then(r => r.json()).then(data => {
    if (data.ok) toast("Jadwal disimpan", "success"); else toast(data.message || "Gagal", "error");
  });
}

function loadBlockchainHealth() {
  fetch("/admin/explorer/health").then(r => r.json()).then(data => {
    const el = document.getElementById("blockchainHealthCards");
    if (!data.ok) { el.innerHTML = `<p class="text-danger">Gagal memuat</p>`; return; }
    el.innerHTML = Object.entries(data.ledgers).map(([name, s]) => `
      <div class="col-md-4"><div class="card p-3">
        <div class="text-muted small text-capitalize">${name} Ledger</div>
        <h4 class="${s.valid ? "text-success" : "text-danger"}">${s.valid ? "✅ Valid" : "❌ Tidak Valid"}</h4>
        <div class="small text-muted">${s.totalBlocks} block</div>
      </div></div>
    `).join("");
  }).catch(() => { document.getElementById("blockchainHealthCards").innerHTML = `<p class="text-danger">Gagal terhubung ke server.</p>`; });
}

function loadAuditPreview() {
  fetch("/admin/audit-log?limit=10&sortBy=timestamp&sortDir=DESC").then(r => r.json()).then(data => {
    const tbody = document.getElementById("auditPreviewTable");
    if (!data.ok || data.rows.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Belum ada aktivitas.</td></tr>`; return; }
    tbody.innerHTML = data.rows.map(r => `
      <tr>
        <td class="mono">${new Date(Number(r.timestamp)).toLocaleString("id-ID")}</td>
        <td>${escapeHtml(r.username)}</td>
        <td><span class="badge bg-secondary">${escapeHtml(r.action)}</span></td>
        <td class="mono">${escapeHtml(r.ip_address)}</td>
      </tr>
    `).join("");
  }).catch(() => toast("Gagal memuat audit log", "error"));
}

function loadStatistics() {
  fetch("/results").then(r => r.json()).then(data => {
    const labels = data.map(r => r.nama_kandidat);
    const totals = data.map(r => Number(r.total_vote));
    document.getElementById("statsCards").innerHTML = data.map(r => `
      <div class="col-md-3"><div class="card p-3 stat-card"><div class="text-muted small">${escapeHtml(r.nama_kandidat)}</div><h2>${r.total_vote}</h2></div></div>
    `).join("");
    if (statsChart) statsChart.destroy();
    statsChart = new Chart(document.getElementById("statsChart"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Jumlah Suara", data: totals, backgroundColor: "rgba(35,134,54,0.7)" }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }).catch(() => toast("Gagal memuat statistik", "error"));
}