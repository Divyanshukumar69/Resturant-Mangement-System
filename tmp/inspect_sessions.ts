
import Database from 'better-sqlite3';

const db = new Database('C:/Users/divya/Downloads/NGSV6/restaurant.db');

try {
  const sessions = db.prepare(`
    SELECT *, datetime(expires_at) as exp_fmt, datetime('now') as now_fmt FROM sessions
  `).all();
  console.log('--- SESSIONS ---');
  console.log(JSON.stringify(sessions, null, 2));

} catch (err) {
  console.error(err);
} finally {
  db.close();
}
