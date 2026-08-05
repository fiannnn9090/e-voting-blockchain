const { EventEmitter } = require('events');

// Simple mock for mysql2 connection used in tests. Tests override query as needed.
const db = new EventEmitter();

db.query = (sql, params, cb) => {
  // default: invoke callback with empty rows
  if (typeof params === 'function') {
    cb = params;
  }
  if (cb) cb(null, []);
};

db.connect = () => {};

module.exports = db;
