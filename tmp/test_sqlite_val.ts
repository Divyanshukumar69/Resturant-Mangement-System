
import Database from 'better-sqlite3';

const db = new Database(':memory:');

try {
  const iso = new Date().toISOString();
  console.log('ISO String:', iso);
  
  const result = db.prepare("SELECT datetime(?) as dt").get(iso);
  console.log('SQLite datetime result:', result.dt);
  
  if (result.dt === null) {
    console.error('FAILED: SQLite does not like ISO strings with milliseconds/T/Z');
  } else {
    console.log('SUCCESS: SQLite handles it.');
  }
} catch (err) {
  console.error(err);
} finally {
  db.close();
}
