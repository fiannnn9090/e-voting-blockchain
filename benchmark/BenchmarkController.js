// Lazy-require heavy benchmark modules inside handlers to avoid eager DB connections


async function runVoteSubmissionBenchmark(req, res) {
  // lazy require to avoid loading DB-heavy modules at route registration time
  const benchmarkService = require('../benchmark/BenchmarkService');
  const options = { runs: req.query.runs };
  const benchmark = await benchmarkService.measureVoteSubmissionTime(
    req,
    req.app.locals.votingChain,
    req.app.locals.auditChain,
    options
  );

  if (benchmark.error) {
    return res.status(400).json({ ok: false, message: benchmark.error });
  }

  if (req.query.format === "csv") {
    const isMultiple = Boolean(benchmark.results);
    const rows = [];
    if (isMultiple) {
      const { average, min, max, median } = benchmark.stats || { average: '', min: '', max: '', median: '' };
      benchmark.results.forEach((row, idx) => {
        rows.push(`${idx + 1},${row.executionTimeMs},${average},${min},${max},${median}`);
      });
      const header = "Run,Execution Time (ms),Average,Minimum,Maximum,Median";
      const csv = [header, ...rows].join("\n");
      res.header("Content-Type", "text/csv");
      return res.send(csv);
    }

    // single run
    const avg = benchmark.average || '';
    const min = benchmark.min || '';
    const max = benchmark.max || '';
    const median = benchmark.median || '';
    const header = "Run,Execution Time (ms),Average,Minimum,Maximum,Median";
    const row = `1,${benchmark.executionTimeMs},${avg},${min},${max},${median}`;
    res.header("Content-Type", "text/csv");
    return res.send([header, row].join("\n"));
  }

  if (benchmark.results) {
    return res.json({ ok: true, runs: benchmark.runs, results: benchmark.results, stats: benchmark.stats });
  }

  // single-run return includes computed stats when available
  const single = {
    ok: true,
    executionTimeMs: benchmark.executionTimeMs,
    voteResult: benchmark.result,
    average: benchmark.average || (benchmark.stats && benchmark.stats.average),
    min: benchmark.min || (benchmark.stats && benchmark.stats.min),
    max: benchmark.max || (benchmark.stats && benchmark.stats.max),
    median: benchmark.median || (benchmark.stats && benchmark.stats.median)
  };

  res.json(single);
}

async function runRsaSignBenchmark(req, res) {
  // lazy require to avoid pulling DB modules when not needed
  const rsaService = require('./RsaBenchmarkService');

  // Accept either provided private_key or generate a fresh one for this benchmark
  let privateKey = req.body && req.body.private_key;
  const payload = req.body && (req.body.data || { voter: 1, candidate: 1 });
  if (!privateKey) {
    const kp = require('../blockchain/keys').generateKeyPair();
    privateKey = kp.privateKey;
  }

  const options = { runs: req.query.runs, warmup: req.query.warmup };
  const benchmark = await rsaService.measureRsaSignTime(privateKey, payload, options);

  if (req.query.format === 'csv') {
    const isMultiple = Boolean(benchmark.results);
    const rows = [];
    if (isMultiple) {
      const { average, min, max, median } = benchmark.stats || { average: '', min: '', max: '', median: '' };
      benchmark.results.forEach((row, idx) => {
        rows.push(`${idx + 1},${row.executionTimeMs},${average},${min},${max},${median}`);
      });
      const header = "Run,Execution Time (ms),Average,Minimum,Maximum,Median";
      const csv = [header, ...rows].join("\n");
      res.header("Content-Type", "text/csv");
      return res.send(csv);
    }

    const avg = benchmark.stats && benchmark.stats.average || '';
    const min = benchmark.stats && benchmark.stats.min || '';
    const max = benchmark.stats && benchmark.stats.max || '';
    const median = benchmark.stats && benchmark.stats.median || '';
    const header = "Run,Execution Time (ms),Average,Minimum,Maximum,Median";
    const row = `1,${benchmark.executionTimeMs},${avg},${min},${max},${median}`;
    res.header("Content-Type", "text/csv");
    return res.send([header, row].join("\n"));
  }

  if (benchmark.results) {
    return res.json({ ok: true, runs: benchmark.runs, results: benchmark.results, stats: benchmark.stats });
  }

  res.json({ ok: true, ...benchmark });
}

module.exports = { runVoteSubmissionBenchmark, runRsaSignBenchmark };