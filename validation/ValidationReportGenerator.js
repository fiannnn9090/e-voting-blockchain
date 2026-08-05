const fs = require('fs');
const path = require('path');

function writeJsonReport(reports, targetDir) {
  const fp = path.join(targetDir, 'validation_report.json');
  fs.writeFileSync(fp, JSON.stringify(reports, null, 2), 'utf8');
}

function writeCsvReport(reports, targetDir) {
  const fp = path.join(targetDir, 'validation_report.csv');
  const header = 'Scenario,Expected,Actual,Status,DetectionMechanism,RecoveryRestored,RecoveryPostRestoreActual,RecoveryStatus';
  const rows = reports.map(r => {
    const mech = r.mechanism && Array.isArray(r.mechanism) ? r.mechanism.join(';') : '';
    const rec = r.recovery || {};
    const restored = rec.restored ? 'true' : 'false';
    const post = typeof rec.postRestoreActual === 'boolean' ? String(rec.postRestoreActual) : '';
    const recStatus = rec.postRestoreStatus || '';
    return `${escapeCsv(r.scenario)},${r.expected},${r.actual},${r.status},${escapeCsv(mech)},${restored},${post},${escapeCsv(recStatus)}`;
  });
  fs.writeFileSync(fp, [header, ...rows].join('\n'), 'utf8');
}

function writeMdReport(reports, targetDir) {
  const fp = path.join(targetDir, 'validation_report.md');
  const lines = [];
  lines.push('# Integrity Validation Report');
  lines.push('');
  lines.push('## Objective');
  lines.push('Validate the integrity mechanisms of the blockchain system (Blockchain + Merkle Tree + RSA Digital Signature + Audit Ledger) using production implementations in an isolated research framework.');
  lines.push('');
  lines.push('## Executed Scenarios');
  lines.push(reports.map(r => `- ${r.scenario}`).join('\n'));
  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push('| Scenario | Expected | Actual | Status | Detection Mechanism | Recovery Restored | Recovery Status |');
  lines.push('|---|---:|---:|---:|---|---:|---|');
  for (const r of reports) {
    const mech = r.mechanism && Array.isArray(r.mechanism) ? r.mechanism.join(', ') : '';
    const rec = r.recovery || {};
    const restored = rec.restored ? 'true' : 'false';
    const recStatus = rec.postRestoreStatus || '';
    lines.push(`| ${r.scenario} | ${r.expected} | ${r.actual} | ${r.status} | ${mech} | ${restored} | ${recStatus} |`);
  }
  lines.push('');
  lines.push('## Conclusion');
  lines.push('This report documents the results of the first two integrity validation scenarios. PASS indicates the integrity mechanism behaved as expected for the scenario. If any scenario reports FAIL, the details above indicate the mismatch between expected and actual results.');

  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
}

function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function generateReports(reports, targetDir) {
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  writeJsonReport(reports, targetDir);
  writeCsvReport(reports, targetDir);
  writeMdReport(reports, targetDir);
}

module.exports = { generateReports };
