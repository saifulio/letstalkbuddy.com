// FULL RESET of the sample database: drops it, re-creates it by running the
// whole migration sequence, then loads the sample data from db/seed.sql.
// For a non-destructive upgrade just start the server (migrations run
// automatically) or run: npm run db:migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { runMigrations } = require('../migrate');

const DB_NAME = process.env.DB_NAME || 'letstalkbuddy';

async function main() {
  const boot = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  console.log(`Dropping database ${DB_NAME}...`);
  await boot.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
  await boot.end();

  console.log('Running migrations...');
  await runMigrations();

  console.log('Loading sample data...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    multipleStatements: true,
  });
  await conn.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8'));

  const [[{ n: advisors }]] = await conn.query('SELECT COUNT(*) AS n FROM advisors');
  const [[{ n: cats }]] = await conn.query('SELECT COUNT(*) AS n FROM categories');
  console.log(`Done. ${cats} categories, ${advisors} advisors.`);
  console.log('Demo login: demo@letstalkbuddy.com / password123');
  await conn.end();
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
