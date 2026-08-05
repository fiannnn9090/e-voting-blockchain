const db = require('../config/db');
const { Blockchain, Block } = require('../blockchain/blockchain');
const votingService = require('../services/votingService');

// promisified db.query
function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function ensureElectionOpen() {
  const rows = await q('SELECT * FROM election_settings LIMIT 1');
  if (!rows || rows.length === 0) {
    // create a default settings row if missing
    await q("INSERT INTO election_settings (id, election_name, is_open) VALUES (1, 'Validation Election', TRUE)");
    return { previous: null, restoredTo: true };
  }
  const prev = rows[0];
  const prevVal = prev.is_open;
  if (!prevVal) {
    await q('UPDATE election_settings SET is_open = TRUE WHERE id = ?', [prev.id]);
  }
  return { previous: prevVal, restoredTo: prevVal };
}

async function restoreElectionSetting(previous) {
  try {
    if (previous === null) {
      // We inserted a settings row during validation; remove it to avoid leaving a footprint
      await q('DELETE FROM election_settings WHERE id = 1');
      return;
    }
    await q('UPDATE election_settings SET is_open = ? WHERE id = 1', [previous ? 1 : 0]);
  } catch (e) {
    // ignore
  }
}

async function createValidationUsers(count = 3) {
  const inserted = [];
  for (let i = 1; i <= count; i++) {
    const nim = `validation_user_${Date.now()}_${i}`;
    const nama = `Validation User ${i}`;
    // password is plain; not used in validation
    const res = await q('INSERT INTO users (nim, nama, password, sudah_vote) VALUES (?, ?, ?, ?)', [nim, nama, 'password', 0]);
    // mysql2 returns OkPacket — need to get insertedId; using SELECT to find row
    const rows = await q('SELECT * FROM users WHERE nim = ? LIMIT 1', [nim]);
    if (rows && rows[0]) inserted.push(rows[0]);
  }
  return inserted;
}

async function deleteValidationUsers(users) {
  if (!users || users.length === 0) return;
  const ids = users.map(u => u.id);
  try {
    await q(`DELETE FROM votes WHERE user_id IN (${ids.map(() => '?').join(',')})`, ids);
    await q(`DELETE FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  } catch (e) {
    // ignore cleanup errors
  }
}

async function getCandidates() {
  const rows = await q('SELECT id FROM candidates ORDER BY id ASC');
  return rows.map(r => r.id);
}

async function getTableMaxIndex(tableName) {
  const rows = await q(`SELECT MAX(block_index) AS m FROM ${tableName}`);
  const m = rows && rows[0] && rows[0].m;
  return (typeof m === 'number') ? m : (m ? Number(m) : null);
}

async function deleteBlocksAfter(tableName, index) {
  if (index == null) return;
  try {
    await q(`DELETE FROM ${tableName} WHERE block_index > ?`, [index]);
  } catch (e) {
    // ignore
  }
}

function cloneChain(sourceChain) {
  // Deep-clone blocks into a new in-memory Blockchain instance so we can tamper without touching DB
  const clone = new Blockchain('_validation_inmemory');
  clone.chain = sourceChain.chain.map((b) => {
    // create a new Block instance with the same constructor args
    const newBlock = new Block(b.index, b.timestamp, JSON.parse(JSON.stringify(b.data)), b.previousHash, b.signature, b.publicKey);
    // preserve original merkleRoot and hash so validation checks match DB values
    try {
      newBlock.hash = b.hash;
      newBlock.merkleRoot = b.merkleRoot;
    } catch (e) {
      // ignore
    }
    return newBlock;
  });
  return clone;
}

async function runScenario1_usingRealWorkflow(voteChain, auditChain, validationUsers, candidateId) {
  // Use votingService.castVote for each validation user to create real blocks
  for (const user of validationUsers) {
    const req = {
      headers: {},
      ip: '127.0.0.1',
      sessionID: `validation-session-${user.id}`,
      session: { user: user, destroy: () => {} },
      body: { candidate_id: candidateId }
    };
    // call castVote and await its completion
    // it returns a promise that resolves with message object
    await votingService.castVote(req, voteChain, auditChain);
  }

  // After votes cast, validate the chain built by the real workflow
  const actual = Boolean(voteChain.isChainValid());
  const expected = true;
  const status = actual === expected ? 'PASS' : 'FAIL';
  const report = { scenario: 'Original Blockchain', expected, actual, status };

  // Create an in-memory clone to be used for non-destructive tampering experiments
  const clonedChain = cloneChain(voteChain);

  return { report, clonedChain };
}

async function runScenario2_tamper(clonedChain) {
  // Operate on a cloned in-memory chain so DB is not modified
  const targetIndex = clonedChain.chain.length > 1 ? 1 : 0;
  const originalBlock = clonedChain.chain[targetIndex];
  const originalData = originalBlock && originalBlock.data ? JSON.parse(JSON.stringify(originalBlock.data)) : null;
  let tamperedData;
  if (originalData && typeof originalData === 'object' && Object.prototype.hasOwnProperty.call(originalData, 'candidate')) {
    tamperedData = Object.assign({}, originalData, { candidate: (originalData.candidate % 10) + 10 });
  } else if (originalData && typeof originalData === 'object' && Object.prototype.hasOwnProperty.call(originalData, 'candidate_id')) {
    tamperedData = Object.assign({}, originalData, { candidate_id: (originalData.candidate_id % 10) + 10 });
  } else {
    tamperedData = Object.assign({}, originalData || {}, { tampered: true });
  }

  // apply tampering on clone only
  if (typeof clonedChain.hackBlock === 'function') {
    clonedChain.hackBlock(targetIndex, tamperedData);
  } else if (clonedChain.chain[targetIndex]) {
    clonedChain.chain[targetIndex].data = tamperedData;
    clonedChain.chain[targetIndex].transactions = Array.isArray(tamperedData) ? tamperedData : [tamperedData];
  }

  const actual = Boolean(clonedChain.isChainValid());
  const expected = false;
  const status = actual === expected ? 'PASS' : 'FAIL';
  const mechanism = ['Blockchain', 'Merkle Tree'];

  // Recovery: restore original data on the cloned chain and verify validity returns true again
  let recovery = { restored: false, postRestoreActual: null, postRestoreStatus: 'FAIL' };
  try {
    // restore original
    if (typeof clonedChain.hackBlock === 'function') {
      clonedChain.hackBlock(targetIndex, originalData);
    } else if (clonedChain.chain[targetIndex]) {
      clonedChain.chain[targetIndex].data = originalData;
      clonedChain.chain[targetIndex].transactions = Array.isArray(originalData) ? originalData : [originalData];
    }
    const postRestoreActual = Boolean(clonedChain.isChainValid());
    recovery.restored = true;
    recovery.postRestoreActual = postRestoreActual;
    recovery.postRestoreStatus = postRestoreActual === true ? 'PASS' : 'FAIL';
  } catch (e) {
    recovery.restored = false;
    recovery.postRestoreActual = null;
    recovery.postRestoreStatus = 'FAIL';
  }

  const report = { scenario: 'Tampered Vote', expected, actual, status, mechanism: actual === expected ? mechanism : [], recovery };
  return report;
}

module.exports = {
  // main entry: runs two scenarios using real voting workflow and returns reports
  async runValidation() {
    // Prepare resources and track cleanup
    let insertedUsers = [];
    let electionPrev = null;
    const reports = [];

    // Create chain instances connected to DB (reuse production persistence)
    const voteChain = await Blockchain.create();
    const auditChain = await Blockchain.create('audit_ledger_blocks');

    // Record pre-insert maxima for cleanup
    const preMaxVote = await getTableMaxIndex('blockchain');
    const preMaxAudit = await getTableMaxIndex('audit_ledger_blocks');

    try {
      // Ensure election open and remember previous state
      const prev = await q('SELECT * FROM election_settings LIMIT 1');
      electionPrev = prev && prev[0] ? prev[0].is_open : null;
      await ensureElectionOpen();

      // Create temporary validation users
      insertedUsers = await createValidationUsers(3);
      if (insertedUsers.length === 0) throw new Error('No validation users created');

      // Choose a candidate to vote for
      const candidates = await getCandidates();
      if (!candidates || candidates.length === 0) throw new Error('No candidates found in database');
      const candidateId = candidates[0];

      // Scenario 1: cast votes using real workflow
      const { report: r1, clonedChain } = await runScenario1_usingRealWorkflow(voteChain, auditChain, insertedUsers, candidateId);
      reports.push(r1);

      // Scenario 2: tamper and validate detection using cloned chain (non-destructive)
      const r2 = await runScenario2_tamper(clonedChain);
      reports.push(r2);

    } catch (e) {
      // If any scenario fails unexpectedly, record error reports and continue cleanup
      reports.push({ scenario: 'Original Blockchain', expected: true, actual: null, status: 'FAIL', error: String(e) });
      reports.push({ scenario: 'Tampered Vote', expected: false, actual: null, status: 'FAIL', error: String(e) });
    } finally {
      // Cleanup: delete votes/blocks/audit entries and users we created, and restore election setting
      try {
        const postMaxVote = await getTableMaxIndex('blockchain');
        const postMaxAudit = await getTableMaxIndex('audit_ledger_blocks');

        // delete blockchain blocks appended by validation (block_index > preMaxVote)
        await deleteBlocksAfter('blockchain', preMaxVote == null ? -1 : preMaxVote);
        await deleteBlocksAfter('audit_ledger_blocks', preMaxAudit == null ? -1 : preMaxAudit);

        // remove votes for our users and delete users
        await deleteValidationUsers(insertedUsers);

        // restore election setting
        await restoreElectionSetting(electionPrev);
      } catch (cleanupErr) {
        // ignore
      }
    }

    return reports;
  }
};
