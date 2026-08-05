/*
  Worker process that loads application modules using the DB configured
  by process.env.DB_DATABASE and exposes a simple IPC interface:

  messages handled:
    { type: 'init' } -> initialize blockchains, send { type: 'ready' }
    { type: 'run', payload: { req } } -> perform one castVote measured inside worker,
        reply { type: 'result', payload: { executionTimeMs, result } }
    { type: 'shutdown' } -> exit
*/

process.on('uncaughtException', (err) => {
  console.error('Worker uncaughtException:', err && err.stack);
  process.exit(1);
});

const votingService = require('../services/votingService');
const { Blockchain } = require('../blockchain/blockchain');

let votingChain = null;
let auditChain = null;

async function initChains() {
  const chains = await Promise.all([
    Blockchain.create(),
    Blockchain.create('candidate_ledger_blocks'),
    Blockchain.create('audit_ledger_blocks')
  ]);
  votingChain = chains[0];
  auditChain = chains[2];
}

process.on('message', async (msg) => {
  try {
    if (!msg || !msg.type) return;
    if (msg.type === 'init') {
      await initChains();
      process.send({ type: 'ready' });
      return;
    }

    if (msg.type === 'run') {
      const { req } = msg.payload || {};
      const start = process.hrtime.bigint();
      const result = await votingService.castVote(req, votingChain, auditChain);
      const end = process.hrtime.bigint();
      const executionTimeMs = Number(end - start) / 1e6;
      process.send({ type: 'result', payload: { executionTimeMs: Number(executionTimeMs.toFixed(3)), result } });
      return;
    }

    if (msg.type === 'shutdown') {
      process.send({ type: 'bye' });
      process.exit(0);
    }
  } catch (e) {
    process.send({ type: 'error', payload: { message: e && e.message } });
  }
});

// allow parent to start initialization explicitly
process.send({ type: 'worker-started' });
