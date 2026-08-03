let state = { page: 1, limit: 20, sortBy: "timestamp", sortDir: "DESC" };
let currentView = "table";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function fmtTime(ts) {
  return new Date(Number(ts)).toLocaleString("id-ID");
}

function buildQuery() {
  const params = new URLSearchParams();
  const search = document.getElementById("fSearch").value.trim();
  const action = document.getElementById("fAction").value;
  const from = document.getElementById("fFrom").value;
  const to = document.getElementById("fTo").value;

  if (search) params.set("search", search);
  if (action) params.set("action", action);
  if (from) params.set("dateFrom", from);
  if (to) params.set("dateTo", to);
  params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);
  params.set("page", state.page);
  params.set("limit", state.limit);
  return params.toString();
}

function updateExportLinks() {
  const params = new URLSearchParams();
  const search = document.getElementById("fSearch").value.trim();
  const action = document.getElementById("fAction").value;
  const from = document.getElementById("fFrom").value;
  const to = document.getElementById("fTo").value;
  if (search) params.set("search", search);
  if (action) params.set("action", action);
  if (from) params.set("dateFrom", from);
  if (to) params.set("dateTo", to);

  document.getElementById("btnExportPdf").href = `/admin/audit-log/export/pdf?${params.toString()}`;
  document.getElementById("btnExportExcel").href = `/admin/audit-log/export/excel?${params.toString()}`;
}

function loadFilterOptions() {
  fetch("/admin/audit-log/filter-options")
    .then(r => r.json())
    .then(data => {
      if (!data.ok) return;
      const sel = document.getElementById("fAction");
      data.actions.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a; opt.textContent = a;
        sel.appendChild(opt);
      });
    })
    .catch(() => {});
}

function reloadLogs() {
  state.page = 1;
  fetchLogs();
}

function resetFilters() {
  document.getElementById("fSearch").value = "";
  document.getElementById("fAction").value = "";
  document.getElementById("fFrom").value = "";
  document.getElementById("fTo").value = "";
  reloadLogs();
}

function prevPage() { if (state.page > 1) { state.page--; fetchLogs(); } }
function nextPage() { state.page++; fetchLogs(); }

function switchView(view) {
  currentView = view;
  document.getElementById("viewTable").style.display = view === "table" ? "" : "none";
  document.getElementById("viewTimeline").style.display = view === "timeline" ? "" : "none";
  document.getElementById("tabTableBtn").classList.toggle("active", view === "table");
  document.getElementById("tabTimelineBtn").classList.toggle("active", view === "timeline");
}

function fetchLogs() {
  updateExportLinks();
  document.getElementById("logTableBody").innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Memuat...</td></tr>`;

  fetch(`/admin/audit-log?${buildQuery()}`)
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        document.getElementById("logTableBody").innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${escapeHtml(data.message || "Gagal memuat")}</td></tr>`;
        return;
      }
      renderTable(data.rows);
      renderTimeline(data.rows);

      const totalPages = Math.max(Math.ceil(data.total / state.limit), 1);
      document.getElementById("totalInfo").textContent = `${data.total} total entri`;
      document.getElementById("pageInfo").textContent = `Halaman ${state.page} dari ${totalPages}`;
    })
    .catch(() => {
      document.getElementById("logTableBody").innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Gagal terhubung ke server.</td></tr>`;
    });
}

function renderTable(rows) {
  const tbody = document.getElementById("logTableBody");
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Tidak ada data.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="mono">${fmtTime(r.timestamp)}</td>
      <td>${escapeHtml(r.username)}</td>
      <td><span class="badge bg-secondary">${escapeHtml(r.action)}</span></td>
      <td class="mono">${escapeHtml(r.ip_address)}</td>
      <td>${r.block_index != null ? `<span class="badge bg-primary">#${r.block_index}</span>` : '-'}</td>
    </tr>
  `).join("");
}

function renderTimeline(rows) {
  const el = document.getElementById("timelineContainer");
  if (rows.length === 0) {
    el.innerHTML = `<p class="text-muted">Tidak ada data.</p>`;
    return;
  }
  el.innerHTML = rows.map(r => `
    <div class="timeline-item">
      <div class="small text-muted mono">${fmtTime(r.timestamp)}</div>
      <div><strong>${escapeHtml(r.username)}</strong> — ${escapeHtml(r.action)}</div>
      <div class="small text-muted">IP: ${escapeHtml(r.ip_address)} ${r.block_index != null ? `· Block #${r.block_index}` : ''}</div>
    </div>
  `).join("");
}

document.querySelectorAll("th.sortable").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (state.sortBy === col) {
      state.sortDir = state.sortDir === "ASC" ? "DESC" : "ASC";
    } else {
      state.sortBy = col;
      state.sortDir = "DESC";
    }
    state.page = 1;
    fetchLogs();
  });
});

document.getElementById("fSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") reloadLogs();
});

document.addEventListener("DOMContentLoaded", () => {
  loadFilterOptions();
  fetchLogs();
});