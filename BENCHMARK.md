# Benchmark Framework

This document describes the benchmark framework implemented in this repository. The benchmarks are research tools designed to measure the performance characteristics of core primitives used by the e‑voting system: RSA signing, Merkle tree construction, block creation and blockchain verification.

All content in this document is based on the actual implementation under the `benchmark/` folder. No functionality is invented — the documentation mirrors the code.

---

## 1. Benchmark overview

The benchmark suite contains focused micro-benchmarks that exercise the production cryptographic and blockchain primitives implemented in the `blockchain/` directory. A driver script (`benchmark/run_all_benchmarks.js`) runs the following benchmarks and produces summary outputs in CSV, JSON and Markdown formats:

- RSA Signature benchmark
- Merkle Tree benchmark
- Block Creation benchmark
- Blockchain Verification benchmark

Each benchmark measures execution times (milliseconds) using high-resolution timers (process.hrtime.bigint) and reports aggregated statistics (average, median, min, max).

---

## 2. Research objective

The primary research objective of these benchmarks is to empirically characterize the computational cost of the integrity mechanisms used by the system so that the trade-offs between security (signatures, Merkle trees, verification) and performance can be evaluated. The measurements support:

- Estimating per-operation costs for signing, hashing and verification
- Evaluating how costs scale with input size (payload size / number of transactions / chain length)
- Identifying dominant components to prioritize optimization in future work

---

## 3. Benchmark architecture

Benchmarks are implemented as independent service modules under `benchmark/` and invoked by `run_all_benchmarks.js` which:

1. Constructs deterministic inputs for each experiment (payload sizes, transaction lists, chain lengths).
2. Invokes the corresponding measure* function exported by the benchmark service module.
3. Collects run-level timing samples and computes statistics.
4. Writes summary outputs (CSV, JSON, Markdown) to `benchmark/`.

Support components in the folder include:

- `BenchmarkService.js` — helper utilities (also includes a vote submission benchmark path `measureVoteSubmissionTime` that uses worker processes and a benchmark DB initializer; this function is implemented but not invoked by the summary driver).
- `BenchmarkDatabaseInitializer.js` — helper to create and seed a dedicated benchmark database (used by workerized benchmarks that exercise the full application stack).
- `benchmark_worker.js` / `init_chains.js` — worker helpers used by the workerized benchmarking path.

---

## 4. Components measured

Each measured component is implemented as a `*BenchmarkService.js` module. The driver `run_all_benchmarks.js` calls the following modules and parameters:

### RSA Signature Benchmark
- File: `benchmark/RsaBenchmarkService.js`
- What it measures: time to sign a deterministic JSON payload using the production signing helper (`blockchain/keys.js` → `signData`).
- Inputs used by driver: payload sizes = [128, 256, 512, 1024] bytes.
- Defaults used in driver: runs = 50, warmup = 5.
- Measurement approach: warmup iterations call `signData` (not recorded). Measured runs time the `signData` call using hrtime and return per-run execution times.

### Merkle Tree Benchmark
- File: `benchmark/MerkleBenchmarkService.js`
- What it measures: time to compute the Merkle root of a set of transactions using `blockchain/merkle.js` (`getMerkleRoot`).
- Inputs used by driver: transaction counts = [10, 50, 100, 250, 500, 1000].
- Defaults used in driver: runs = 50, warmup = 5.
- Additional output: metadata describing expected tree height, number of leaf/internal hashes and total hash operations (computed deterministically by `computeMerkleMetadata`).

### Block Creation Benchmark
- File: `benchmark/BlockCreationBenchmarkService.js`
- What it measures: time to instantiate `Block` objects for a block that contains a given number of transactions; this includes Merkle root computation and block hash calculation performed by the `Block` constructor.
- Inputs used by driver: transaction counts = [10, 50, 100, 250, 500, 1000].
- Defaults used in driver: runs = 50, warmup = 5.
- Measurement approach: warmup instantiation runs are performed, then measured runs record time to `new Block(...)` for the generated deterministic transactions.

### Blockchain Verification Benchmark
- File: `benchmark/BlockchainVerificationBenchmarkService.js`
- What it measures: time to validate a chain using `Blockchain.isChainValid()` over a chain with `n` blocks.
- Inputs used by driver: chain lengths = [10, 50, 100, 250, 500, 1000].
- Defaults used in driver: runs = 50, warmup = 5.
- Preparation: the benchmark prepares an in-memory chain with deterministic blocks and RSA signatures (using `generateKeyPair` + `signData`) before measurement. Measured runs call `isChainValid()` and record the timing.

---

## 5. Measurement methodology

All benchmarks use the following methodology:

- Warm-up: several iterations are executed prior to measurement to warm caches and the JIT. The driver supplies warmup counts (default 5 for most experiments) and the benchmark modules implement warmup loops.
- High-resolution timing: measured runs use `process.hrtime.bigint()` to obtain nanosecond-resolution timestamps. Differences are converted to milliseconds for reporting.
- Per-run samples: each benchmark collects per-run execution times into an array of numeric milliseconds values.
- Aggregate statistics: compute average, median, minimum and maximum execution times from the per-run samples. These statistics are included in JSON and used to populate CSV and Markdown summary tables.
- Deterministic inputs: inputs are constructed deterministically (fixed timestamps, predictable synthetic payloads/transactions) so runs are repeatable across environments as far as the hardware allows.

---

## 6. Warm-up and measured runs

- Warm-up runs are implemented per benchmark module and are not included in measured statistics.
- The driver (`run_all_benchmarks.js`) uses the following values when invoking the modules:
  - RSA: warmup = 5, runs = 50
  - Merkle: warmup = 5, runs = 50
  - Block creation: warmup = 5, runs = 50
  - Blockchain verification: warmup = 5, runs = 50

Each benchmark module also exposes `parseWarmup`/`parseRuns` helpers so callers can override these counts programmatically.

---

## 7. Dataset configuration

- RSA benchmark: driver creates deterministic JSON payloads padded to target byte sizes (128, 256, 512, 1024). The payload is built so its final byte length matches the target.
- Merkle & Block Creation benchmarks: synthetic deterministic transactions are generated. Each transaction includes fields: `tx_id`, `voter_id`, `candidate_id`, `amount`, `timestamp`, `metadata`.
- Blockchain verification: synthetic chain is generated with one transaction per block (deterministic), with signatures produced by a generated keypair.

These datasets are constructed in-memory by the driver or service modules — no external data files are required.

---

## 8. Output files

The driver produces three summary outputs in the `benchmark/` folder.

### CSV (`benchmark/benchmark_summary.csv`)
- Columns: Component, Average, Median, Minimum, Maximum, Dataset
- Each row corresponds to one measured dataset (e.g. RSA 128 bytes, Merkle 100 tx).

### JSON (`benchmark/benchmark_summary.json`)
- An array of objects where each object contains: component, dataset, average, median, minimum, maximum. JSON is suitable for programmatic post-processing.

### Markdown summary (`benchmark/benchmark_summary.md`)
- Human-readable report with per-component sections and a final "Dominant Component" note that identifies the single dataset with the largest median execution time.

All three files are written by the end of `run_all_benchmarks.js`.

---

## 9. How to run

From the repository root execute the driver:

```bash
node benchmark/run_all_benchmarks.js
```

Notes:
- The driver imports production code paths (e.g. `blockchain/keys.js`) so your environment must have dependencies installed (`npm install`).
- The benchmark suite contains additional workerized benchmarking paths (in `BenchmarkService.js`) that can initialize a dedicated benchmark database and fork worker processes; these are not invoked by the summary driver but are available for more application-level benchmarking if needed. Inspect `BenchmarkDatabaseInitializer.js` before using those workerized helpers.

---

## 10. Sample output (format)

The repository includes previously generated CSV/JSON/MD samples under `benchmark/` (these are the outputs produced by earlier runs). The CSV header looks like:

```
Component,Average,Median,Minimum,Maximum,Dataset
RSA Signature,12.345,11.987,10.123,15.678,"128 bytes"
Merkle Tree,0.123,0.120,0.110,0.150,"100 tx"
...
```

The JSON is an array of objects with fields `component`, `dataset`, `average`, `median`, `minimum`, `maximum`.

The Markdown report contains tables per component and a "Dominant Component" paragraph describing which dataset had the largest median.

> Note: numeric values above are illustrative of the output format only. For real measured numbers, run the driver in your environment.

---

## 11. Result interpretation

- Average vs median: median is less sensitive to outliers and is used by the driver to identify the dominant (most expensive) dataset.
- Minimum and maximum indicate the variability across measured runs — a large spread suggests non-deterministic noise or system-level interference (e.g., scheduling, I/O contention).
- For research reporting, prefer median and inter-run distributions rather than single-run measures.

---

## 12. Dominant component

The driver performs a simple analysis that finds the single dataset (component + dataset pair) with the largest median execution time and includes it in the Markdown summary as the "Dominant Component". This is a heuristic useful for highlighting which operation dominates runtime costs in the experiment.

---

## 13. Notes and limitations

- Environment sensitivity: measurements depend heavily on CPU performance, system load, and Node.js runtime characteristics. Run benchmarks on an otherwise-idle machine for consistent results.
- Non-isolated runs: the driver runs all experiments sequentially in a single Node process; for strict isolation use the workerized benchmarking paths (see `BenchmarkService.js`) that initialize a dedicated DB and fork workers.
- DB safety: some benchmark helpers can initialize a benchmark database (see `BenchmarkDatabaseInitializer.js`) — avoid running these against production databases.
- Warmup and JIT: Node.js JIT and garbage collector behavior may affect early runs; the use of warm-up iterations mitigates but does not eliminate this.
- Measurement granularity: timings are taken with hrtime and reported in milliseconds with 3 decimals — extremely short operations may be dominated by noise on some platforms.
- Reproducibility: deterministic inputs are used, but precise timings are environment-dependent. Record hardware and execution environment when reporting results.

---

## Implementation pointers

- Review the service modules under `benchmark/` for implementation details and extension points.
- If you need to benchmark application-level vote submission (end‑to‑end with DB), inspect `BenchmarkService.js` and `BenchmarkDatabaseInitializer.js` to run workerized experiments in a safe, isolated benchmark database.

---

If you'd like, I can add an npm script (e.g., `benchmark`) to `package.json` that runs `node benchmark/run_all_benchmarks.js` and optionally accepts environment variables to control runs/warmup. Would you like that added?