const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MemoryStore = require('express-session').MemoryStore;

const publicRoutes = require('../../routes/publicRoutes');
const authRoutes = require('../../routes/authRoutes');
const votingRoutes = require('../../routes/votingRoutes');
const blockchainRoutes = require('../../routes/blockchainRoutes');
const resultsRoutes = require('../../routes/resultsRoutes');
const adminRoutes = require('../../routes/adminRoutes');
const candidateRoutes = require('../../routes/candidateRoutes');
const explorerRoutes = require('../../routes/explorerRoutes');
const { Blockchain } = require('../../blockchain/blockchain');

function createTestApp() {
  const app = express();
  app.use(bodyParser.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: true,
    store: new MemoryStore()
  }));

  // mount routes - keep same order as server.js
  app.use(publicRoutes);
  app.use(authRoutes);
  app.use(votingRoutes);
  app.use(blockchainRoutes);
  app.use(resultsRoutes);
  app.use(adminRoutes);
  app.use(candidateRoutes);
  app.use(explorerRoutes);

  // provide in-memory chains so controllers relying on app.locals.* work
  const votingChain = new Blockchain('test_blockchain');
  const candidateChain = new Blockchain('test_candidate_chain');
  const auditChain = new Blockchain('test_audit_chain');

  votingChain.chain.push(votingChain.createGenesisBlock());
  candidateChain.chain.push(candidateChain.createGenesisBlock());
  auditChain.chain.push(auditChain.createGenesisBlock());

  // override saveBlock to avoid DB writes
  votingChain.saveBlock = () => Promise.resolve();
  candidateChain.saveBlock = () => Promise.resolve();
  auditChain.saveBlock = () => Promise.resolve();

  app.locals.votingChain = votingChain;
  app.locals.candidateChain = candidateChain;
  app.locals.auditChain = auditChain;

  return app;
}

module.exports = { createTestApp };
