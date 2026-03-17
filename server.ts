import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb } from './server/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from "dotenv";
dotenv.config();


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Warn if running in production with a default secret
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'super-secret-key-change-in-prod') {
  console.warn('⚠️  WARNING: JWT_SECRET is using the default value. Set a strong secret in production!');
}

interface AuthenticatedUser {
  id: number;
  role: string;
  restaurant_id: number;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

interface User {
  id: number;
  restaurant_id: number;
  username: string;
  password_hash: string;
  role: string;
}

interface Table {
  id: number;
  restaurant_id: number;
  name: string;
  status: string;
  current_session_token?: string;
  restaurant_name?: string;
  lat?: number;
  lng?: number;
  radius_meters?: number;
  is_open?: number;
  opening_hours?: string;
}

interface Category {
  id: number;
  restaurant_id: number;
  name: string;
}

interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  price: number;
  description: string;
  is_available: number;
  is_special: number;
  image_url?: string;
  rating?: number;
  category_name?: string;
}

interface Order {
  id: number;
  restaurant_id: number;
  table_id: number;
  customer_nickname: string;
  status: string;
  total_amount: number;
  created_at: string;
  items?: OrderItem[];
  table_name?: string;
}

interface OrderRequestItem {
  id: number;
  quantity: number;
  price: number;
  name: string;
}

interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  quantity: number;
  price_at_time: number;
  name_at_time: string;
}

interface Discount {
  id: number;
  restaurant_id: number;
  code: string;
  percentage: number;
  is_active: number;
}

async function startServer() {
  console.log('Starting server...');
  initDb();
  console.log('Database initialized.');

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: '/socket.io/',
    pingInterval: 25000,
    pingTimeout: 20000,
    connectTimeout: 45000,
    transports: ['websocket', 'polling'],
  });

  app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
  app.use(express.json());

  // --- API Routes ---

  // Login
  app.post('/api/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, restaurant_id: user.restaurant_id }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, role: user.role, restaurant_id: user.restaurant_id });
  });

  // Public: Add Customer from Landing Page
  app.post('/api/public/customers', (req: Request, res: Response) => {
    const { restaurantId, name, phone, source } = req.body;
    try {
      db.prepare('INSERT INTO customers (restaurant_id, name, phone, source) VALUES (?, ?, ?, ?)').run(restaurantId, name, phone, source);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Public: Get all active discounts for a restaurant
  app.get('/api/public/discounts/:restaurantId', (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    try {
      const discounts = db.prepare('SELECT * FROM discounts WHERE restaurant_id = ? AND is_active = 1 ORDER BY percentage DESC').all(restaurantId);
      res.json(discounts);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Public: Add Rating
  app.post('/api/public/ratings', (req: Request, res: Response) => {
    const { restaurantId, orderId, rating, feedback } = req.body;
    try {
      db.prepare('INSERT INTO ratings (restaurant_id, order_id, rating, feedback) VALUES (?, ?, ?, ?)').run(restaurantId, orderId, rating, feedback);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Get Tables
  app.get('/api/admin/tables', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const tables = db.prepare('SELECT * FROM tables WHERE restaurant_id = ? ORDER BY name ASC').all(req.user.restaurant_id) as Table[];
    res.json(tables);
  });

  // Admin: Add Table
  app.post('/api/admin/tables', (req: Request, res: Response) => {
    const { restaurantId, name } = req.body;
    try {
      db.prepare('INSERT INTO tables (restaurant_id, name, status) VALUES (?, ?, ?)').run(restaurantId, name, 'available');
      const room = `restaurant_${restaurantId}`;
      io.to(room).emit('table:updated');
      console.log(`[Socket.IO] Emitted table:updated to room: ${room}`);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Rename Table
  app.put('/api/admin/tables/:tableId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { tableId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    try {
      db.prepare('UPDATE tables SET name = ? WHERE id = ? AND restaurant_id = ?').run(name.trim(), tableId, req.user.restaurant_id);
      io.to(`restaurant_${req.user.restaurant_id}`).emit('table:updated');
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Delete Table
  app.delete('/api/admin/tables/:tableId', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { tableId } = req.params;
    try {
      const orders = db.prepare('SELECT id FROM orders WHERE table_id = ?').all(tableId) as { id: number }[];
      orders.forEach(o => db.prepare('DELETE FROM order_items WHERE order_id = ?').run(o.id));
      db.prepare('DELETE FROM orders WHERE table_id = ?').run(tableId);
      db.prepare('DELETE FROM tables WHERE id = ? AND restaurant_id = ?').run(tableId, req.user.restaurant_id);
      io.to(`restaurant_${req.user.restaurant_id}`).emit('table:updated');
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Public: Get Restaurant & Table Info
  app.get('/api/public/table/:tableId', (req: Request, res: Response) => {
    const { tableId } = req.params;
    const table = db.prepare('SELECT t.*, r.name as restaurant_name, r.lat, r.lng, r.radius_meters, r.is_open, r.opening_hours, r.ai_prompt FROM tables t JOIN restaurants r ON t.restaurant_id = r.id WHERE t.id = ?').get(tableId) as Table | undefined;

    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  });

  // Public: Get Menu
  app.get('/api/public/menu/:restaurantId', (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const categories = db.prepare('SELECT * FROM categories WHERE restaurant_id = ?').all(restaurantId) as Category[];

    const menu = categories.map(cat => {
      const items = db.prepare('SELECT * FROM menu_items WHERE category_id = ? AND is_available = 1').all(cat.id) as MenuItem[];
      return { ...cat, items };
    }).filter(cat => cat.items.length > 0);

    res.json(menu);
  });

  // Public: Create Order
  app.post('/api/public/order', (req: Request, res: Response) => {
    try {
      const { restaurantId, tableId, customerNickname, items } = req.body; // items: [{ id, quantity, price, name }]

      if (!restaurantId || !tableId || !items || items.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const totalAmount = items.reduce((sum: number, item: OrderRequestItem) => sum + (item.price * item.quantity), 0);

      // Use transaction for atomicity
      const createOrder = db.transaction(() => {
        const insertOrder = db.prepare('INSERT INTO orders (restaurant_id, table_id, customer_nickname, total_amount, status) VALUES (?, ?, ?, ?, ?)');
        const info = insertOrder.run(restaurantId, tableId, customerNickname, totalAmount, 'pending');
        const orderId = info.lastInsertRowid;

        const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time, name_at_time) VALUES (?, ?, ?, ?, ?)');
        items.forEach((item: OrderRequestItem) => {
          insertItem.run(orderId, item.id, item.quantity, item.price, item.name);
        });

        // Update table status
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId);

        return orderId;
      });

      const orderId = createOrder();

      // Fetch full order for socket
      const fullOrder = getOrderById(orderId);
      const room = `restaurant_${restaurantId}`;
      console.log(`[Socket] Emitting new_order to restaurant_${restaurantId}`);
      io.to(room).emit('new_order', fullOrder);

      res.json({ success: true, orderId });
    } catch (err: unknown) {
      console.error('Order creation failed:', err);
      res.status(500).json({ error: (err as Error).message || 'Failed to create order' });
    }
  });

  // Staff: Get Orders
  app.get('/api/staff/orders', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.sendStatus(403);
    const orders = db.prepare(`
      SELECT o.*, t.name as table_name 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.restaurant_id = ? 
      AND (o.status != 'paid' OR date(o.created_at, 'localtime') = date('now', 'localtime'))
      ORDER BY o.created_at DESC
    `).all(req.user.restaurant_id) as Order[];

    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as OrderItem[];
      return { ...order, items };
    });

    res.json(ordersWithItems);
  });

  // Staff: Update Order Status
  app.post('/api/staff/order/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.sendStatus(403);
    const { orderId, status } = req.body;
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);

    const updatedOrder = getOrderById(orderId);
    const room = `restaurant_${req.user.restaurant_id}`;
    console.log(`[Socket] Emitting order_updated to room: ${room}, Order ID: ${orderId}, Status: ${status}`);
    io.to(room).emit('order_updated', updatedOrder);

    res.json({ success: true });
  });

  // Staff: Validate Discount Code
  app.post('/api/staff/discount/validate', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.sendStatus(403);
    const { code } = req.body;
    
    try {
      const discount = db.prepare('SELECT * FROM discounts WHERE code = ? AND restaurant_id = ? AND is_active = 1').get(code, req.user.restaurant_id) as Discount | undefined;
      
      if (discount) {
        res.json({ valid: true, percentage: discount.percentage });
      } else {
        res.json({ valid: false, error: 'Invalid or expired coupon code' });
      }
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Staff: Close Table Session (Mark Paid)
  app.post('/api/staff/order/pay', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.sendStatus(403);
    const { orderId, finalAmount } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined;

    if (order) {
      // If a discount was applied, we might want to store it in the order record
      // For now, let's just update the total_amount if finalAmount is provided
      if (finalAmount !== undefined) {
        db.prepare("UPDATE orders SET status = 'paid', total_amount = ? WHERE id = ?").run(finalAmount, orderId);
      } else {
        db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
      }
      
      db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(order.table_id);

      const room = `restaurant_${req.user.restaurant_id}`;
      const updatedOrder = getOrderById(orderId);
      
      console.log(`[Socket] Emitting order_paid & order_updated for order ${orderId}`);
      // Emit to room for dashboards
      io.to(room).emit('order_paid', { orderId, tableId: order.table_id });
      // Also emit full update for customer tracking
      io.to(room).emit('order_updated', updatedOrder);
    }

    res.json({ success: true });
  });

  // Staff: Get Tables
  app.get('/api/staff/tables', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.sendStatus(403);
    const tables = db.prepare('SELECT * FROM tables WHERE restaurant_id = ?').all(req.user.restaurant_id) as Table[];
    res.json(tables);
  });

  // Admin: Get Categories
  app.get('/api/admin/categories', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const categories = db.prepare('SELECT * FROM categories WHERE restaurant_id = ?').all(req.user.restaurant_id);
    res.json(categories);
  });

  // Admin: Create/Update Menu Item
  app.post('/api/admin/menu/item', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { id, name, price, description, category_name, image_url } = req.body;

    try {
      // Find or Create Category
      let category = db.prepare('SELECT * FROM categories WHERE restaurant_id = ? AND name = ?').get(req.user.restaurant_id, category_name) as Category | undefined;

      if (!category) {
        const info = db.prepare('INSERT INTO categories (restaurant_id, name) VALUES (?, ?)').run(req.user.restaurant_id, category_name);
        category = { id: Number(info.lastInsertRowid), restaurant_id: req.user.restaurant_id, name: category_name };
      }

      if (id) {
        // Update
        db.prepare(`
          UPDATE menu_items 
          SET name = ?, price = ?, description = ?, category_id = ?, image_url = ?
          WHERE id = ?
        `).run(name, price, description, category.id, image_url, id);
      } else {
        // Create
        db.prepare(`
          INSERT INTO menu_items (category_id, name, price, description, is_available, is_special, image_url)
          VALUES (?, ?, ?, ?, 1, 0, ?)
        `).run(category.id, name, price, description, image_url);
      }

      io.to(`restaurant_${req.user.restaurant_id}`).emit('menu:updated');
      res.json({ success: true });
    } catch (err: unknown) {
      console.error('Failed to save menu item:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Delete Menu Item
  app.delete('/api/admin/menu/item/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
      io.to(`restaurant_${req.user.restaurant_id}`).emit('menu:updated');
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Get Menu Items
  app.get('/api/admin/menu', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);

    const itemsCorrect = db.prepare(`
      SELECT m.*, c.name as category_name 
      FROM menu_items m 
      JOIN categories c ON m.category_id = c.id 
      WHERE c.restaurant_id = ?
    `).all(req.user.restaurant_id) as MenuItem[];
    res.json(itemsCorrect);
  });

  // Admin: Toggle Availability
  app.post('/api/admin/menu/toggle', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { itemId, isAvailable } = req.body;
    db.prepare('UPDATE menu_items SET is_available = ? WHERE id = ?').run(isAvailable ? 1 : 0, itemId);
    io.to(`restaurant_${req.user.restaurant_id}`).emit('menu:updated');
    res.json({ success: true });
  });

  // Admin: Update Menu Item Special Status
  app.post('/api/admin/menu/special', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { itemId, isSpecial } = req.body;
    db.prepare('UPDATE menu_items SET is_special = ? WHERE id = ?').run(isSpecial ? 1 : 0, itemId);
    io.to(`restaurant_${req.user.restaurant_id}`).emit('menu:updated');
    res.json({ success: true });
  });

  // Admin: Get Discounts
  app.get('/api/admin/discounts', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const discounts = db.prepare('SELECT * FROM discounts WHERE restaurant_id = ?').all(req.user.restaurant_id) as Discount[];
    res.json(discounts);
  });

  // Admin: Create Discount
  app.post('/api/admin/discount', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { code, percentage } = req.body;

    try {
      const insert = db.prepare('INSERT INTO discounts (restaurant_id, code, percentage) VALUES (?, ?, ?)');
      insert.run(req.user.restaurant_id, code, percentage);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Get Stats
  app.get('/api/admin/stats', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'billing')) return res.sendStatus(403);

    // Active Orders (not paid)
    const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE restaurant_id = ? AND status != 'paid'").get(req.user.restaurant_id) as { count: number };

    // Today's Sales (paid orders created today)
    // using 'now' in sqlite uses UTC. If we want local time, we might need 'localtime' modifier
    // date(created_at, 'localtime') = date('now', 'localtime')
    const sales = db.prepare(`
      SELECT SUM(total_amount) as total 
      FROM orders 
      WHERE restaurant_id = ? 
      AND status = 'paid' 
      AND date(created_at, 'localtime') = date('now', 'localtime')
    `).get(req.user.restaurant_id) as { total: number };

    res.json({
      activeOrders: activeOrders.count,
      todaySales: sales.total || 0
    });
  });

  // Admin: Cleanup / Reset System
  app.post('/api/admin/cleanup', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    // ... existing cleanup code ...
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    // ... (keeping endpoint for safety, but UI will hide it)
    try {
      db.transaction(() => {
        db.prepare('DELETE FROM order_items').run();
        db.prepare('DELETE FROM orders').run();
        db.prepare("UPDATE tables SET status = 'available'").run();
      })();
      io.to(`restaurant_${req.user.restaurant_id}`).emit('system_reset');
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Customers
  app.get('/api/admin/customers', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const customers = db.prepare('SELECT * FROM customers WHERE restaurant_id = ? ORDER BY created_at DESC').all(req.user.restaurant_id);
    res.json(customers);
  });

  // Admin: Analytics
  app.get('/api/admin/analytics', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);

    const today = new Date().toISOString().split('T')[0];

    const todayRevenue = db.prepare(`
      SELECT SUM(total_amount) as total 
      FROM orders 
      WHERE restaurant_id = ? AND status IN ('completed', 'paid') AND date(created_at) = ?
    `).get(req.user.restaurant_id, today) as { total: number };

    const topItems = db.prepare(`
      SELECT m.name, SUM(oi.quantity) as count 
      FROM order_items oi 
      JOIN orders o ON oi.order_id = o.id 
      JOIN menu_items m ON oi.menu_item_id = m.id
      WHERE o.restaurant_id = ? AND o.status IN ('completed', 'paid')
      GROUP BY m.id 
      ORDER BY count DESC 
      LIMIT 5
    `).all(req.user.restaurant_id);

    const dailySales = db.prepare(`
      SELECT date(created_at) as date, SUM(total_amount) as total 
      FROM orders 
      WHERE restaurant_id = ? AND status IN ('completed', 'paid') 
      GROUP BY date(created_at) 
      ORDER BY date(created_at) DESC 
      LIMIT 7
    `).all(req.user.restaurant_id);

    res.json({
      todayRevenue: todayRevenue.total || 0,
      topItems,
      dailySales: dailySales.reverse()
    });
  });

  // Admin: History
  app.get('/api/admin/history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { range } = req.query; // '7d', '14d', '30d', '6m', '1y'

    let dateModifier = '-7 days';
    if (range === '14d') dateModifier = '-14 days';
    if (range === '30d') dateModifier = '-30 days';
    if (range === '6m') dateModifier = '-6 months';
    if (range === '1y') dateModifier = '-1 year';

    const orders = db.prepare(`
      SELECT * FROM orders 
      WHERE restaurant_id = ? 
      AND status = 'paid'
      AND created_at >= datetime('now', ?, 'localtime')
      ORDER BY created_at DESC
    `).all(req.user.restaurant_id, dateModifier) as Order[];

    const totalSales = orders.reduce((sum, o) => sum + o.total_amount, 0);

    res.json({
      orders,
      totalSales,
      totalOrders: orders.length
    });
  });

  // Admin: Update User Credentials
  app.post('/api/admin/users/update', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { targetRole, newUsername, newPassword } = req.body;

    if (!['admin', 'kitchen', 'billing'].includes(targetRole)) return res.status(400).json({ error: 'Invalid role' });

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    try {
      db.prepare(`
        UPDATE users 
        SET username = ?, password_hash = ? 
        WHERE restaurant_id = ? AND role = ?
      `).run(newUsername, passwordHash, req.user.restaurant_id, targetRole);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin: Shop Status
  app.post('/api/admin/shop/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'admin') return res.sendStatus(403);
    const { isOpen, openingHours, aiPrompt } = req.body;

    db.prepare('UPDATE restaurants SET is_open = ?, opening_hours = ?, ai_prompt = ? WHERE id = ?')
      .run(isOpen ? 1 : 0, openingHours, aiPrompt, req.user.restaurant_id);

    io.emit('shop_status_updated', { isOpen, openingHours, aiPrompt });
    res.json({ success: true });
  });

  // Admin: Get Shop Settings
  app.get('/api/admin/shop/settings', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.sendStatus(403);
    const restaurant = db.prepare('SELECT is_open, opening_hours, ai_prompt FROM restaurants WHERE id = ?').get(req.user.restaurant_id);
    res.json(restaurant);
  });



  // Helper
  function getOrderById(orderId: number | bigint) {
    const order = db.prepare(`
      SELECT o.*, t.name as table_name 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      WHERE o.id = ?
    `).get(orderId) as Order | undefined;

    if (order) {
      order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as OrderItem[];
    }
    return order;
  }

  function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.warn('JWT verify failed:', err.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = decoded as AuthenticatedUser;
      next();
    });
  }

  // ── Socket.IO logic ──
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] New connection: ${socket.id} - IP: ${socket.handshake.address}`);

    socket.on('join_restaurant', (restaurantId: number | string) => {
      if (!restaurantId) return;

      const room = `restaurant_${restaurantId}`;
      socket.join(room);
      console.log(`[Socket.IO] ${socket.id} joined room: ${room}`);
      socket.emit('joined', { room }); // optional feedback to client
    });

    // Optional: simple ping-pong for testing connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] ${socket.id} disconnected: ${reason}`);
    });

    // Log connection errors
    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] connect_error:', err.message);
    });
  });

  // ── Vite dev middleware (safer placement) ──
  if (process.env.NODE_ENV !== 'production') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });

      // Use Vite middlewares **after** your API routes so /api/* and /socket.io/ are not intercepted
      app.use((req, res, next) => {
        if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/socket.io/')) {
          return next();
        }
        vite.middlewares(req, res, next);
      });
    } catch (e) {
      console.error('Vite server setup failed:', e);
    }
  } else {
    // Production: serve built frontend (assuming you build to /dist)
    app.use(express.static(path.join(__dirname, 'dist')));
    // Optional: SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
