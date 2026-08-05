// Script to initialize blockchain ledgers (create genesis blocks) using app logic
// This script expects process.env.DB_DATABASE to be set to the target database.

const { Blockchain } = require('../blockchain/blockchain');

async function init() {
  try {
    // Create vote ledger, candidate ledger, and audit ledger
    await Blockchain.create(); // default 'blockchain' table
    await Blockchain.create('candidate_ledger_blocks');
    await Blockchain.create('audit_ledger_blocks');
    process.exit(0);
  } catch (e) {
    console.error('init_chains error', e && e.stack ? e.stack : e);
    process.exit(2);
  }
}

init();
