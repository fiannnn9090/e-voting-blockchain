let currentLedger = "vote";
let currentBlocks = [];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString("id-ID");
}

function truncate(str, n = 24) {
  if (!str) return "-";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

document.getElementById("ledgerSelect").addEventListener("change", (e) => {
  currentLedger = e.target.value;
  loadBlockList();
});

function loadChainStatus() {
  fetch(`/admin/explorer/health`)
    .then(r => r.json())
    .then(data => {
      const el = document.getElementById("chainStatus");
      if (!data.ok) { el.textContent = "Gagal memuat status"; return; }
      const s = data.ledgers[currentLedger];
      if (!s || !s.ok) { el.textContent = "Ledger belum siap"; return; }
      el.className = "badge " + (s.valid ? "bg-success" : "bg-danger");
      el.textContent = (s.valid ? "✅ VALID" : "❌ TIDAK VALID") + ` · ${s.totalBlocks} block`;
    })
    .catch(() => { document.getElementById("chainStatus").textContent = "Gagal terhubung"; });
}

function loadBlockList() {
  const tbody = document.getElementById("blockTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Memuat data...</td></tr>`;
  loadChainStatus();

  fetch(`/admin/explorer/${currentLedger}/blocks?limit=200`)
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${escapeHtml(data.message || "Gagal memuat")}</td></tr>`;
        return;
      }
      currentBlocks = data.blocks;
      if (currentBlocks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Belum ada block.</td></tr>`;
        return;
      }

      tbody.innerHTML = currentBlocks.map(b => `
        <tr class="block-row" onclick="showBlockDetail(${b.index})">
          <td><span class="badge bg-primary">#${b.index}</span>${b.index === 0 ? ' <span class="badge bg-secondary">Genesis</span>' : ''}</td>
          <td>${fmtTime(b.timestamp)}</td>
          <td>${b.txCount}</td>
          <td class="hash-mono">${truncate(b.hash)}</td>
          <td class="hash-mono">${truncate(b.previousHash)}</td>
        </tr>
      `).join("");
    })
    .catch(() => {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Gagal terhubung ke server.</td></tr>`;
    });
}

function showBlockDetail(index) {
  const modalEl = document.getElementById("blockDetailModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  document.getElementById("modalBlockTitle").textContent = `Block #${index}`;
  document.getElementById("modalBlockBody").innerHTML = `<p class="text-muted">Memuat...</p>`;
  modal.show();

  fetch(`/admin/explorer/${currentLedger}/blocks/${index}`)
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        document.getElementById("modalBlockBody").innerHTML = `<p class="text-danger">${escapeHtml(data.message)}</p>`;
        return;
      }
      const b = data.block;
      const isGenesis = b.index === 0;
      const validatorLabel = isGenesis
        ? "-"
        : (currentLedger === "vote" ? "Voter (ditandatangani private key voter)" : "Sistem (ditandatangani system key)");

      document.getElementById("modalBlockBody").innerHTML = `
        <div class="mb-3">
          <div class="field-label">Timestamp</div>
          <div>${fmtTime(b.timestamp)}</div>
        </div>
        <div class="mb-3">
          <div class="field-label">Hash</div>
          <div class="hash-mono">${escapeHtml(b.hash)}</div>
        </div>
        <div class="mb-3">
          <div class="field-label">Previous Hash</div>
          <div class="hash-mono">${escapeHtml(b.previousHash)}</div>
        </div>
        <div class="mb-3">
          <div class="field-label">Merkle Root</div>
          <div class="hash-mono">${escapeHtml(b.merkleRoot)}</div>
        </div>
        <div class="mb-3">
          <div class="field-label">Validator</div>
          <div>${validatorLabel}</div>
        </div>
        <div class="mb-3">
          <div class="field-label">Public Key</div>
          <pre class="hash-mono" style="white-space:pre-wrap">${escapeHtml(b.publicKey || "-")}</pre>
        </div>
        <div class="mb-3">
          <div class="field-label">Signature</div>
          <pre class="hash-mono" style="white-space:pre-wrap">${escapeHtml(b.signature || "-")}</pre>
        </div>
        <div class="mb-1">
          <div class="field-label">Transactions (${b.transactions.length})</div>
          <pre class="hash-mono" style="white-space:pre-wrap">${escapeHtml(JSON.stringify(b.transactions, null, 2))}</pre>
        </div>
      `;
    })
    .catch(() => {
      document.getElementById("modalBlockBody").innerHTML = `<p class="text-danger">Gagal memuat detail block.</p>`;
    });
}

document.addEventListener("DOMContentLoaded", loadBlockList);