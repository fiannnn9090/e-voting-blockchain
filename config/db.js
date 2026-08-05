const mysql = require("mysql2");

const connectionConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "evoting",
  port: Number(process.env.DB_PORT || 3306)
};

// Export helper to create ad-hoc connections (used by benchmark initializer)
function createAdhocConnection(override = {}) {
  const cfg = Object.assign({}, connectionConfig, override);
  return mysql.createConnection(cfg);
}

module.exports.createAdhocConnection = createAdhocConnection;

let dbConnection = null;

function initDbConnection() {
  if (dbConnection) return dbConnection;

  dbConnection = mysql.createConnection(connectionConfig);
  dbConnection.connect((err) => {
    if (err) {
    } else {
    }
  });

  return dbConnection;
}

const db = new Proxy({}, {
  get(target, prop) {
    const connection = initDbConnection();
    const value = connection[prop];
    return typeof value === "function" ? value.bind(connection) : value;
  },
  set(target, prop, value) {
    const connection = initDbConnection();
    connection[prop] = value;
    return true;
  },
  has(target, prop) {
    return prop in initDbConnection();
  },
  ownKeys() {
    return Reflect.ownKeys(initDbConnection());
  },
  getOwnPropertyDescriptor(target, prop) {
    return Object.getOwnPropertyDescriptor(initDbConnection(), prop);
  }
});

module.exports = db;
// attach helper to same export so callers can create ad-hoc connections
module.exports.createAdhocConnection = createAdhocConnection;