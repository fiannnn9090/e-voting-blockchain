// Ensure config/db is mocked before any module loads to avoid real MySQL connections during tests
jest.mock('../config/db', () => {
  const { EventEmitter } = require('events');
  const db = new EventEmitter();
  db.query = jest.fn((sql, params, cb) => {
    if (typeof params === 'function') {
      cb = params;
    }
    if (typeof cb === 'function') {
      cb(null, []);
    }
  });
  db.execute = jest.fn((sql, params, cb) => {
    if (typeof params === 'function') {
      cb = params;
    }
    if (typeof cb === 'function') {
      cb(null, []);
    }
  });
  db.connect = jest.fn((cb) => {
    if (typeof cb === 'function') {
      cb(null);
    }
  });
  db.end = jest.fn((cb) => {
    if (typeof cb === 'function') {
      cb(null);
    }
  });
  return db;
});
