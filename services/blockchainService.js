/**
 * Service tipis untuk operasi terhadap instance votingChain.
 * votingChain diteruskan dari luar karena instance-nya dibuat sekali saat startup server.
 */

function getChain(votingChain) {
  return votingChain.chain;
}

function validateChain(votingChain) {
  return votingChain.isChainValid();
}

function hackBlock(votingChain) {
  votingChain.hackBlock(1, { voter: 999, candidate: 999 });
}

// Dipindah dari server.js (POST /admin/reset-all) apa adanya.
async function resetChain(votingChain) {
  await votingChain.resetChain();
}

module.exports = { getChain, validateChain, hackBlock, resetChain };