const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "evoting",
  port: 3306
});

db.connect((err) => {
  if (err) {
    console.log("Database gagal connect", err);
  } else {
    console.log("Database connected");
  }
});

module.exports = db;