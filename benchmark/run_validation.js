const { resetBenchmarkDatabase, validate } = require('./BenchmarkDatabaseInitializer');

(async () => {
  const dbName = process.env.BENCHMARK_DB_NAME || 'evoting_benchmark';
  console.log('Preparing benchmark DB:', dbName);
  const res = await resetBenchmarkDatabase({ dbName });
  if (!res.ok) {
    console.error('Failed to reset benchmark DB:', res.error);
    process.exit(1);
  }
  const report = await validate({ dbName });
  console.log('DB reset complete. Running validation...');
  console.log('Validation report:');
  console.log(JSON.stringify(report, null, 2));
})();
