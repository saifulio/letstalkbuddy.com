// Creates the database, tables, and loads sample data.
// Usage: npm run db:setup
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { seedCategories } = require('./taxonomy');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');

  console.log('Applying schema...');
  await conn.query(schema);
  console.log('Seeding categories (hierarchical taxonomy)...');
  await conn.query('USE letstalkbuddy');
  await seedCategories(conn);
  console.log('Loading sample data...');
  await conn.query(seed);

  const [[{ n: advisors }]] = await conn.query('SELECT COUNT(*) AS n FROM letstalkbuddy.advisors');
  const [[{ n: cats }]] = await conn.query('SELECT COUNT(*) AS n FROM letstalkbuddy.categories');
  console.log(`Done. ${cats} categories, ${advisors} advisors.`);
  console.log('Demo login: demo@letstalkbuddy.com / password123');
  await conn.end();
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
