# Blockchain-based E-Voting System

# Setup Guide

This document explains how to install, configure, and run the Blockchain-based E-Voting System on a local machine.

> **Note**
>
> This document only explains the setup process. For project overview, architecture, features, benchmarks, and integrity validation, please refer to `README.md` and `BENCHMARK.md`.

---

# 1. System Requirements

Before running the project, make sure the following software is installed.

| Software | Version |
|----------|----------|
| Node.js | 18.x or newer |
| npm | Latest |
| MySQL | 8.x or newer |
| Git | Latest |
| Web Browser | Chrome, Edge, Firefox |

Recommended tools:

- Visual Studio Code
- MySQL Workbench
- Postman (for API testing)

---

# 2. Clone Repository

Clone the repository from GitHub.

```bash
git clone https://github.com/fiannnn9090/e-voting-blockchain.git
```

Move into the project directory.

```bash
cd e-voting-blockchain
```

---

# 3. Install Dependencies

Install all required Node.js packages.

```bash
npm install
```

This command automatically installs every dependency listed in `package.json`.

---

# 4. Configure Database

Create a MySQL database.

Example:

```sql
CREATE DATABASE e_voting;
```

After creating the database, import the SQL schema.

If SQL files are provided, execute them using MySQL.

Example:

```bash
mysql -u root -p e_voting < database/schema.sql
```

If seed data is available, import it after the schema.

```bash
mysql -u root -p e_voting < database/seed.sql
```

---

# 5. Configure Database Connection

Update the database configuration according to your local environment.

The configuration is located inside the project configuration folder.

Example configuration:

```
Host     : localhost
Port     : 3306
Database : e_voting
Username : root
Password : your_password
```

Ensure the MySQL server is running before starting the application.

---

# 6. Start the Application

Run the server.

```bash
node server.js
```

or

```bash
npm start
```

If the application starts successfully, the terminal should display messages similar to:

```
Database connected
Server running on port 3000
```

---

# 7. Access the Application

Open a web browser and access the application.

Example:

```
http://localhost:3000
```

If an administrator dashboard is available, access:

```
http://localhost:3000/admin
```

---

# 8. Project Structure

```
project-root
│
├── blockchain/
├── config/
├── controllers/
├── middleware/
├── routes/
├── services/
├── utils/
├── benchmark/
├── validation/
├── public/
├── views/
├── database/
├── README.md
├── README_SETUP.md
├── BENCHMARK.md
└── server.js
```

### Folder Description

| Folder | Description |
|----------|-------------|
| blockchain | Blockchain implementation, Merkle Tree, Digital Signature, Audit Ledger |
| controllers | Request handlers |
| services | Business logic |
| routes | Application routing |
| middleware | Authentication and authorization middleware |
| config | Database and application configuration |
| utils | Helper utilities |
| public | Static assets |
| views | Web interface |
| benchmark | Performance benchmarking modules |
| validation | Integrity validation modules |

---

# 9. Running Performance Benchmarks

The repository includes benchmark modules for evaluating the blockchain components.

Run:

```bash
node benchmark/run_all_benchmarks.js
```

After completion, the following files are generated automatically.

```
benchmark_summary.csv

benchmark_summary.json

benchmark_summary.md
```

These files contain benchmark statistics used in the research experiments.

---

# 10. Running Integrity Validation

The repository also provides integrity validation experiments.

Execute:

```bash
node validation/run_integrity_validation.js
```

Generated reports include:

```
validation_report.csv

validation_report.json

validation_report.md
```

These reports summarize the integrity validation scenarios and tamper detection results.

---

# 11. Updating the Project

To update the repository:

```bash
git pull
```

Install new dependencies if required.

```bash
npm install
```

Restart the application afterward.

---

# 12. Troubleshooting

## Database connection failed

Verify:

- MySQL service is running.
- Database name is correct.
- Username and password are correct.
- Host and port are correct.

---

## Module not found

Reinstall dependencies.

```bash
npm install
```

---

## Port already in use

Stop the process currently using the port or change the application port.

---

## Permission denied

Check file permissions or run the command with appropriate privileges.

---

## Benchmark does not finish

If the benchmark appears to hang:

- Ensure the database connection is available.
- Wait until the benchmark summary files are generated.
- Successful completion returns control to the terminal without requiring `Ctrl + C`.

---

# 13. Security Recommendations

Do **not** commit the following files to the public repository:

- `.env`
- Database backups
- Benchmark result files
- Validation report files
- `node_modules`

These files are environment-specific or automatically generated.

---

# 14. Documentation

Additional documentation included in this repository:

- `README.md` — Project overview
- `README_SETUP.md` — Installation and setup guide
- `BENCHMARK.md` — Benchmark methodology and execution

---

# 15. License

This project was developed for academic research and educational purposes.

If this repository is reused or modified, please provide appropriate attribution to the original authors.

---

# 16. Support

If you encounter problems during installation or execution, please verify:

- Node.js version
- MySQL configuration
- Installed dependencies
- Database schema
- Repository version

Most issues can be resolved by checking the configuration and reinstalling project dependencies.

---

**End of Setup Guide**