const { runValidation } = require('./IntegrityValidationService');
const { generateReports } = require('./ValidationReportGenerator');
const path = require('path');

async function main() {
  console.log('Integrity Validation Framework\n');

  // Run the validation which executes both scenarios non-destructively
  console.log('Running scenarios...');
  const reports = await runValidation();

  // Print concise console output per scenario
  for (const r of reports) {
    console.log(`Running ${r.scenario}...`);
    if (r.status === 'PASS') {
      console.log('PASS\n');
    } else {
      console.log('FAIL\n');
      if (r.error) console.log('Reason:\n', r.error);
      if (r.recovery) {
        console.log('Recovery check: restored=', r.recovery.restored, 'status=', r.recovery.postRestoreStatus);
      }
      console.log();
    }
  }

  // Generate reports under validation/ (same folder)
  const targetDir = path.join(__dirname);
  try {
    generateReports(reports, targetDir);
  } catch (e) {
    console.error('Failed to write reports:', e && e.stack ? e.stack : e);
  }

  // Tutup koneksi MySQL singleton -- CLI tool ini berumur pendek dan harus
  // keluar bersih setelah selesai, tidak seperti Express server yang hidup
  // terus-menerus. Tanpa ini, socket MySQL tetap terbuka dan event loop
  // Node tidak pernah kosong (proses menggantung, harus Ctrl+C manual).
  const db = require('../config/db');
  await db.closeConnection();
}

main().catch(err => {
  console.error('Unexpected error:', err && err.stack ? err.stack : err);
  process.exit(1);
});