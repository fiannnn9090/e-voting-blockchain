const fs = require('fs');
const { generateKeyPair } = require('../blockchain/keys');
const { measureRsaSignTime } = require('./RsaBenchmarkService');

function buildPayloadWithSize(basePayload, targetBytes) {
  let json = JSON.stringify(basePayload);
  let curBytes = Buffer.byteLength(json, 'utf8');
  if (curBytes >= targetBytes) return basePayload;
  const padSize = targetBytes - curBytes;
  // create a padding string of padSize bytes (use 'a')
  const padding = 'a'.repeat(padSize - 10 > 0 ? padSize - 10 : padSize);
  // embed padding in a field
  const payload = Object.assign({}, basePayload, { padding });
  // ensure final size
  let finalJson = JSON.stringify(payload);
  let finalBytes = Buffer.byteLength(finalJson, 'utf8');
  if (finalBytes < targetBytes) {
    // append extra deterministic filler
    const extra = 'b'.repeat(targetBytes - finalBytes);
    payload.padding += extra;
  }
  return payload;
}

(async () => {
  console.log('Running benchmark: ' + 'benchmark/run_rsa_benchmark.js');
  // Fixed reproducible base payload per your request
  const basePayload = { user_id: 1, candidate_id: 1, timestamp: '2026-01-01T00:00:00Z' };

  // Payload sizes to test (bytes)
  const sizes = [128, 256, 512, 1024];

  // Use a fixed keypair for the whole experiment (key generation excluded from timing)
  const kp = generateKeyPair();
  const privateKey = kp.privateKey;

  const runs = 50; // default runs for research-quality data, adjust as needed
  const warmup = 5; // warm-up runs

  for (const size of sizes) {
    const payload = buildPayloadWithSize(basePayload, size);
    const actualSize = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    const res = await measureRsaSignTime(privateKey, payload, { runs, warmup });


    // Create CSV as required (no signature column)
    const header = 'Run,Execution Time (ms),Average,Minimum,Maximum,Median';
    const stats = res.stats || res;
    const rows = res.results.map((r, idx) => `${idx + 1},${r.executionTimeMs},${stats.average},${stats.min},${stats.max},${stats.median}`);
    const csv = [header, ...rows].join('\n');

    const outPath = `benchmark/rsa_sign_payload_${size}b.csv`;
    fs.writeFileSync(outPath);
    console.log('CSV written to ' + (outPath));
  }

})();