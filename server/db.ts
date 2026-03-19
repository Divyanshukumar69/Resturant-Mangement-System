import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine database path:
// 1. DB_PATH env var (set this on Railway/Render to a persistent volume path)
// 2. Falls back to local 'restaurant.db' for development
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'restaurant.db');

// Ensure the directory for the database file exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
console.log(`Using database at: ${dbPath}`);

export function initDb() {
  console.log('Initializing database...');
  // Restaurants
  try {
    db.exec(`ALTER TABLE restaurants RENAME TO restaurants_old;`);
  } catch { /* Table might not exist or already renamed */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      radius_meters INTEGER DEFAULT 100,
      is_open BOOLEAN DEFAULT 1,
      opening_hours TEXT DEFAULT '10:00 - 21:00',
      ai_prompt TEXT DEFAULT 'You are a helpful restaurant assistant. Our restaurant is located in Dumra. We are open from 10:00 AM to 09:00 PM (10:00 - 21:00). For any urgent queries, you can reach our manager at 9798263469. Be warm and hospitable.',
      ai_api_key TEXT
    );
  `);
  const columns = db.prepare("PRAGMA table_info(restaurants)").all();
  console.log('Restaurants columns:', columns);
  console.log('Restaurants table checked/created.');

  // Users (Staff)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'kitchen', 'billing')),
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied')),
      current_session_token TEXT,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Menu Categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT NOT NULL,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Menu Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      is_available BOOLEAN DEFAULT 1,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  // Orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      table_id INTEGER,
      customer_nickname TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'completed', 'paid')),
      total_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id),
      FOREIGN KEY(table_id) REFERENCES tables(id)
    );
  `);

  // Order Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      menu_item_id INTEGER,
      quantity INTEGER NOT NULL,
      price_at_time REAL NOT NULL,
      name_at_time TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
    );
  `);

  // Discounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      code TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY(restaurant_id) REFERENCES restaurants(id)
    );
  `);

  // Customers (Marketing)
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT,
      phone TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Advanced Discounts
  db.exec(`
    CREATE TABLE IF NOT EXISTS advanced_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      name TEXT,
      type TEXT,
      value REAL,
      min_order_amount REAL,
      active INTEGER DEFAULT 1
    );
  `);

  // Ratings
  db.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      order_id INTEGER,
      rating INTEGER,
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Activity Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  
  // Table Sessions (QR scanning)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      table_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_used BOOLEAN DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY(table_id) REFERENCES tables(id)
    );
  `);
  
  // Index for TTL cleanup
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);`);

  // Ensure default restaurant exists

  // Ensure default restaurant exists
  const hasRestaurant = db.prepare("SELECT count(*) as count FROM restaurants").get() as { count: number };
  if (hasRestaurant.count === 0) {
    db.prepare("INSERT INTO restaurants (name, lat, lng, radius_meters, is_open, opening_hours) VALUES ('NextGen Software', 0, 0, 100, 1, '09:00 AM - 10:00 PM')").run();
  } else {
    // Ensure name is updated if DB exists
    db.prepare("UPDATE restaurants SET name = 'NextGen Software', ai_prompt = 'You are a helpful restaurant assistant. Our restaurant is located in Dumra. We are open from 10:00 AM to 09:00 PM (10:00 - 21:00). For any urgent queries, you can reach our manager at 9798263469. Be warm and hospitable.' WHERE id = 1").run();
  }

  // Ensure default users exist
  const hasUsers = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
  if (hasUsers.count === 0) {
    const insertUser = db.prepare("INSERT INTO users (restaurant_id, username, password_hash, role) VALUES (?, ?, ?, ?)");
    
    // admin: admin
    const adminPassword = bcrypt.hashSync('admin', 10);
    insertUser.run(1, 'admin', adminPassword, 'admin');
    
    // kitchen: kitchen
    const kitchenPassword = bcrypt.hashSync('kitchen', 10);
    insertUser.run(1, 'kitchen', kitchenPassword, 'kitchen');
    
    // billing: billing
    const billingPassword = bcrypt.hashSync('billing', 10);
    insertUser.run(1, 'billing', billingPassword, 'billing');
    
    console.log('Created default users: admin, kitchen, billing');
  } else {
    // Ensure they exist even if some users are already there (UPSERT style)
    const upsertUser = db.prepare(`
      INSERT INTO users (restaurant_id, username, password_hash, role)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET 
        password_hash = excluded.password_hash,
        role = excluded.role
    `);
    
    upsertUser.run('admin', bcrypt.hashSync('admin', 10), 'admin');
    upsertUser.run('kitchen', bcrypt.hashSync('kitchen', 10), 'kitchen');
    upsertUser.run('billing', bcrypt.hashSync('billing', 10), 'billing');
    console.log('Synchronized default credentials (admin, kitchen, billing)');
  }

  // No default tables — admin will add tables via the dashboard.

  // Migrations for new features
  try {
    db.prepare("ALTER TABLE restaurants ADD COLUMN is_open BOOLEAN DEFAULT 1").run();
  } catch { /* Column likely exists */ }
  
  // Force Open for debugging/fixing user issue
  db.prepare("UPDATE restaurants SET is_open = 1 WHERE id = 1").run();

  try {
    db.prepare("ALTER TABLE restaurants ADD COLUMN opening_hours TEXT DEFAULT '09:00 AM - 10:00 PM'").run();
  } catch { /* Column likely exists */ }

  try {
    db.prepare("ALTER TABLE restaurants ADD COLUMN ai_prompt TEXT DEFAULT 'You are a helpful restaurant assistant. Our restaurant is located in Dumra. We are open from 10:00 AM to 09:00 PM (10:00 - 21:00). For any urgent queries, you can reach our manager at 9798263469. Be warm and hospitable.'").run();
  } catch { /* Column likely exists */ }

  try {
    db.prepare("ALTER TABLE restaurants ADD COLUMN ai_api_key TEXT").run();
  } catch { /* Column likely exists */ }

  try {
    db.prepare("ALTER TABLE menu_items ADD COLUMN is_special BOOLEAN DEFAULT 0").run();
  } catch { /* Column likely exists */ }

  try {
    db.prepare("ALTER TABLE menu_items ADD COLUMN image_url TEXT").run();
  } catch { /* Column likely exists */ }

  try {
    db.prepare("ALTER TABLE menu_items ADD COLUMN rating REAL DEFAULT 4.5").run();
  } catch { /* Column likely exists */ }

  // No default menu items — admin will add items via the dashboard.
  // Clear any demo data that may have been inserted by previous versions
  const hasDemoItems = db.prepare("SELECT count(*) as count FROM menu_items WHERE name = 'Pav Bhaji'").get() as { count: number };
  if (hasDemoItems.count > 0) {
    console.log('Removing legacy demo menu items and categories...');
    // Clear order items first (FK constraint), then orders, then menu data
    db.prepare("DELETE FROM order_items").run();
    db.prepare("DELETE FROM orders").run();
    db.prepare("UPDATE tables SET status = 'available'").run();
    db.prepare("DELETE FROM menu_items").run();
    db.prepare("DELETE FROM categories").run();
    console.log('Demo data cleared. Database is now fresh.');
  }
}

export default db;
