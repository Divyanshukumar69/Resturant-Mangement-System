
import Database from 'better-sqlite3';

const db = new Database('C:/Users/divya/Downloads/NGSV6/restaurant.db');

try {
  const tables = db.prepare('SELECT id, name FROM tables').all();
  console.log('--- TABLES ---');
  console.log(JSON.stringify(tables, null, 2));

  const sessions = db.prepare('SELECT count(*) as count FROM sessions').get();
  console.log('--- SESSIONS COUNT ---');
  console.log(JSON.stringify(sessions, null, 2));
} catch (err) {
  console.error(err);
} finally {
  db.close();
}
