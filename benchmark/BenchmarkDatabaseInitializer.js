const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { createAdhocConnection } = require('../config/db');
const { fork } = require('child_process');

const SQL_DIR = path.join(__dirname, '..', 'sql');
const SCHEMA_FILE = path.join(SQL_DIR, 'database_schema_lengkap.sql');

async function runQuery(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.query(sql, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

function readSqlFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function prepareSqlForDb(sqlText, dbName) {
  let sql = sqlText;
  sql = sql.replace(/CREATE DATABASE IF NOT EXISTS\s+`?evoting`?/ig, `CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  sql = sql.replace(/USE\s+`?evoting`?/ig, `USE \`${dbName}\``);
  return sql;
}

async function applySqlStatements(conn, sqlText) {
  const statements = sqlText.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    if (!stmt) continue;
    // skip SQL comments
    if (stmt.startsWith('--')) continue;
    await runQuery(conn, stmt);
  }
}

async function resetBenchmarkDatabase(options = {}) {
  const dbName = options.dbName || process.env.BENCHMARK_DB_NAME || 'evoting_benchmark';
  const adminConn = createAdhocConnection({ database: undefined, multipleStatements: true });

  try {
    // Drop and recreate database
    await runQuery(adminConn, `DROP DATABASE IF EXISTS \`${dbName}\``);
    await runQuery(adminConn, `CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Apply base schema using adminConn (multipleStatements enabled) so CREATE/USE statements work
    const baseSql = readSqlFile(SCHEMA_FILE);
    const appliedBase = prepareSqlForDb(baseSql, dbName);
    await new Promise((resolve, reject) => {
      adminConn.query(appliedBase, (err) => err ? reject(err) : resolve());
    });

    // Apply migration_*.sql files in lex order using adminConn; tolerate duplicate column errors
    const files = fs.readdirSync(SQL_DIR).filter(f => f.startsWith('migration_') && f.endsWith('.sql')).sort();
    for (const f of files) {
      const fp = path.join(SQL_DIR, f);
      const sqlText = readSqlFile(fp);
      const prepared = prepareSqlForDb(sqlText, dbName);
      await new Promise((resolve, reject) => {
        adminConn.query(prepared, (err) => {
          if (err) {
            const msg = (err && err.message) ? err.message.toLowerCase() : '';
            if (msg.includes('duplicate column') || msg.includes('already exists') || msg.includes('duplicate column name')) {
              return resolve();
            }
            return reject(err);
          }
          return resolve();
        });
      });
    }

    // Use a connection that is bound to the newly created database for baseline inserts
    const conn = createAdhocConnection({ database: dbName });
    try {
      // Insert 3 candidates if none exist
      const [candRows] = await new Promise((res, rej) => conn.query('SELECT COUNT(*) AS c FROM candidates', (e, r) => e ? rej(e) : res(r)));
      if (candRows && candRows[0] && candRows[0].c === 0) {
        await runQuery(conn, "INSERT INTO candidates (nama_kandidat) VALUES ('Candidate A'), ('Candidate B'), ('Candidate C')");
      }

      // Insert benchmark users if none exist (10 users)
      const [userRows] = await new Promise((res, rej) => conn.query('SELECT COUNT(*) AS c FROM users', (e, r) => e ? rej(e) : res(r)));
      if (userRows && userRows[0] && userRows[0].c === 0) {
        const users = [];
        for (let i = 1; i <= 10; i++) {
          const nim = `bench${String(i).padStart(3,'0')}`;
          users.push([nim, `Benchmark User ${i}`, 'password', 0, null, null]);
        }
        const placeholders = users.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flat = users.flat();
        await new Promise((res, rej) => conn.query(`INSERT INTO users (nim, nama, password, sudah_vote, public_key, private_key) VALUES ${placeholders}`, flat, (e) => e ? rej(e) : res()));
      }

      // Ensure election_settings has id=1 row (schema already inserts it, but double-check)
      const [esRows] = await new Promise((res, rej) => conn.query('SELECT COUNT(*) AS c FROM election_settings WHERE id = 1', (e, r) => e ? rej(e) : res(r)));
      if (esRows && esRows[0] && esRows[0].c === 0) {
        await runQuery(conn, "INSERT INTO election_settings (id, election_name, is_open) VALUES (1, 'Pemilihan Ketua', FALSE)");
      }
    } finally {
      try { conn.end(); } catch (e) {}
    }

    // Initialize blockchain genesis blocks by forking a short process that loads app modules
    await new Promise((resolve, reject) => {
      const script = path.join(__dirname, 'init_chains.js');
      const child = fork(script, [], { env: Object.assign({}, process.env, { DB_DATABASE: dbName }), stdio: 'inherit' });
      child.on('error', (err) => reject(err));
      child.on('exit', (code) => {
        if (code === 0) resolve(); else reject(new Error('init_chains failed with code ' + code));
      });
    });

    return { ok: true, dbName };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    try { adminConn.end(); } catch (e) {}
  }
}

// Validation utilities
async function tableExists(dbName, tableName) {
  const conn = createAdhocConnection({ database: dbName });
  try {
    const [rows] = await new Promise((res, rej) => conn.query("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = ?", [dbName, tableName], (e, r) => e ? rej(e) : res(r)));
    return rows && rows[0] && rows[0].c > 0;
  } finally { try { conn.end(); } catch (e) {} }
}

async function columnExists(dbName, tableName, columnName) {
  const conn = createAdhocConnection({ database: dbName });
  try {
    const [rows] = await new Promise((res, rej) => conn.query("SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?", [dbName, tableName, columnName], (e, r) => e ? rej(e) : res(r)));
    return rows && rows[0] && rows[0].c > 0;
  } finally { try { conn.end(); } catch (e) {} }
}

async function validate(options = {}) {
  const dbName = options.dbName || process.env.BENCHMARK_DB_NAME || 'evoting_benchmark';
  const report = {
    database: dbName,
    schema: { ok: true, details: [] },
    baseline: { ok: true, details: [] },
    genesis: { ok: true, details: [] },
    startup: { ok: true, details: [] },
    isolation: { ok: true, details: [] }
  };

  // Required tables and columns
  const required = {
    users: ['id','nim','nama','password','sudah_vote','public_key','private_key'],
    candidates: ['id','nama_kandidat'],
    votes: ['id','user_id','candidate_id','voted_at'],
    election_settings: ['id','election_name','is_open'],
    blockchain: ['id','block_index','timestamp','data','previous_hash','hash','merkle_root'],
    audit_logs: ['id','timestamp','username','action','ip_address','session_id']
  };

  for (const [table, cols] of Object.entries(required)) {
    const exists = await tableExists(dbName, table);
    if (!exists) {
      report.schema.ok = false;
      report.schema.details.push({ table, ok: false, reason: 'table missing' });
      continue;
    }
    const missing = [];
    for (const col of cols) {
      // skip check for columns that may be added by migrations for optional tables
      const colExists = await columnExists(dbName, table, col);
      if (!colExists) missing.push(col);
    }
    if (missing.length > 0) {
      report.schema.ok = false;
      report.schema.details.push({ table, ok: false, missing });
    } else {
      report.schema.details.push({ table, ok: true });
    }
  }

  // Baseline data checks: election_settings id=1
  const conn = createAdhocConnection({ database: dbName });
  try {
    const [es] = await new Promise((res, rej) => conn.query('SELECT * FROM election_settings WHERE id = 1', (e, r) => e ? rej(e) : res(r)));
    if (!es || es.length === 0) {
      report.baseline.ok = false;
      report.baseline.details.push({ election_settings: 'missing id=1' });
    } else {
      report.baseline.details.push({ election_settings: 'ok', row: es[0] });
    }

    // candidates
    const [cands] = await new Promise((res, rej) => conn.query('SELECT COUNT(*) AS c FROM candidates', (e, r) => e ? rej(e) : res(r)));
    const candCount = cands && cands[0] ? cands[0].c : 0;
    if (candCount === 0) {
      report.baseline.ok = false;
      report.baseline.details.push({ candidates: `0 rows` });
    } else {
      report.baseline.details.push({ candidates: `${candCount} rows` });
    }

    // users
    const [users] = await new Promise((res, rej) => conn.query('SELECT COUNT(*) AS c FROM users', (e, r) => e ? rej(e) : res(r)));
    const userCount = users && users[0] ? users[0].c : 0;
    if (userCount === 0) {
      report.baseline.ok = false;
      report.baseline.details.push({ users: `0 rows` });
    } else {
      report.baseline.details.push({ users: `${userCount} rows` });
    }

    // Genesis blocks existence in blockchain, candidate_ledger_blocks, audit_ledger_blocks
    const ledgerTables = ['blockchain', 'candidate_ledger_blocks', 'audit_ledger_blocks'];
    for (const t of ledgerTables) {
      const exists = await tableExists(dbName, t);
      if (!exists) {
        report.genesis.ok = false;
        report.genesis.details.push({ table: t, ok: false, reason: 'missing table' });
        continue;
      }
      const [rows] = await new Promise((res, rej) => conn.query(`SELECT COUNT(*) AS c FROM ${t}`, (e, r) => e ? rej(e) : res(r)));
      const c = rows && rows[0] ? rows[0].c : 0;
      if (c === 0) {
        report.genesis.ok = false;
        report.genesis.details.push({ table: t, ok: false, reason: 'no genesis block' });
      } else {
        report.genesis.details.push({ table: t, ok: true, rows: c });
      }
    }
  } catch (e) {
    report.baseline.ok = false;
    report.baseline.details.push({ error: e.message });
  } finally {
    try { conn.end(); } catch (e) {}
  }

  // Application Startup validation: try to initialize chains by forking init_chains.js (non-destructive)
  try {
    await new Promise((resolve, reject) => {
      const script = path.join(__dirname, 'init_chains.js');
      const child = fork(script, [], { env: Object.assign({}, process.env, { DB_DATABASE: dbName }), stdio: 'pipe' });
      child.on('error', (err) => reject(err));
      child.on('exit', (code) => {
        if (code === 0) resolve(); else reject(new Error('init_chains failed with code ' + code));
      });
    });
    report.startup.ok = true;
    report.startup.details.push('worker init succeeded');
  } catch (e) {
    report.startup.ok = false;
    report.startup.details.push(e.message);
  }

  // Benchmark Isolation: ensure DB name is not production DB
  const prodDb = process.env.DB_DATABASE || 'evoting';
  if (dbName === prodDb) {
    report.isolation.ok = false;
    report.isolation.details.push({ reason: 'benchmark DB equals production DB', dbName, prodDb });
  } else {
    report.isolation.ok = true;
    report.isolation.details.push({ benchDb: dbName, prodDb });
  }

  return report;
}

module.exports = { resetBenchmarkDatabase, validate };
