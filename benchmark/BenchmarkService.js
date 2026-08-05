const { fork } = require('child_process');
const path = require('path');
const { resetBenchmarkDatabase } = require('./BenchmarkDatabaseInitializer');
const DEFAULT_BENCH_DB = process.env.BENCHMARK_DB_NAME || 'evoting_benchmark';

// keep existing imports for compatibility with non-worker fallback (not used in benchmark worker mode)
const db = require("../config/db");
const { Blockchain } = require("../blockchain/blockchain");
const votingService = require("../services/votingService");

function createBenchmarkRequest(req, userId, candidateId) {
  return {
    headers: req.headers || {},
    ip: req.ip || req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "127.0.0.1",
    sessionID: req.sessionID || "benchmark-session",
    session: {
      user: {
        id: userId,
        nim: req.body?.nim || `benchmark-user-${userId}`,
        sudah_vote: false,
        public_key: req.body?.public_key,
        private_key: req.body?.private_key
      },
      destroy: () => {}
    },
    body: { candidate_id: candidateId }
  };
}

function cloneChain(sourceChain) {
  const clone = new Blockchain(sourceChain.tableName);
  clone.chain = sourceChain.chain.slice();
  return clone;
}

function parseRuns(value) {
  const runs = Number(value);
  if (!Number.isFinite(runs) || runs < 1) return 1;
  return Math.min(20, Math.floor(runs));
}

function parseWarmup(value) {
  const w = Number(value);
  if (!Number.isFinite(w) || w < 0) return 3; // default warm-up runs
  return Math.min(10, Math.floor(w));
}

function resetUserVoteFlag(userId) {
  return new Promise((resolve, reject) => {
    db.query("UPDATE users SET sudah_vote = FALSE WHERE id = ?", [userId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function deleteRecentVote(userId, candidateId, startTs, endTs) {
  // Find the most recent vote for user and candidate and delete it
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, voted_at FROM votes WHERE user_id = ? AND candidate_id = ? ORDER BY id DESC LIMIT 1",
      [userId, candidateId],
      (err, rows) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve();
        const row = rows[0];
        // voted_at is TIMESTAMP; use the id to delete
        db.query("DELETE FROM votes WHERE id = ?", [row.id], (delErr) => {
          if (delErr) return reject(delErr);
          resolve();
        });
      }
    );
  });
}

function deleteRecentBlocks(tableName, startTs, endTs) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM ${tableName} WHERE timestamp BETWEEN ? AND ?`;
    db.query(sql, [startTs - 1, endTs + 1], (err) => (err ? reject(err) : resolve()));
  });
}

function deleteRecentAuditLogs(startTs, endTs) {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM audit_logs WHERE timestamp BETWEEN ? AND ?",
      [startTs - 1, endTs + 1],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function computeStats(values) {
  if (!values || values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = values.reduce((s, v) => s + v, 0);
  const avg = sum / values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { average: Number(avg.toFixed(3)), min: Number(min.toFixed(3)), max: Number(max.toFixed(3)), median: Number(median.toFixed(3)) };
}

async function measureVoteSubmissionTime(req, votingChain, auditChain, options = {}) {
  if (!req.body || req.body.user_id == null || req.body.candidate_id == null) {
    return { error: "user_id and candidate_id are required" };
  }

  const userId = Number(req.body.user_id);
  const candidateId = Number(req.body.candidate_id);
  if (!Number.isFinite(userId) || !Number.isFinite(candidateId)) {
    return { error: "user_id and candidate_id must be numeric" };
  }

  const runs = parseRuns(options.runs);
  const warmup = parseWarmup(options.warmup);
  const results = [];

  // Prepare benchmark database and start worker process using benchmark DB
  const benchDbName = options.benchDbName || process.env.BENCHMARK_DB_NAME || DEFAULT_BENCH_DB;
  const resetResult = await resetBenchmarkDatabase({ dbName: benchDbName });
  if (!resetResult.ok) return { error: `Failed to prepare benchmark DB: ${resetResult.error}` };

  // Fork a worker process that loads application modules using the benchmark DB.
  const workerPath = path.join(__dirname, 'benchmark_worker.js');
  const worker = fork(workerPath, [], { env: Object.assign({}, process.env, { DB_DATABASE: benchDbName }) });

  // Wait for worker to signal it's started
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Worker start timeout')), 15000);
    worker.on('message', (m) => {
      if (m && m.type === 'worker-started') {
        clearTimeout(t);
        resolve();
      }
    });
  });

  // ask worker to initialize chains
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Worker init timeout')), 30000);
    worker.once('message', (m) => {
      if (m && m.type === 'ready') {
        clearTimeout(t);
        resolve();
      }
    });
    worker.send({ type: 'init' });
  });

  // Warm-up phase (not recorded)
  for (let w = 0; w < warmup; w += 1) {
    const warmReq = createBenchmarkRequest(req, userId, candidateId);
    // instruct worker to run one iteration (worker measures internally but we ignore)
    const warmRes = await new Promise((resolve, reject) => {
      const onMsg = (m) => {
        if (m && m.type === 'result') {
          worker.removeListener('message', onMsg);
          resolve(m.payload);
        }
        if (m && m.type === 'error') {
          worker.removeListener('message', onMsg);
          resolve(null);
        }
      };
      worker.on('message', onMsg);
      worker.send({ type: 'run', payload: { req: warmReq } });
    });
    // ignore warmRes
  }

  // Measurement runs
  for (let i = 0; i < runs; i += 1) {
    const benchmarkReq = createBenchmarkRequest(req, userId, candidateId);
    const payload = await new Promise((resolve, reject) => {
      const onMsg = (m) => {
        if (m && m.type === 'result') {
          worker.removeListener('message', onMsg);
          resolve(m.payload);
        }
        if (m && m.type === 'error') {
          worker.removeListener('message', onMsg);
          resolve({ executionTimeMs: null, result: { message: 'worker-error' } });
        }
      };
      worker.on('message', onMsg);
      worker.send({ type: 'run', payload: { req: benchmarkReq } });
    });

    results.push({ executionTimeMs: payload.executionTimeMs, result: payload.result });
  }

  // shutdown worker
  worker.send({ type: 'shutdown' });

  const values = results.map(r => r.executionTimeMs);
  const stats = computeStats(values);

  return runs === 1 ? { ...results[0], ...stats } : { runs, results, stats };
}

const { signData, generateKeyPair } = require('../blockchain/keys');

async function measureRsaSignTime(privateKey, data, options = {}) {
  const runs = parseRuns(options.runs || options.count || 10);
  const warmup = parseWarmup(options.warmup || 3);
  const results = [];

  // Warm-up
  for (let w = 0; w < warmup; w += 1) {
    try {
      signData(privateKey, data);
    } catch (e) {
      // ignore
    }
  }

  for (let i = 0; i < runs; i += 1) {
    const start = process.hrtime.bigint();
    const signature = signData(privateKey, data);
    const end = process.hrtime.bigint();
    const executionTimeMs = Number(end - start) / 1e6;
    results.push({ executionTimeMs: Number(executionTimeMs.toFixed(3)), signature });
  }

  const values = results.map(r => r.executionTimeMs);
  const stats = computeStats(values);
  return runs === 1 ? { ...results[0], ...stats } : { runs, results, stats };
}

module.exports = { measureVoteSubmissionTime, measureRsaSignTime };