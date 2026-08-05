# Testing

This document describes the automated testing setup for this research repository. It documents the actual test files and behavior present in the codebase and explains how to run and interpret the tests and coverage reports.

All information here is based on the repository contents at the time of writing — no functionality is invented.

---

## 1. Testing overview

Automated tests use Jest as the test runner and Supertest for HTTP integration tests. The repository contains API-level tests that exercise key endpoints (authentication, vote submission) using an in-memory Express application. Database access is mocked to avoid connecting to a real MySQL instance during test execution.

The test suite focuses on integration/API scenarios that are relevant to the research experiments (authentication and vote flow) while keeping tests isolated and side-effect free.

---

## 2. Testing architecture

The test architecture composes Jest, a mocked database, an in-memory Express test application, the actual route handlers and services, and assertions executed by Jest. The important pieces are:

- Jest setup (`tests/jest.setup.js`) that installs a global DB mock before other modules load.
- `__mocks__/config/db.js` — a simple mock implementation of the DB connector used as a baseline.
- Test application factory (`tests/api/appFactory.js`) that builds an Express app with in-memory session store and in-memory Blockchain instances and stubs persistence to avoid DB writes.
- API tests (`tests/api/*.test.js`) that customize the DB mock per test and use Supertest to exercise routes.

Mermaid diagram (test architecture):

```mermaid
flowchart TB
  Jest --> MockDB[Mock Database (config/db)]
  MockDB --> TestApp[Express Test App]
  TestApp --> Routes
  Routes --> Controllers
  Controllers --> Services
  Services --> BlockchainLayer[Blockchain / Merkle / Keys]
  BlockchainLayer --> Assertions[Assertions (Jest/Supertest)]
```

Brief notes:
- The real implementations of blockchain primitives (blockchain/merkle.js, blockchain/keys.js) are executed in tests — only the DB connector is mocked.
- `saveBlock` is overridden inside the test app factory to prevent DB writes while still exercising block creation logic in memory.

---

## 3. Test categories (what actually exists)

After inspecting the repository, the following test categories are implemented:

- API tests (present): These are Supertest-based tests that run against an in-memory Express application. Files: `tests/api/auth.test.js`, `tests/api/vote.test.js`.
- Integration-style tests (present): The API tests function as integration tests that exercise controllers and services together on a test app (`tests/api/appFactory.js`).
- Unit tests (none present as separate category): There are no dedicated low-level unit test files in `tests/unit/` or similar in the repository at this time.

In short: `tests/api` and integration-style tests exist; dedicated `tests/unit` and `tests/integration` directories do not exist in this repository.

---

## 4. Test directory structure

```
tests/
├─ jest.setup.js            # Jest setup that installs DB mock globally
├─ api/
│  ├─ appFactory.js        # constructs an Express app for tests (in-memory chains, stubbed saveBlock)
│  ├─ auth.test.js         # API tests for authentication endpoints
│  └─ vote.test.js         # API tests for vote submission

__mocks__/
└─ config/
   └─ db.js                # simple default DB mock used by tests
```

Each test file is intentionally small and focused on verifying high-level API and workflow behavior relevant to research experiments.

---

## 5. Technologies used

- Jest — test runner and assertion framework (configured in `package.json`).
- Supertest — HTTP client for testing Express endpoints.
- Built-in Jest mocking and a repository-provided DB mock (`__mocks__/config/db.js`).

No external DB sandboxing framework is required because tests replace the DB connector with mocks.

---

## 6. Running the tests

From repository root:

- Run the test suite:

```bash
npm test
```

- Run tests with coverage collection:

```bash
npm run test:coverage
```

Notes:
- `npm test` runs `jest --runInBand` (sequential execution).
- `npm run test:coverage` runs `jest --coverage --runInBand` and generates coverage artifacts (see next section).
- Ensure dependencies are installed (`npm install`) before running tests.

---

## 7. Coverage report

When run with `npm run test:coverage`, Jest produces coverage artifacts in the project root under the `coverage/` directory. Typical outputs produced by Jest include:

- `coverage/` — root directory for generated coverage output
- `coverage/lcov-report/` — HTML report files (open `index.html` to view detailed HTML coverage report)
- `coverage/lcov.info` — LCOV format coverage data suitable for CI systems and coverage tools

The `package.json` Jest configuration includes `collectCoverageFrom` patterns that instruct Jest which source files to include in coverage collection; these patterns include `blockchain/**/*.js`, `services/votingService.js`, `services/auditLogService.js`, `blockchain/merkle.js`, `blockchain/keys.js`, and `utils/*.js`.

Do not assume numerical coverage percentages. Run `npm run test:coverage` locally to produce the coverage report for your environment.

---

## 8. Testing workflow (lifecycle of a single test case)

1. Jest starts and runs `tests/jest.setup.js` (configured via `setupFilesAfterEnv`). This script installs a mock for the DB connector (`config/db`) so modules that require it do not create real connections.
2. Jest loads a test file (e.g., `tests/api/auth.test.js`). The test file may further call `jest.mock('../../config/db')` to ensure the mock is active in that module context.
3. `beforeEach` hooks in the test configure `db.query` behavior to return data tailored for the scenario (e.g., a bcrypt hashed password row for login tests).
4. The test constructs an in-memory Express application by calling `createTestApp()` from `tests/api/appFactory.js`. This app mounts the same routes as `server.js` and provides `app.locals.*` blockchain instances. In the factory:
   - `Blockchain` instances are created in memory.
   - `saveBlock` is overridden to a no-op to prevent DB writes while allowing block creation logic to execute in memory.
5. The test uses Supertest to send HTTP requests to the in-memory app (for example, `request(app).post('/login')`).
6. The request flows through routes → controllers → services. Services interact with the mocked `config/db` as defined by the test; blockchain/merkle/keys modules execute their real logic in memory.
7. Controller responses are returned; the test makes assertions (status codes, response JSON, etc.).
8. `afterEach` (if present) restores mocks or clears any module-level state.

This lifecycle ensures each test runs with predictable DB responses while exercising production code paths for controllers, services and cryptographic primitives.

---

## 9. Mocking strategy

What is mocked

- `config/db` (the MySQL connector) is mocked globally via `tests/jest.setup.js` using `jest.mock('../config/db', ...)`. The provided mock implements `query`, `execute`, `connect`, and `end` methods. By default these methods call the supplied callback with empty results.
- Individual test files override `db.query` as needed to return scenario-specific rows (e.g., returning a user row containing a bcrypt password hash for authentication tests).

What is not mocked (executed as real code)

- Blockchain primitives (`blockchain/blockchain.js`, `blockchain/merkle.js`) are executed as real implementations in tests. This ensures Merkle and block hashing code is exercised.
- Cryptographic helpers (`blockchain/keys.js` — key generation, signData, verifySignature) are executed as real code when needed by services and controllers.
- Controllers and services are run without modification in tests to preserve real workflow logic.

Test-specific stubbing

- `tests/api/appFactory.js` overrides `saveBlock` on in-memory `Blockchain` instances to `() => Promise.resolve()` so that block persistence does not attempt DB writes. This is a test harness stub rather than a module-level mock.

Rationale

- Mocking the DB connector prevents external side effects and ensures tests are deterministic and fast.
- Executing blockchain and crypto code unchanged provides higher confidence that core integrity primitives are exercised by tests.

---

## 10. Test isolation (why DB is mocked but Blockchain / Merkle / RSA remain real)

- Database mocking avoids network I/O, credentials leakage, and accidental modification of developer or production databases. It also makes tests faster and deterministic because DB responses are scripted in test code.
- Keeping the Blockchain, Merkle Tree, and RSA implementations as real code in tests ensures cryptographic and integrity logic is exercised end-to-end in-memory. This is important for research validation because it verifies the actual primitives used in experiments rather than mocked substitutes.
- `saveBlock` is stubbed in the test harness to avoid persistence while preserving block construction and Merkle/hashing operations.

---

## 11. Current test files (summary)

- `tests/jest.setup.js` — global Jest setup that ensures a DB mock is present.
- `__mocks__/config/db.js` — repository-provided DB mock fallback.
- `tests/api/appFactory.js` — in-memory Express app factory; constructs in-memory Blockchain instances and stubs persistence.
- `tests/api/auth.test.js` — Supertest API tests for `/login` (success and error cases).
- `tests/api/vote.test.js` — Supertest API tests for `/vote` (success and duplicate vote rejection).

---

## 12. Limitations

- Tests do not include an exhaustive unit test suite for low-level blockchain primitives (Merkle tree, block hashing) — they are exercised indirectly via integration tests.
- The DB mock is simplistic; it is adequate for current tests but does not emulate full DB semantics or concurrency.
- No tests run against a real DB in this repository; if end-to-end DB integration is required, create a separate test environment.

---

## 13. Future improvements

- Add unit tests that directly target `blockchain/merkle.js`, `blockchain/blockchain.js` and `blockchain/keys.js` to increase confidence in the cryptographic primitives.
- Add end-to-end tests that run against an isolated test database (e.g., via Docker) and perform cleanup after execution.
- Add negative tests that simulate DB errors and ensure services handle failures gracefully.

---

If you want, I can run the test suite in this environment and report the output (requires dependencies installed). Otherwise, please review this documentation and tell me if any additional detail is needed.

## Test framework

- Jest is used for unit and integration tests. Configuration is set in `package.json` under the `jest` section.

## Running tests

- Run all tests:
```bash
npm test
```

- Run coverage collection:
```bash
npm run test:coverage
```

The project is configured to collect coverage from the following areas:
- `blockchain/**/*.js` (block, merkle, keys)
- `services/votingService.js`
- `services/auditLogService.js`
- `blockchain/merkle.js`
- `blockchain/keys.js`
- `utils/*.js`

Coverage thresholds are configured in `package.json` (see `jest.coverageThreshold`). Do not assume exact coverage numbers without running the suite locally.

## Tests location

- `tests/` contains test helpers and unit tests used by the project.

## Notes

- Tests may require a test database. See `tests/api/appFactory.js` for how tests initialize a server instance and database connections.
- When running tests that touch the database, ensure a test database is used to avoid contaminating real data.

For details on individual test files and expectations, open the `tests/` folder and the Jest config in `package.json`.