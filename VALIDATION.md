# Integrity Validation

This document describes the Integrity Validation Framework implemented in this repository. The framework is an experimental, research-only tool designed to verify that the proposed Blockchain-based e‑voting architecture can detect unauthorized modifications to vote data. It reuses the production implementations of blockchain, Merkle tree, RSA signatures, and the audit ledger to achieve experimental validity while guaranteeing non-destructive behaviour.

Note: This document is distinct from TESTING.md (functional/unit/integration test documentation) and BENCHMARK.md (performance benchmarking). VALIDATION.md concerns only integrity validation experiments and reporting.

---

## Validation Objectives

The validation framework is implemented with the following objectives:

- Validate blockchain integrity (chain hash links and block hashes).
- Validate Merkle Tree integrity (Merkle root correctly represents block transactions).
- Validate digital signature integrity (RSA signatures and public key verification for vote blocks).
- Validate Audit Ledger behaviour (audit entries created by the vote workflow are produced and removable by cleanup).
- Verify that tampering (single-vote modification) is detected by the combined integrity checks.

All objectives use the production code paths and primitives; no production business logic files are modified by the validation framework.

---

## Validation Architecture

The validation harness executes the real voting workflow to construct an authentic blockchain (votes, signatures, merkle roots, audit entries) and then performs non-destructive tampering experiments on an in-memory clone of the ledger. Key architectural decisions are:

- Use the real production voting workflow (services/votingService.castVote) to create vote blocks and audit entries.
- Load production-ledger state via `Blockchain.create()` which reads persisted block rows from the database tables used by the application.
- Clone the loaded Blockchain into an entirely in-memory copy for tampering experiments so the database is never permanently modified.
- Use layered verification implemented in the production `Blockchain.isChainValid()` method which checks (a) block hashes and previousHash linkage, (b) Merkle root correctness, and (c) RSA signature verification.
- Generate consolidated reports (JSON/CSV/Markdown) from experimental results.

Mermaid diagram (high-level):

```mermaid
flowchart LR
  Vote[User Vote]
  Vote -->|votingService.castVote| Blockchain[Production Blockchain (DB-backed)]
  Blockchain --> MerkleTree[Merkle Tree / merkle.js]
  Blockchain --> DigitalSignature[RSA Sign / keys.js]
  Blockchain --> AuditLedger[Audit Ledger (audit_ledger_blocks)]

  Tampering[Tampering (in-memory clone)] --> ValidationEngine[IntegrityValidationService]
  ValidationEngine --> BlockchainVerification[Blockchain.isChainValid()]
  ValidationEngine --> MerkleVerification[verifyMerkleRoot()]
  ValidationEngine --> SignatureVerification[verifySignature()]

  BlockchainVerification --> Result[Result]
  MerkleVerification --> Result
  SignatureVerification --> Result
```

---

## Implemented Components (code inspected)

The validation framework is implemented in the `validation/` directory and reuses production modules under `blockchain/` and `services/`:

- validation/IntegrityValidationService.js — core orchestration of scenarios, cloning, non-destructive tampering, cleanup.
- validation/ValidationReportGenerator.js — writes validation_report.json, validation_report.csv, validation_report.md.
- validation/run_integrity_validation.js — CLI driver that prints concise scenario results and writes reports.
- blockchain/blockchain.js — Block and Blockchain classes (used for loading ledgers, cloning, and isChainValid()).
- blockchain/merkle.js — Merkle tree functions (getMerkleRoot, verifyMerkleRoot) used in verification.
- blockchain/keys.js — RSA signing and verification utilities used in production vote workflow and verification.
- services/votingService.js — production vote workflow used to create real blocks and audit entries during validation.

No production business logic files were changed by the validation framework; only additional files under `validation/` were added.

---

## Validation Scenarios (Implemented: Scenario 1 & Scenario 2)

The validation harness implements only the first two scenarios. Each scenario is executed in sequence, and results are collected into a final reports array. The driver prints concise PASS/FAIL messages and writes report files.

### Scenario 1 — Original Blockchain

Purpose
- Verify that the blockchain created by the real voting workflow and persisted in the production ledger is considered valid by the production verification logic.

Procedure
1. Ensure election settings are open (framework will insert or set election_settings.is_open = TRUE if necessary, recording prior state for later restoration).
2. Create a small set of temporary validation users in the `users` table.
3. Use `services/votingService.castVote(req, voteChain, auditChain)` with each validation user to execute the real voting workflow that:
   - Constructs a Block with transaction(s).
   - Creates an RSA signature (voter private key) and stores the public key and signature in the block row.
   - Computes and stores the Merkle root for the block transactions.
   - Persists the block row into the `blockchain` table and an audit entry into `audit_ledger_blocks`.
4. After votes are cast, call `voteChain.isChainValid()` (production method) which performs layered checks and returns a boolean.

Expected result
- `isChainValid()` returns TRUE.

Report
- The report entry generated is of the form:

```json
{ "scenario": "Original Blockchain", "expected": true, "actual": true, "status": "PASS" }
```

Notes
- After Scenario 1 the framework creates an in-memory clone of the loaded chain for Scenario 2 so that tampering is non-destructive.

### Scenario 2 — Tampered Vote

Purpose
- Verify that a single vote modification (tampering) is detected by the combined blockchain integrity checks (hash linkage, Merkle root verification, signature verification).

Procedure
1. Use the in-memory cloned blockchain (produced after Scenario 1) so the database and persisted ledger remain unchanged.
2. Select a target block index in the cloned chain (the harness picks index 1 when available or 0 otherwise).
3. Modify only the vote transaction(s) inside the cloned block (e.g., change `candidate_id` or `candidate`). Do NOT recalculate Merkle root, signature, or hash — this simulates a stealthy tamper where only the stored transaction payload is changed.
4. Run `clonedChain.isChainValid()`.

Expected result
- `isChainValid()` returns FALSE because either Merkle verification or hash/signature verification will detect inconsistency.

Report
- Expected report structure when detection succeeds:

```json
{
  "scenario":"Tampered Vote",
  "expected": false,
  "actual": false,
  "status": "PASS",
  "mechanism": ["Blockchain", "Merkle Tree"]
}
```

Recovery verification
- The framework restores the original block data on the in-memory clone and re-runs `isChainValid()` to verify that the restoration returns TRUE. The recovery check is included in the report under `recovery` with fields `restored`, `postRestoreActual`, and `postRestoreStatus`.

---

## Non‑Destructive Design and Cleanup Guarantees

The validation framework is designed to avoid leaving permanent changes in the production database. The key mechanisms used to guarantee cleanup are:

1. Pre‑run state snapshot
   - `getTableMaxIndex(tableName)` records the maximum `block_index` in `blockchain` and `audit_ledger_blocks` before validation begins. Only rows with `block_index` greater than the recorded maxima are considered inserted by the validation run and are removed during cleanup.

2. Use of in‑memory cloned ledger for tampering
   - Tampering is performed on a deep clone created by `cloneChain(sourceChain)`. The clone is a pure in-memory `Blockchain` instance that preserves stored merkleRoot and hash fields but is not persisted to the DB. This guarantees the tamper experiment does not write to the database.

3. Controlled temporary user creation and deletion
   - The framework creates a small set of `validation` users (inserted into `users`) to run the real voting workflow. Their IDs are tracked and all their `votes` rows and `users` rows are deleted in the cleanup step.

4. try/finally cleanup block
   - The main orchestration (`runValidation()`) wraps scenario execution in a try/finally block. The finally block performs deletion of any appended blockchain/audit rows and removes the temporary users. It also attempts to restore the election_settings row to its pre-run state (or deletes the inserted settings row if it was created solely for validation).

5. Best‑effort but explicit cleanup SQL
   - Cleanup operations are executed via deterministic DELETE statements:
   - `DELETE FROM blockchain WHERE block_index > <preMaxVote>`
   - `DELETE FROM audit_ledger_blocks WHERE block_index > <preMaxAudit>`
   - `DELETE FROM votes WHERE user_id IN (...)`
   - `DELETE FROM users WHERE id IN (...)`

6. Isolation recommendations (practical)
   - The code assumes no concurrent writes to the same ledger tables during validation. For strict non-interference, run validation in an isolated test or maintenance environment or ensure no other producers are appending blocks concurrently.

Limitations of cleanup guarantee
- Cleanup is best‑effort: if other processes append blocks concurrently during validation, block_index thresholds may not uniquely identify validation-inserted rows. The framework records pre-run maxima to reduce this risk but cannot absolutely guarantee cleanliness under concurrent workloads without transactional or lock-based isolation provided by the deployment environment.

---

## Reports and Output

The validation driver (`validation/run_integrity_validation.js`) executes the validation scenarios and produces console output plus files placed in `validation/`:

Console output (example):

```
Integrity Validation Framework

Running scenarios...
Running Original Blockchain...
PASS

Running Tampered Vote...
PASS

Validation completed.
```

Report files generated in the `validation/` directory:

- `validation_report.json` — full JSON array of scenario result objects.
- `validation_report.csv` — CSV summary with columns: Scenario,Expected,Actual,Status,DetectionMechanism,RecoveryRestored,RecoveryPostRestoreActual,RecoveryStatus.
- `validation_report.md` — human-readable Markdown report containing Objective, Executed scenarios, a results table and a short conclusion.

The Markdown and CSV include the recovery verification results for the Tampered Vote scenario.

---

## How to run (CLI)

From the repository root (ensure Node environment and DB credentials are set as for the application):

```bash
node validation/run_integrity_validation.js
```

Notes:
- The validation framework uses the same DB that the production application uses (via `config/db`). Run in an isolated database or maintenance window if you require absolute non-interference.
- The harness attempts to clean up after itself; nevertheless, it is best practice to run validation in a disposable or test schema.

---

## Interpretation of Results

- PASS for "Original Blockchain" indicates the real production workflow produced a ledger that satisfies the layered verification checks (hash linkage, Merkle root and signature verification).
- PASS for "Tampered Vote" indicates the framework successfully detected the injected tampering on the cloned ledger — i.e., the verification layers flagged the inconsistency.
- Recovery PASS indicates that restoring the original transaction data on the clone re-establishes chain validity, showing the checks are consistent and reversible under restoration on the clone.

If any scenario returns FAIL, the report includes either an `error` message or recovery diagnostics. Investigate the underlying cause by reviewing the console logs and `validation_report.json`.

---

## Reused Production Functions and Files

The validation framework exercises these production modules (no modifications made):

- services/votingService.js — the production vote submission workflow (used via votingService.castVote in Scenario 1).
- blockchain/blockchain.js — Block and Blockchain classes, including `Blockchain.create()`, `saveBlock()`, `loadBlockchain()`, and `isChainValid()`.
- blockchain/merkle.js — Merkle tree building and verification (getMerkleRoot, verifyMerkleRoot).
- blockchain/keys.js — RSA signing and verification helpers (signData, verifySignature).
- utils/auditLog.js (used by the vote workflow) — audit ledger insertion.

Summary: the validation framework reuses the real voting workflow and cryptographic primitives to produce realistic artifacts for integrity experiments.

---

## Files Added by the Validation Framework

- `validation/IntegrityValidationService.js`  — orchestration, non-destructive cloning, scenarios, cleanup.
- `validation/ValidationReportGenerator.js` — JSON/CSV/Markdown report generation.
- `validation/run_integrity_validation.js` — CLI driver (prints minimal console output and writes reports).
- `validation/validation_report.json` (generated by running the driver)
- `validation/validation_report.csv` (generated by running the driver)
- `validation/validation_report.md` (generated by running the driver)

No production source files were altered by these additions.

---

## Limitations and Future Work

- Concurrency: the cleanup strategy relies on pre-run maxima on `block_index`. If concurrent producers append blocks during validation, cleanup may be insufficient. Running validation in isolation is recommended.
- Scenario scope: only Scenarios 1 and 2 are implemented in this increment. Additional scenarios (for example, selective signature replacement, audit ledger manipulation, key compromise simulations) may be added later per research plan.
- DB dependency: the framework uses the production DB connector (`config/db`) — consider a dedicated test schema for fully isolated experiments.

---

## Compliance and Research Notes

- The validation framework is intended strictly for research experiments; it does not modify production business logic and is designed to be non-destructive under reasonable operating conditions.
- All relevant cryptographic and integrity checks used in experiments are the same implementations used by the production voting workflow, improving experimental validity.

---

## Contact and Acknowledgements

See repository AUTHORS / README for author and affiliation information. For questions regarding the validation framework or to request additional scenarios, open an issue in the project or contact the repository owner.

---

*Document generated from the repository's validation and blockchain implementation (files inspected: validation/IntegrityValidationService.js, validation/ValidationReportGenerator.js, validation/run_integrity_validation.js, blockchain/blockchain.js, blockchain/merkle.js and relevant benchmark modules for context).*