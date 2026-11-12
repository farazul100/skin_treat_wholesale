import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// Serve uploads folder via API route to bypass Hostinger static file interception
app.get(['/api/uploads/:filename', '/uploads/:filename'], (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  // Graceful fallback: If an older DB reference or crawled image is missing on disk,
  // return the verified og-image.png instead of a hard 404, so Telegram/social bots never fail
  const distOg = path.join(__dirname, 'dist', 'og-image.png');
  const pubOg = path.join(__dirname, 'public', 'og-image.png');
  const fallback = fs.existsSync(distOg) ? distOg : (fs.existsSync(pubOg) ? pubOg : null);
  if (fallback) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(fallback);
  }
  res.status(404).send('File not found');
});

// Configure multer (memory storage for sharp processing)
const upload = multer({ storage: multer.memoryStorage() });

// Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const timestamp = Date.now();
    let filename;
    
    if (isImage) {
      // Vector SVGs: save directly without rasterization to preserve infinite vector sharpness
      if (req.file.mimetype === 'image/svg+xml') {
        filename = `svg-${timestamp}.svg`;
        const outputPath = path.join(uploadDir, filename);
        fs.writeFileSync(outputPath, req.file.buffer);
      } else {
        filename = `img-${timestamp}.webp`;
        const outputPath = path.join(uploadDir, filename);
        
        // Smart optimization: retain Full HD crispness (up to 1920px) while heavily reducing file size with WebP
        await sharp(req.file.buffer)
          .rotate() // Auto-orient phone photos based on EXIF
          .resize({
            width: 1920,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({
            quality: 86,
            effort: 4
          })
          .toFile(outputPath);
      }
    } else {
      // Handle videos
      const ext = path.extname(req.file.originalname) || '';
      filename = `vid-${timestamp}${ext}`;
      const outputPath = path.join(uploadDir, filename);
      fs.writeFileSync(outputPath, req.file.buffer);
    }

    // Return URL format expected by frontend, using /api/uploads to avoid static routing issues
    res.json({ secure_url: `/api/uploads/${filename}` });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Create Database Connection Pool with high concurrency and keepalive
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// High-speed In-Memory Cache to serve storefront requests in 0-1ms
const serverCache = {
  settings: new Map(),
  categories: null,
  categoriesTime: 0,
  heroSlides: null,
  heroSlidesTime: 0,
  products: null,
  productsTime: 0,
  clearSettings() { this.settings.clear(); },
  clearCategories() { this.categories = null; this.categoriesTime = 0; },
  clearHeroSlides() { this.heroSlides = null; this.heroSlidesTime = 0; },
  clearProducts() { this.products = null; this.productsTime = 0; },
  clearAll() {
    this.settings.clear();
    this.categories = null;
    this.heroSlides = null;
    this.products = null;
  }
};

// Auto-ensure categories.show_on_home column exists
async function ensureCategoryColumns() {
  try {
    await pool.query('ALTER TABLE categories ADD COLUMN show_on_home TINYINT(1) DEFAULT 0;');
    console.log("Column show_on_home added to categories");
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') {
      console.log("Note on show_on_home column:", err.message);
    }
  }
}
ensureCategoryColumns();

// Auto-ensure products.is_bestseller and gift columns exist
async function ensureProductColumns() {
  try {
    await pool.query('ALTER TABLE products ADD COLUMN is_bestseller TINYINT(1) DEFAULT 0;');
    console.log("Column is_bestseller ensured in products");
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') {
      console.log("Note on is_bestseller column:", err.message);
    }
  }

  // Gift feature columns for products
  try { await pool.query('ALTER TABLE products ADD COLUMN has_gift TINYINT(1) DEFAULT 0;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN gift_title VARCHAR(255) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN gift_image TEXT NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN gift_price DECIMAL(10,2) DEFAULT 0.00;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN gift_charge_enabled TINYINT(1) DEFAULT 0;'); } catch (e) {}

  // Coupon feature columns for products
  try { await pool.query('ALTER TABLE products ADD COLUMN coupon_enabled TINYINT(1) DEFAULT 0;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN coupon_code VARCHAR(50) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN coupon_discount_type VARCHAR(20) DEFAULT "fixed";'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN coupon_discount_value DECIMAL(10,2) DEFAULT 0.00;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN coupon_min_spend DECIMAL(10,2) DEFAULT 0.00;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN coupon_expiry_date VARCHAR(50) NULL;'); } catch (e) {}

  // Coupon columns for orders
  try { await pool.query('ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE orders ADD COLUMN coupon_discount DECIMAL(10,2) DEFAULT 0.00;'); } catch (e) {}

  // Gift feature columns for order_items
  try { await pool.query('ALTER TABLE order_items ADD COLUMN has_gift TINYINT(1) DEFAULT 0;'); } catch (e) {}
  try { await pool.query('ALTER TABLE order_items ADD COLUMN gift_title VARCHAR(255) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE order_items ADD COLUMN gift_image TEXT NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE order_items ADD COLUMN gift_price DECIMAL(10,2) DEFAULT 0.00;'); } catch (e) {}
  try { await pool.query('ALTER TABLE order_items ADD COLUMN gift_charge_enabled TINYINT(1) DEFAULT 0;'); } catch (e) {}

  // Drop products_ibfk_1 foreign key if present so product updates/saves never fail on category_id mismatch
  try { await pool.query('ALTER TABLE products DROP FOREIGN KEY products_ibfk_1;'); } catch (e) {}
  try { await pool.query("UPDATE products SET category_id = NULL WHERE category_id = '' OR category_id = 'null';"); } catch (e) {}
}
ensureProductColumns();

// Auto-ensure shefa_videos table exists
async function ensureShefaVideosTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shefa_videos (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255),
        youtube_url TEXT,
        youtube_id VARCHAR(64),
        video_url TEXT,
        thumbnail_url TEXT,
        is_active TINYINT(1) DEFAULT 1,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("shefa_videos table ensured");
    try { await pool.query('ALTER TABLE shefa_videos ADD COLUMN video_url TEXT;'); } catch (e) {}
    try { await pool.query('ALTER TABLE shefa_videos ADD COLUMN thumbnail_url TEXT;'); } catch (e) {}
  } catch (err) {
    console.log("Note on shefa_videos table:", err.message);
  }
}
ensureShefaVideosTable();

// Auto-ensure hero_slides table columns
async function ensureHeroSlidesColumns() {
  try {
    await pool.query('ALTER TABLE hero_slides ADD COLUMN mobile_image_url TEXT NULL;');
  } catch (e) {}
}
ensureHeroSlidesColumns();

// Auto-ensure orders and products payment/delivery columns exist
async function ensurePaymentColumns() {
  try { await pool.query('ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT "cod";'); } catch (e) {}
  try { await pool.query('ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT "pending";'); } catch (e) {}
  try { await pool.query('ALTER TABLE orders ADD COLUMN transaction_id VARCHAR(100) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE orders ADD COLUMN eps_redirect_url TEXT NULL;'); } catch (e) {}

  try { await pool.query('ALTER TABLE products ADD COLUMN delivery_type VARCHAR(50) DEFAULT "global";'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN delivery_inside_dhaka DECIMAL(10,2) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN delivery_outside_dhaka DECIMAL(10,2) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN delivery_nationwide DECIMAL(10,2) NULL;'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN payment_requirement VARCHAR(255) DEFAULT "cod";'); } catch (e) {}
  try { await pool.query('ALTER TABLE products ADD COLUMN is_separate_delivery TINYINT(1) DEFAULT 0;'); } catch (e) {}

  // Drop orders_ibfk_1 foreign key if present so orders never fail on user_id mismatch
  try { await pool.query('ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_1;'); } catch (e) {}
}
ensurePaymentColumns();

// Auto-ensure admin_users and admin_sessions tables exist
async function ensureAdminAuthTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        full_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    try {
      await pool.query('ALTER TABLE admin_users ADD COLUMN full_name VARCHAR(255)');
    } catch (_) {}
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Admin auth tables ensured");

    const [rows] = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    if (rows[0].count === 0) {
      const defaultId = crypto.randomUUID();
      const defaultEmail = 'admin@naturalshefa.com';
      const defaultHash = crypto.createHash('sha256').update('admin123').digest('hex');
      await pool.query(
        'INSERT INTO admin_users (id, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
        [defaultId, defaultEmail, defaultHash, 'admin', 'Store Admin']
      );
      console.log('Default admin user created: admin@naturalshefa.com / admin123');
    }
  } catch (err) {
    console.log("Note on admin auth tables:", err.message);
  }
}
ensureAdminAuthTables();

// Helper to read persistent default settings from file
function getDefaultSettingsFromFile() {
  try {
    const defaultSettingsPath = path.join(__dirname, 'default_site_settings.json');
    if (fs.existsSync(defaultSettingsPath)) {
      return JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
    }
  } catch (e) {
    console.warn("Could not read default_site_settings.json:", e.message);
  }
  return null;
}

// Helper to keep default_site_settings.json synced whenever settings change
function syncSettingToFile(key, value) {
  try {
    const defaultSettingsPath = path.join(__dirname, 'default_site_settings.json');
    let currentData = {};
    if (fs.existsSync(defaultSettingsPath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
      } catch (_) {}
    }
    let parsedVal = value;
    if (typeof value === 'string') {
      try { parsedVal = JSON.parse(value); } catch (_) {}
    }
    currentData[key] = parsedVal;
    fs.writeFileSync(defaultSettingsPath, JSON.stringify(currentData, null, 2), 'utf8');
  } catch (e) {
    console.warn("Failed to sync setting to file:", e.message);
  }
}

// Auto-ensure site_settings table exists and seed from default_site_settings.json if empty or missing keys
async function ensureSiteSettingsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id VARCHAR(64) PRIMARY KEY,
        setting_key VARCHAR(191) NOT NULL UNIQUE,
        setting_value LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("site_settings table ensured");

    const defaultSettings = getDefaultSettingsFromFile();
    if (defaultSettings) {
      const [existingRows] = await pool.query('SELECT setting_key FROM site_settings');
      const existingKeys = new Set(existingRows.map(r => r.setting_key));

      for (const [key, val] of Object.entries(defaultSettings)) {
        if (!existingKeys.has(key)) {
          const id = crypto.randomUUID();
          const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val || '');
          await pool.query(
            'INSERT INTO site_settings (id, setting_key, setting_value) VALUES (?, ?, ?)',
            [id, key, valStr]
          );
          console.log(`Seeded default setting: ${key}`);
        }
      }
    }
  } catch (err) {
    console.log("Note on site_settings table:", err.message);
  }
}
ensureSiteSettingsTable();

function buildWhereClause(query, table = '', alias = '') {
  let whereParts = [];
  let values = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === 'select' || key === 'order' || key === 'single' || key === 'limit') continue;
    if (typeof value === 'string') {
      // Map 'key' to 'setting_key' and 'value' to 'setting_value' for site_settings
      let colName = key;
      if (table === 'site_settings') {
        if (key === 'key') colName = 'setting_key';
        if (key === 'value') colName = 'setting_value';
      }
      
      if (value.startsWith('eq.')) {
        whereParts.push(`${alias}\`${colName}\` = ?`);
        let val = value.split('eq.')[1];
        if (val === 'true') val = 1;
        else if (val === 'false') val = 0;
        values.push(val);
      } else if (value.startsWith('in.(')) {
        const inVals = value.slice(4, -1).split(',').map(s => s.trim());
        const placeholders = inVals.map(() => '?').join(',');
        whereParts.push(`${alias}\`${colName}\` IN (${placeholders})`);
        values.push(...inVals);
      } else if (value.startsWith('neq.')) {
        whereParts.push(`${alias}\`${colName}\` != ?`);
        let val = value.split('neq.')[1];
        if (val === 'true') val = 1;
        else if (val === 'false') val = 0;
        values.push(val);
      }
    }
  }
  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  return { whereClause, values };
}

// Route: Get Products (handles filtering, sorting, limits, categories join)
app.get('/api/products', async (req, res, next) => {
  try {
    const isPublicDefault = !req.query.single && !req.query.limit && (!req.query || Object.keys(req.query).length === 0 || (Object.keys(req.query).length === 1 && req.query.is_active === 'eq.true'));
    if (isPublicDefault && serverCache.products && (Date.now() - serverCache.productsTime < 60000)) {
      return res.json(serverCache.products);
    }

    const { whereClause, values } = buildWhereClause(req.query, 'products', 'p.');
    
    let orderClause = 'ORDER BY p.sort_order ASC, p.created_at DESC';
    if (req.query.order) {
      const [col, dir] = req.query.order.split('.');
      orderClause = `ORDER BY p.\`${col}\` ${dir && dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    let finalWhere = whereClause;
    // If no query parameters at all (public default fetch), default to is_active = 1
    if (!finalWhere && Object.keys(req.query).length === 0) {
      finalWhere = 'WHERE p.is_active = 1';
    }

    let limitClause = '';
    if (req.query.limit && !isNaN(Number(req.query.limit))) {
      limitClause = `LIMIT ${Number(req.query.limit)}`;
    }

    const query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${finalWhere}
      ${orderClause}
      ${limitClause}
    `;
    
    const [rows] = await pool.query(query, values);
    
    // Map to Supabase expected format: categories(name, slug)
    const formatted = rows.map(r => {
      const { category_name, category_slug, ...rest } = r;
      return {
        ...rest,
        categories: { name: category_name, slug: category_slug }
      };
    });
    
    if (isPublicDefault) {
      serverCache.products = formatted;
      serverCache.productsTime = Date.now();
    }

    if (req.query.single) {
      return res.json(formatted[0] || null);
    }

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: Get Categories
app.get('/api/categories', async (req, res, next) => {
  try {
    const isPublicDefault = !req.query.single && !req.query.limit && (!req.query || Object.keys(req.query).length === 0 || (Object.keys(req.query).length === 1 && req.query.is_active === 'eq.true'));
    if (isPublicDefault && serverCache.categories && (Date.now() - serverCache.categoriesTime < 120000)) {
      return res.json(serverCache.categories);
    }

    const { whereClause, values } = buildWhereClause(req.query, 'categories');
    let orderClause = 'ORDER BY sort_order ASC, created_at DESC';
    if (req.query.order) {
      const [col, dir] = req.query.order.split('.');
      orderClause = `ORDER BY \`${col}\` ${dir && dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    let finalWhere = whereClause;
    if (!finalWhere && Object.keys(req.query).length === 0) {
      finalWhere = 'WHERE is_active = 1';
    }

    let limitClause = '';
    if (req.query.limit && !isNaN(Number(req.query.limit))) {
      limitClause = `LIMIT ${Number(req.query.limit)}`;
    }

    const [rows] = await pool.query(`SELECT * FROM categories ${finalWhere} ${orderClause} ${limitClause}`, values);
    if (isPublicDefault) {
      serverCache.categories = rows;
      serverCache.categoriesTime = Date.now();
    }

    if (req.query.single) return res.json(rows[0] || null);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Meta (Facebook) & Google Catalog Dynamic Product Feed (CSV & XML)
const handleMetaCatalogFeed = async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    // 1. Determine site origin
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
    let siteOrigin = `${protocol}://${host}`;

    // 2. Fetch store name & site_url setting if available
    let storeName = 'Sunnahly';
    try {
      const [settings] = await pool.query(
        "SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('site_title', 'site_url', 'store_name')"
      );
      if (settings && settings.length > 0) {
        settings.forEach(s => {
          try {
            const parsed = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            if (s.setting_key === 'site_title' && parsed?.title) storeName = parsed.title;
            if (s.setting_key === 'store_name' && (parsed?.name || typeof parsed === 'string')) storeName = parsed.name || parsed;
            if (s.setting_key === 'site_url' && parsed?.url) siteOrigin = parsed.url.replace(/\/$/, '');
          } catch (_) {}
        });
      }
    } catch (_) {}

    // Fallback brand name from host if generic
    if (!storeName || storeName === 'Sunnahly') {
      const cleanHost = host.split(':')[0].replace(/^www\./i, '');
      const parts = cleanHost.split('.');
      if (parts.length > 0 && parts[0] && parts[0] !== 'localhost') {
        storeName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    }

    // 3. Query all currently active products with their categories dynamically
    const [products] = await pool.query(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.sort_order ASC, p.created_at DESC
    `);

    // Helper: strip HTML
    const stripHtml = (html) => {
      if (!html) return '';
      return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // Helper: resolve primary image to absolute URL
    const resolveImageUrl = (img) => {
      if (!img) return `${siteOrigin}/placeholder.svg`;
      let first = '';
      if (Array.isArray(img)) {
        first = img[0];
      } else if (typeof img === 'string') {
        try {
          const parsed = JSON.parse(img);
          if (Array.isArray(parsed) && parsed[0]) first = parsed[0];
          else if (typeof parsed === 'string') first = parsed;
        } catch (_) {
          first = img.split(',')[0].trim();
        }
      }
      if (!first) return `${siteOrigin}/placeholder.svg`;
      first = String(first).trim();
      if (first.startsWith('http://') || first.startsWith('https://')) return first;
      if (first.startsWith('/')) return `${siteOrigin}${first}`;
      return `${siteOrigin}/${first}`;
    };

    // Helper: RFC 4180 CSV escaping
    const csvField = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    // XML escaping
    const xmlEscape = (v) => {
      if (v === null || v === undefined) return '';
      return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    if (format === 'xml') {
      const items = products.map((p) => {
        const image = resolveImageUrl(p.images);
        const link = `${siteOrigin}/product/${p.slug || p.id}`;
        const desc = stripHtml(p.description) || stripHtml(p.short_description) || p.name;
        const stockQty = Number(p.stock) || 0;
        const availability = stockQty > 0 ? 'in stock' : 'out of stock';
        const price = Number(p.price) || 0;
        const origPrice = p.original_price ? Number(p.original_price) : 0;
        const hasSale = origPrice > price;
        const fullPriceStr = `${(hasSale ? origPrice : price).toFixed(2)} BDT`;
        const salePriceStr = hasSale ? `${price.toFixed(2)} BDT` : '';
        const catName = p.category_name || 'Health & Beauty';

        return `    <item>
      <g:id>${xmlEscape(p.id)}</g:id>
      <g:title>${xmlEscape(p.name)}</g:title>
      <g:description>${xmlEscape(desc.slice(0, 5000))}</g:description>
      <g:link>${xmlEscape(link)}</g:link>
      <g:image_link>${xmlEscape(image)}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${xmlEscape(fullPriceStr)}</g:price>${salePriceStr ? `\n      <g:sale_price>${xmlEscape(salePriceStr)}</g:sale_price>` : ''}
      <g:condition>new</g:condition>
      <g:brand>${xmlEscape(storeName)}</g:brand>
      <g:google_product_category>${xmlEscape(catName)}</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
      }).join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(storeName)} Product Catalog Feed</title>
    <link>${xmlEscape(siteOrigin)}</link>
    <description>Dynamic live product catalog for Meta Commerce and Google Shopping</description>
${items}
  </channel>
</rss>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${storeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-catalog.xml"`);
      } else {
        res.setHeader('Content-Disposition', 'inline; filename="catalog.xml"');
      }
      return res.send(xml);
    }

    // Default: CSV format (Meta Commerce Catalog specification)
    const headers = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'sale_price',
      'link',
      'image_link',
      'brand',
      'google_product_category',
      'quantity_to_sell_on_facebook'
    ];

    const rows = products.map((p) => {
      const image = resolveImageUrl(p.images);
      const link = `${siteOrigin}/product/${p.slug || p.id}`;
      const desc = stripHtml(p.description) || stripHtml(p.short_description) || p.name;
      const stockQty = Number(p.stock) || 0;
      const availability = stockQty > 0 ? 'in stock' : 'out of stock';
      const price = Number(p.price) || 0;
      const origPrice = p.original_price ? Number(p.original_price) : 0;
      const hasSale = origPrice > price;
      const priceStr = `${(hasSale ? origPrice : price).toFixed(2)} BDT`;
      const salePriceStr = hasSale ? `${price.toFixed(2)} BDT` : '';
      const catName = p.category_name || 'Health & Beauty';

      return [
        p.id,
        p.name,
        desc.slice(0, 5000),
        availability,
        'new',
        priceStr,
        salePriceStr,
        link,
        image,
        storeName,
        catName,
        Math.max(0, stockQty)
      ].map(csvField).join(',');
    });

    // UTF-8 BOM (\uFEFF) ensures Excel, Google Sheets, and Meta correctly render Bengali script without corruption
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${storeName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-catalog.csv"`);
    } else {
      res.setHeader('Content-Disposition', 'inline; filename="meta-catalog.csv"');
    }
    return res.send(csvContent);
  } catch (error) {
    console.error('Meta catalog feed error:', error);
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/meta-catalog-feed', handleMetaCatalogFeed);
app.get('/meta-catalog-feed', handleMetaCatalogFeed);
app.get('/api/catalog.csv', (req, res, next) => { req.query.format = 'csv'; handleMetaCatalogFeed(req, res, next); });
app.get('/api/catalog.xml', (req, res, next) => { req.query.format = 'xml'; handleMetaCatalogFeed(req, res, next); });

app.get('/api/debug_info', (req, res) => {
  res.json({
    dirname: __dirname,
    uploadDir: uploadDir
  });
});

// ==========================================
// AUTHENTICATION ROUTES (LOGIN & SIGNUP)
// ==========================================
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name, options } = req.body;
    const name = full_name || (options && options.data && options.data.full_name) || '';
    if (!email || !password) {
      return res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const [existing] = await pool.query('SELECT id FROM admin_users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট রয়েছে' });
    }

    const userId = crypto.randomUUID();
    const hash = crypto.createHash('sha256').update(String(password)).digest('hex');

    // First registered user gets 'admin', others get 'customer'
    const [countRows] = await pool.query('SELECT COUNT(*) as count FROM admin_users');
    const role = (countRows[0].count === 0) ? 'admin' : 'customer';

    try {
      await pool.query(
        'INSERT INTO admin_users (id, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
        [userId, cleanEmail, hash, role, name]
      );
    } catch (_) {
      await pool.query(
        'INSERT INTO admin_users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [userId, cleanEmail, hash, role]
      );
    }

    // Auto-create session token for immediate login
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO admin_sessions (token, user_id, email, role, expires_at) VALUES (?, ?, ?, ?, ?)',
      [token, userId, cleanEmail, role, expiresAt]
    );

    const userObj = {
      id: userId,
      email: cleanEmail,
      role,
      user_metadata: { full_name: name }
    };

    res.status(201).json({
      success: true,
      token,
      user: userObj
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message || 'সাইনআপ ব্যর্থ হয়েছে' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড প্রদান করুন' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const hash = crypto.createHash('sha256').update(String(password)).digest('hex');

    let [users] = await pool.query(
      'SELECT id, email, role, full_name FROM admin_users WHERE LOWER(email) = ? AND (password_hash = ? OR password_hash = SHA2(?, 256))',
      [cleanEmail, hash, String(password)]
    ).catch(async () => {
      // Fallback if full_name column not found
      return await pool.query(
        'SELECT id, email, role FROM admin_users WHERE LOWER(email) = ? AND (password_hash = ? OR password_hash = SHA2(?, 256))',
        [cleanEmail, hash, String(password)]
      );
    });

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড' });
    }

    const admin = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO admin_sessions (token, user_id, email, role, expires_at) VALUES (?, ?, ?, ?, ?)',
      [token, admin.id, admin.email, admin.role || 'admin', expiresAt]
    );

    res.json({
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role || 'admin',
        user_metadata: { full_name: admin.full_name || '' }
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const [rows] = await pool.query(
      'SELECT token, user_id, email, role FROM admin_sessions WHERE token = ? AND expires_at > NOW()',
      [token]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const s = rows[0];
    let fullName = '';
    try {
      const [uRows] = await pool.query('SELECT full_name FROM admin_users WHERE id = ?', [s.user_id]);
      if (uRows && uRows.length > 0) fullName = uRows[0].full_name || '';
    } catch (_) {}

    res.json({
      user: {
        id: s.user_id,
        email: s.email,
        role: s.role || 'admin',
        user_metadata: { full_name: fullName }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      await pool.query('DELETE FROM admin_sessions WHERE token = ?', [token]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস' });

    const [rows] = await pool.query(
      'SELECT user_id, email FROM admin_sessions WHERE token = ? AND expires_at > NOW()',
      [token]
    );
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'সেশন মেয়াদোত্তীর্ণ বা অবৈধ' });

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }

    if (currentPassword) {
      const currentHash = crypto.createHash('sha256').update(String(currentPassword)).digest('hex');
      const [userRows] = await pool.query(
        'SELECT id FROM admin_users WHERE id = ? AND (password_hash = ? OR password_hash = SHA2(?, 256))',
        [rows[0].user_id, currentHash, String(currentPassword)]
      );
      if (!userRows || userRows.length === 0) {
        return res.status(400).json({ error: 'বর্তমান পাসওয়ার্ড সঠিক নয়' });
      }
    }

    const newHash = crypto.createHash('sha256').update(String(newPassword)).digest('hex');
    await pool.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [newHash, rows[0].user_id]);

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic GET Route
app.get('/api/:table', async (req, res, next) => {
  const { table } = req.params;
  // Ignore specific routes already handled above
  if (['products', 'categories', 'rpc', 'eps', 'auth'].includes(table)) return next();
  
  const { whereClause, values } = buildWhereClause(req.query, table);
  let orderClause = '';
  if (req.query.order) {
    const [col, dir] = req.query.order.split('.');
    orderClause = `ORDER BY ${col} ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
  }

  let limitClause = '';
  if (req.query.limit && !isNaN(Number(req.query.limit))) {
    limitClause = `LIMIT ${Number(req.query.limit)}`;
  }

  try {
    const [rows] = await pool.query(`SELECT * FROM ?? ${whereClause} ${orderClause} ${limitClause}`, [table, ...values]);
    if (table === 'orders' && rows.length > 0) {
      try {
        const orderIds = rows.map(r => r.id).filter(Boolean);
        if (orderIds.length > 0) {
          const placeholders = orderIds.map(() => '?').join(',');
          const [orderItems] = await pool.query(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds);
          const itemsByOrder = {};
          orderItems.forEach(it => {
            if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
            itemsByOrder[it.order_id].push(it);
          });
          rows.forEach(r => {
            r.order_items = itemsByOrder[r.id] || [];
          });
        }
      } catch (err) {
        console.warn("Could not load order_items for orders:", err.message);
      }
    }
    if (table === 'site_settings') {
      const parsedRows = rows.map(r => {
        let val = r.setting_value !== undefined ? r.setting_value : r.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch (e) {}
        }
        return {
          id: r.id,
          key: r.setting_key || r.key,
          setting_key: r.setting_key || r.key,
          value: val,
          setting_value: val,
          created_at: r.created_at,
          updated_at: r.updated_at
        };
      });
      if (req.query.single) return res.json(parsedRows[0] || null);
      return res.json(parsedRows);
    }

    if (req.query.single) return res.json(rows[0] || null);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RPC route for get_public_setting with memory caching & fallback to default_site_settings.json
app.post('/api/rpc/get_public_setting', async (req, res) => {
  const { _key } = req.body;
  if (!_key) return res.json(null);

  const cached = serverCache.settings.get(_key);
  if (cached && (Date.now() - cached.time < 5 * 60 * 1000)) {
    return res.json(cached.value);
  }

  try {
    const [rows] = await pool.query('SELECT setting_value FROM site_settings WHERE setting_key = ?', [_key]);
    if (rows.length > 0) {
      let val = rows[0].setting_value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch (e) {}
      }
      serverCache.settings.set(_key, { value: val, time: Date.now() });
      return res.json(val);
    }
    
    // Fallback to default_site_settings.json if key not in DB
    const fileDefaults = getDefaultSettingsFromFile();
    if (fileDefaults && fileDefaults[_key] !== undefined) {
      serverCache.settings.set(_key, { value: fileDefaults[_key], time: Date.now() });
      return res.json(fileDefaults[_key]);
    }

    serverCache.settings.set(_key, { value: null, time: Date.now() });
    res.json(null);
  } catch (error) {
    const fileDefaults = getDefaultSettingsFromFile();
    if (fileDefaults && fileDefaults[_key] !== undefined) {
      return res.json(fileDefaults[_key]);
    }
    res.status(500).json({ error: error.message });
  }
});

// Admin Route: Export all settings as JSON backup
app.get('/api/admin/export-settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings');
    const settingsMap = {};
    for (const r of rows) {
      let val = r.setting_value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch (_) {}
      }
      settingsMap[r.setting_key] = val;
    }
    const fileDefaults = getDefaultSettingsFromFile() || {};
    const merged = { ...fileDefaults, ...settingsMap };

    if (req.query.download) {
      const filename = `store-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
    }
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      version: '1.0',
      settings: merged
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Route: Restore settings from JSON backup
app.post('/api/admin/restore-settings', async (req, res) => {
  try {
    const payload = req.body;
    const settings = payload.settings || payload;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'ভুল ফরম্যাট: সেটিংস অবজেক্ট পাওয়া যায়নি' });
    }

    let count = 0;
    for (const [key, val] of Object.entries(settings)) {
      if (key === 'success' || key === 'timestamp' || key === 'version') continue;
      const id = crypto.randomUUID();
      const valStr = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val !== undefined ? val : '');
      await pool.query(
        `INSERT INTO site_settings (id, setting_key, setting_value) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [id, key, valStr]
      );
      syncSettingToFile(key, val);
      count++;
    }

    serverCache.clearSettings();
    res.json({ success: true, count, message: `${count}টি সেটিংস সফলভাবে রিস্টোর ও সেভ হয়েছে` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Route: Save current live database settings to default_site_settings.json
app.post('/api/admin/sync-defaults', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings');
    const settingsMap = {};
    for (const r of rows) {
      let val = r.setting_value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch (_) {}
      }
      settingsMap[r.setting_key] = val;
    }
    const defaultSettingsPath = path.join(__dirname, 'default_site_settings.json');
    fs.writeFileSync(defaultSettingsPath, JSON.stringify(settingsMap, null, 2), 'utf8');
    res.json({ success: true, message: 'বর্তমান সেটিংস সফলভাবে সার্ভার ডিফল্ট ফাইলে সেভ হয়েছে' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// EPS PAYMENT GATEWAY INTEGRATION
// ==========================================

// Helper function to generate HMAC-SHA512 base64 hash as per EPS documentation
function generateEPSHash(data, hashKey) {
  if (!hashKey || data === undefined || data === null) return '';
  const hmac = crypto.createHmac('sha512', Buffer.from(hashKey, 'utf8'));
  hmac.update(Buffer.from(String(data), 'utf8'));
  return hmac.digest('base64');
}

// Helper to get EPS settings from DB
async function getEpsSettings() {
  try {
    const [rows] = await pool.query('SELECT setting_value FROM site_settings WHERE setting_key = "payment_gateway"');
    if (rows.length === 0) return null;
    let val = rows[0].setting_value;
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch (e) {}
    }
    return val;
  } catch (err) {
    console.error('Error fetching EPS settings:', err);
    return null;
  }
}

// 1. Test Connection Endpoint
app.post('/api/eps/test-connection', async (req, res) => {
  try {
    const { username, password, hash_key, api_url } = req.body;
    if (!username || !password || !hash_key) {
      return res.status(400).json({ success: false, error: 'User Name, Password এবং Hash Key প্রয়োজন' });
    }

    const baseUrl = (api_url || 'https://pgapi.eps.com.bd').replace(/\/+$/, '');
    const xHash = generateEPSHash(username, hash_key);

    console.log('[EPS] Testing connection to:', `${baseUrl}/v1/Auth/GetToken`);
    const authRes = await fetch(`${baseUrl}/v1/Auth/GetToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hash': xHash
      },
      body: JSON.stringify({
        userName: username,
        password: password
      })
    });

    const data = await authRes.json();
    console.log('[EPS] Auth response status:', authRes.status, 'body:', data);

    if (authRes.ok && data.token) {
      return res.json({ success: true, expireDate: data.expireDate });
    } else {
      return res.status(400).json({
        success: false,
        error: data.errorMessage || data.message || `অথেনটিকেশন ব্যর্থ হয়েছে (HTTP ${authRes.status})`
      });
    }
  } catch (error) {
    console.error('[EPS] Test connection error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Initiate Payment Endpoint
app.post('/api/eps/initiate', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ error: 'Order ID প্রয়োজন' });
    }

    const epsSettings = await getEpsSettings();
    if (!epsSettings || !epsSettings.enabled) {
      return res.status(400).json({ error: 'EPS অনলাইন পেমেন্ট চালু নেই' });
    }

    if (!epsSettings.username || !epsSettings.password || !epsSettings.hash_key || !epsSettings.merchant_id || !epsSettings.store_id) {
      return res.status(400).json({ error: 'EPS পেমেন্ট ক্রেডেনশিয়াল সম্পূর্ণ কনফিগার করা হয়নি' });
    }

    // Get order from DB
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'অর্ডারটি পাওয়া যায়নি' });
    }
    const order = orderRows[0];

    // Get order items from DB
    const [orderItems] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order_id]);

    const baseUrl = (epsSettings.api_url || 'https://pgapi.eps.com.bd').replace(/\/+$/, '');

    // 1. Get Token from EPS
    const tokenHash = generateEPSHash(epsSettings.username, epsSettings.hash_key);
    const authRes = await fetch(`${baseUrl}/v1/Auth/GetToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hash': tokenHash
      },
      body: JSON.stringify({
        userName: epsSettings.username,
        password: epsSettings.password
      })
    });

    const authData = await authRes.json();
    if (!authRes.ok || !authData.token) {
      console.error('[EPS] Auth failed:', authData);
      return res.status(400).json({
        error: authData.errorMessage || 'EPS লগইন/অথেনটিকেশন ব্যর্থ হয়েছে'
      });
    }
    const token = authData.token;

    // 2. Initialize EPS Payment
    // merchantTransactionId: minimum 10 digit unique string
    const merchantTxId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const initHash = generateEPSHash(merchantTxId, epsSettings.hash_key);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const domain = `${protocol}://${host}`;

    const payableAmount = Number(order.partial_payment > 0 ? order.partial_payment : order.total);

    const productList = (orderItems.length > 0 ? orderItems : [{ product_name: 'Organics Item', quantity: 1, price: payableAmount }]).map((item, idx) => ({
      productName: item.product_name || `Item ${idx + 1}`,
      noOfItem: String(item.quantity || 1),
      productProfile: 'general',
      productCategory: 'Organic',
      productPrice: String(item.price || payableAmount)
    }));

    const initPayload = {
      storeId: epsSettings.store_id,
      merchantId: epsSettings.merchant_id,
      CustomerOrderId: String(order.order_number || order.id),
      merchantTransactionId: merchantTxId,
      transactionTypeId: 1,
      financialEntityId: 0,
      transitionStatusId: 0,
      totalAmount: payableAmount,
      ipAddress: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '103.12.45.69').split(',')[0].trim(),
      version: '1',
      successUrl: `${domain}/api/eps/callback?status=success&order_id=${order.id}&merchantTransactionId=${merchantTxId}`,
      failUrl: `${domain}/api/eps/callback?status=fail&order_id=${order.id}&merchantTransactionId=${merchantTxId}`,
      cancelUrl: `${domain}/api/eps/callback?status=cancel&order_id=${order.id}&merchantTransactionId=${merchantTxId}`,
      customerName: order.customer_name || 'Customer',
      customerEmail: order.customer_email || 'order@sunnahly.com',
      CustomerAddress: order.shipping_address || 'Dhaka',
      CustomerCity: order.city || 'Dhaka',
      CustomerState: order.city || 'Dhaka',
      CustomerPostcode: '1200',
      CustomerCountry: 'BD',
      CustomerPhone: order.customer_phone || '01700000000',
      ShipmentName: order.customer_name || 'Customer',
      ShipmentAddress: order.shipping_address || 'Dhaka',
      ShipmentCity: order.city || 'Dhaka',
      ShipmentState: order.city || 'Dhaka',
      ShipmentPostcode: '1200',
      ShipmentCountry: 'BD',
      ValueA: String(order.id),
      ValueB: epsSettings.mode || 'sandbox',
      ValueC: '',
      ValueD: '',
      ShippingMethod: 'Courier',
      NoOfItem: String(productList.length),
      ProductName: productList[0]?.productName || 'Organics Products',
      ProductProfile: 'general',
      ProductCategory: 'Organic',
      ProductList: productList
    };

    console.log('[EPS] Initializing EPS with merchantTxId:', merchantTxId);
    const initRes = await fetch(`${baseUrl}/v1/EPSEngine/InitializeEPS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hash': initHash,
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(initPayload)
    });

    const initData = await initRes.json();
    console.log('[EPS] Initialize response:', initData);

    if (initRes.ok && initData.RedirectURL) {
      await pool.query(
        'UPDATE orders SET transaction_id = ?, eps_redirect_url = ?, payment_method = "eps" WHERE id = ?',
        [merchantTxId, initData.RedirectURL, order.id]
      );

      return res.json({
        success: true,
        redirect_url: initData.RedirectURL,
        transaction_id: merchantTxId,
        eps_transaction_id: initData.TransactionId
      });
    } else {
      console.error('[EPS] Initialize failed:', initData);
      return res.status(400).json({
        error: initData.ErrorMessage || 'পেমেন্ট গেটওয়েতে রিডাইরেক্ট লিঙ্ক পাওয়া যায়নি'
      });
    }
  } catch (error) {
    console.error('[EPS] Initiate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Callback Endpoint (Handles success/fail/cancel redirect from EPS)
app.all('/api/eps/callback', async (req, res) => {
  try {
    const query = req.query || {};
    const body = req.body || {};
    const params = { ...query, ...body };

    const status = params.status || 'unknown';
    const orderId = params.order_id || params.ValueA;
    const merchantTxId = params.merchantTransactionId || params.tx_id || params.merchantTransactionld;
    const epsTxId = params.EPSTransactionId || params.EpsTransactionId || params.TransactionId;

    console.log('[EPS Callback] Received:', { status, orderId, merchantTxId, epsTxId, params });

    if (!orderId) {
      return res.redirect('/?payment=error_missing_order');
    }

    if (status === 'cancel') {
      await pool.query('UPDATE orders SET payment_status = "cancelled" WHERE id = ?', [orderId]);
      return res.redirect(`/order-success/${orderId}?payment=cancelled`);
    }

    if (status === 'fail') {
      await pool.query('UPDATE orders SET payment_status = "failed" WHERE id = ?', [orderId]);
      return res.redirect(`/order-success/${orderId}?payment=failed`);
    }

    // Attempt verify with EPS
    const epsSettings = await getEpsSettings();
    if (epsSettings && merchantTxId) {
      const baseUrl = (epsSettings.api_url || 'https://pgapi.eps.com.bd').replace(/\/+$/, '');

      // Get Token
      const tokenHash = generateEPSHash(epsSettings.username, epsSettings.hash_key);
      const authRes = await fetch(`${baseUrl}/v1/Auth/GetToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hash': tokenHash
        },
        body: JSON.stringify({
          userName: epsSettings.username,
          password: epsSettings.password
        })
      });

      const authData = await authRes.json();
      if (authRes.ok && authData.token) {
        const verifyHash = generateEPSHash(merchantTxId, epsSettings.hash_key);
        const verifyUrl = `${baseUrl}/v1/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${merchantTxId}&EPSTransactionId=${epsTxId || ''}`;

        console.log('[EPS] Verifying transaction status at:', verifyUrl);
        const verifyRes = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'x-hash': verifyHash,
            'Authorization': `Bearer ${authData.token}`
          }
        });

        const verifyData = await verifyRes.json();
        console.log('[EPS Verify Result]:', verifyData);

        if (verifyData.Status === 'Success' || verifyData.status === 'Success' || verifyData.Status === 'SUCCESS') {
          await pool.query(
            'UPDATE orders SET payment_status = "paid", order_status = "confirmed", transaction_id = ? WHERE id = ?',
            [verifyData.EpsTransactionId || epsTxId || merchantTxId, orderId]
          );
          return res.redirect(`/order-success/${orderId}?payment=success`);
        }
      }
    }

    // Default to success if status parameter is success
    if (status === 'success') {
      await pool.query(
        'UPDATE orders SET payment_status = "paid", order_status = "confirmed" WHERE id = ?',
        [orderId]
      );
      return res.redirect(`/order-success/${orderId}?payment=success`);
    }

    return res.redirect(`/order-success/${orderId}`);
  } catch (error) {
    console.error('[EPS Callback Error]:', error);
    res.redirect('/');
  }
});

app.get('/api/debug_uploads', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    res.json({
      uploadDir,
      exists: fs.existsSync(uploadDir),
      files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic POST Route
app.post('/api/:table', async (req, res, next) => {
  const { table } = req.params;
  if (table === 'rpc' || table === 'eps' || table === 'auth') return next();
  
  const data = req.body;
  if (!data || Object.keys(data).length === 0) return res.status(400).json({ error: "No data" });
  
  const items = Array.isArray(data) ? data : [data];
  try {
    const results = [];
    for (const item of items) {
      // Handle site_settings insertion safely with ON DUPLICATE KEY UPDATE to prevent duplicate key errors
      if (table === 'site_settings') {
        const sKey = item.setting_key !== undefined ? item.setting_key : item.key;
        let sVal = item.setting_value !== undefined ? item.setting_value : item.value;
        const sId = item.id || crypto.randomUUID();
        const valStr = typeof sVal === 'object' && sVal !== null ? JSON.stringify(sVal) : String(sVal !== undefined ? sVal : '');

        await pool.query(
          `INSERT INTO site_settings (id, setting_key, setting_value) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [sId, sKey, valStr]
        );
        syncSettingToFile(sKey, sVal);
        results.push({ id: sId, key: sKey, setting_key: sKey, value: sVal, setting_value: sVal });
        continue;
      }

      // Handle orders insertion safely
      if (table === 'orders') {
        if (!item.id) {
          item.id = crypto.randomUUID();
        }
        if (!item.order_number) {
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const rand = Math.floor(1000 + Math.random() * 9000);
          item.order_number = `NS-${dateStr}-${rand}`;
        }
        // Sanitize user_id: if empty or 'admin-user' or not existing in users, set to null
        if (!item.user_id || item.user_id === 'admin-user' || String(item.user_id).trim() === '') {
          item.user_id = null;
        } else {
          try {
            const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [item.user_id]);
            if (!userRows || userRows.length === 0) {
              item.user_id = null;
            }
          } catch (e) {
            item.user_id = null;
          }
        }
      }

      // Handle order_items insertion safely
      if (table === 'order_items') {
        if (!item.id) {
          item.id = crypto.randomUUID();
        }
        if (item.product_id) {
          try {
            const [prodRows] = await pool.query('SELECT id FROM products WHERE id = ?', [item.product_id]);
            if (!prodRows || prodRows.length === 0) {
              item.product_id = null;
            }
          } catch (e) {
            // Keep product_id if query fails
          }
        }
      }

      // Handle incomplete_orders insertion safely
      if (table === 'incomplete_orders') {
        if (!item.id) {
          item.id = crypto.randomUUID();
        }
      }

      // Handle categories insertion safely
      if (table === 'categories') {
        if (!item.id) {
          item.id = crypto.randomUUID();
        }
      }

      // Handle products insertion safely (prevent foreign key crash on category_id)
      if (table === 'products') {
        if (!item.id) {
          item.id = crypto.randomUUID();
        }
        if (!item.category_id || item.category_id === 'null' || item.category_id === 'undefined' || String(item.category_id).trim() === '') {
          item.category_id = null;
        } else {
          try {
            const [catRows] = await pool.query('SELECT id FROM categories WHERE id = ?', [item.category_id]);
            if (!catRows || catRows.length === 0) {
              item.category_id = null;
            }
          } catch (e) {
            item.category_id = null;
          }
        }
      }
      const keys = Object.keys(item);
      const vals = Object.values(item).map(v => (typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'object' && v !== null ? JSON.stringify(v) : v));
      const escapedKeys = keys.map(k => `\`${k}\``).join(', ');
      const placeholders = keys.map(() => '?').join(', ');
      const [result] = await pool.query(`INSERT INTO ?? (${escapedKeys}) VALUES (${placeholders})`, [table, ...vals]);
      const returnedId = item.id || (result.insertId > 0 ? result.insertId : undefined);
      results.push({ ...item, id: returnedId });
    }
    if (table === 'site_settings') serverCache.clearSettings();
    else if (table === 'categories') serverCache.clearCategories();
    else if (table === 'products') serverCache.clearProducts();
    else if (table === 'hero_slides') serverCache.clearHeroSlides();
    res.json(Array.isArray(data) ? results : results[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic PATCH Route
app.patch('/api/:table', async (req, res) => {
  const { table } = req.params;
  const data = req.body;
  const { whereClause, values } = buildWhereClause(req.query, table);
  
  if (!whereClause) return res.status(400).json({ error: "Missing where clause for update" });
  
  try {
    // Handle 'key' to 'setting_key' and 'value' to 'setting_value' mapping for updates
    if (table === 'site_settings') {
      if (data.key !== undefined) {
        data.setting_key = data.key;
        delete data.key;
      }
      if (data.value !== undefined) {
        data.setting_value = data.value;
        delete data.value;
      }
      const targetKey = (req.query.key?.startsWith('eq.') ? req.query.key.slice(3) : req.query.key) ||
                        (req.query.setting_key?.startsWith('eq.') ? req.query.setting_key.slice(3) : req.query.setting_key) ||
                        data.setting_key;
      if (targetKey && data.setting_value !== undefined) {
        syncSettingToFile(targetKey, data.setting_value);
      }
    }

    // Sanitize category_id for product updates so foreign key constraint never crashes
    if (table === 'products' && 'category_id' in data) {
      if (!data.category_id || data.category_id === 'null' || data.category_id === 'undefined' || String(data.category_id).trim() === '') {
        data.category_id = null;
      } else {
        try {
          const [catRows] = await pool.query('SELECT id FROM categories WHERE id = ?', [data.category_id]);
          if (!catRows || catRows.length === 0) {
            data.category_id = null;
          }
        } catch (e) {
          data.category_id = null;
        }
      }
    }
    const keys = Object.keys(data);
    const setVals = Object.values(data).map(v => (typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'object' && v !== null ? JSON.stringify(v) : v));
    const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
    
    await pool.query(`UPDATE ?? SET ${setClause} ${whereClause}`, [table, ...setVals, ...values]);
    if (table === 'site_settings') serverCache.clearSettings();
    else if (table === 'categories') serverCache.clearCategories();
    else if (table === 'products') serverCache.clearProducts();
    else if (table === 'hero_slides') serverCache.clearHeroSlides();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic DELETE Route
app.delete('/api/:table', async (req, res) => {
  const { table } = req.params;
  const { whereClause, values } = buildWhereClause(req.query, table);
  if (!whereClause) return res.status(400).json({ error: "Missing where clause for delete" });
  
  try {
    await pool.query(`DELETE FROM ?? ${whereClause}`, [table, ...values]);
    if (table === 'site_settings') serverCache.clearSettings();
    else if (table === 'categories') serverCache.clearCategories();
    else if (table === 'products') serverCache.clearProducts();
    else if (table === 'hero_slides') serverCache.clearHeroSlides();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helpers for dynamic social link preview metadata
function escapeHtmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toAbsoluteUrl(url, base, proto = 'https') {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `${proto}:${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`;
  }
  return `${base}/${trimmed}`;
}

// Check if an image actually exists on disk or is accessible before putting into og:image
function isImageAccessible(imgUrl) {
  if (!imgUrl || typeof imgUrl !== 'string') return false;
  const trimmed = imgUrl.trim();
  if (!trimmed) return false;

  // External URL (Cloudinary, Imgur, S3, etc.)
  if (/^https?:\/\//i.test(trimmed)) {
    // If it points back to our own uploads/ path, check disk
    if (trimmed.includes('/uploads/')) {
      const filename = path.basename(trimmed.split('?')[0]);
      return fs.existsSync(path.join(uploadDir, filename));
    }
    return true;
  }

  // Local uploads path
  if (trimmed.includes('/uploads/')) {
    const filename = path.basename(trimmed.split('?')[0]);
    return fs.existsSync(path.join(uploadDir, filename));
  }

  // Static files in dist or public (like /og-image.png, /placeholder.svg)
  const rel = trimmed.replace(/^\//, '');
  const staticPath = path.join(__dirname, 'dist', rel);
  const publicPath = path.join(__dirname, 'public', rel);
  return fs.existsSync(staticPath) || fs.existsSync(publicPath);
}

// Dedicated Open Graph banner routes with explicit mime types
app.get('/og-image.png', (req, res) => {
  const pngPath = path.join(__dirname, 'dist', 'og-image.png');
  const fallback = path.join(__dirname, 'public', 'og-image.png');
  const file = fs.existsSync(pngPath) ? pngPath : fallback;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(file);
});

app.get('/og-image.jpg', (req, res) => {
  const jpgPath = path.join(__dirname, 'dist', 'og-image.jpg');
  const fallback = path.join(__dirname, 'public', 'og-image.jpg');
  const file = fs.existsSync(jpgPath) ? jpgPath : fallback;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(file);
});

// Serve static files from the React app (index: false ensures / route hits our dynamic OG handler)
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// The "catchall" handler: dynamically inject absolute OG metadata for WhatsApp/Telegram/Facebook link previews
// Automatically shows whatever is on the homepage in the theme (active hero slider, store title, or product details)
app.use(async (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('Not Found');
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf8');

    // Determine current host and protocol
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'sunnahly.com';
    const baseUrl = `${proto}://${host}`;
    const cleanPath = req.path || '/';
    const currentUrl = `${baseUrl}${req.originalUrl || cleanPath}`;

    // Read store settings from database
    let storeTitle = '';
    let storeDesc = '';
    let storeLogo = '';
    let customOgBanner = '';
    let heroPromoBanner = '';

    try {
      const [settings] = await pool.query(
        "SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('site_title', 'site_logo', 'site_description', 'og_banner', 'social_share_banner', 'hero_promo_banner')"
      );
      if (settings && settings.length > 0) {
        settings.forEach(s => {
          try {
            const parsed = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
            if (s.setting_key === 'site_title' && parsed?.title) storeTitle = parsed.title;
            if (s.setting_key === 'site_logo' && parsed?.url) storeLogo = parsed.url;
            if (s.setting_key === 'site_description' && (parsed?.description || parsed?.text)) storeDesc = parsed.description || parsed.text;
            if ((s.setting_key === 'og_banner' || s.setting_key === 'social_share_banner') && parsed?.url) customOgBanner = parsed.url;
            if (s.setting_key === 'hero_promo_banner' && (parsed?.image_url || parsed?.url)) heroPromoBanner = parsed.image_url || parsed.url;
          } catch (_) {}
        });
      }
    } catch (_) {}

    // Fallback store title from domain if not yet configured
    if (!storeTitle) {
      const cleanHost = host.split(':')[0].replace(/^www\./i, '');
      const parts = cleanHost.split('.');
      if (parts.length > 0 && parts[0]) {
        storeTitle = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      } else {
        storeTitle = 'Online Shop';
      }
    }

    let pageTitle = storeTitle;
    let pageDesc = storeDesc || `${storeTitle} - সেরা মানের পণ্য ও দ্রুত হোম ডেলিভারি। অর্ডার করতে ভিজিট করুন।`;
    let pageImage = '';

    // Check if user is sharing a specific product link: /product/:id or /product/:slug or /products/:id
    const productMatch = cleanPath.match(/^\/(?:product|products)\/([a-zA-Z0-9_-]+)/i);
    if (productMatch) {
      const productParam = productMatch[1];
      try {
        const [prodRows] = await pool.query(
          "SELECT name, slug, description, short_description, price, images FROM products WHERE id = ? OR slug = ? LIMIT 1",
          [productParam, productParam]
        );
        if (prodRows && prodRows.length > 0) {
          const prod = prodRows[0];
          pageTitle = `${prod.name} | ${storeTitle}`;

          if (prod.short_description) {
            pageDesc = prod.short_description;
          } else if (prod.description) {
            const plain = prod.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            pageDesc = plain.slice(0, 160) + (plain.length > 160 ? '...' : '');
          } else if (prod.price) {
            pageDesc = `মূল্য: ৳${prod.price}। এখনই অর্ডার করুন ${storeTitle}-এ।`;
          }

          // Parse product image
          let pImg = '';
          if (prod.images) {
            if (Array.isArray(prod.images)) {
              pImg = prod.images[0];
            } else if (typeof prod.images === 'string') {
              try {
                const parsed = JSON.parse(prod.images);
                if (Array.isArray(parsed) && parsed.length > 0) pImg = parsed[0];
                else if (typeof parsed === 'string') pImg = parsed;
              } catch (_) {
                pImg = prod.images.split(',')[0].trim();
              }
            }
          }
          if (pImg && isImageAccessible(pImg)) {
            pageImage = toAbsoluteUrl(pImg, baseUrl, proto);
          }
        }
      } catch (_) {}
    }

    // If not a product page or product has no accessible image: extract homepage theme visual
    if (!pageImage) {
      // 1. Custom OG Banner from Admin Settings if uploaded and verified accessible
      if (customOgBanner && isImageAccessible(customOgBanner)) {
        pageImage = toAbsoluteUrl(customOgBanner, baseUrl, proto);
      }

      // 2. Main Hero Slide from the Homepage theme (verified accessible on server disk)
      if (!pageImage) {
        try {
          const [slides] = await pool.query(
            "SELECT image_url, title FROM hero_slides WHERE is_active = 1 OR is_active = true ORDER BY sort_order ASC, created_at DESC"
          );
          if (slides && slides.length > 0) {
            for (const s of slides) {
              if (s.image_url && isImageAccessible(s.image_url)) {
                pageImage = toAbsoluteUrl(s.image_url, baseUrl, proto);
                if (!storeDesc && s.title) {
                  pageDesc = `${s.title} - ${storeTitle}`;
                }
                break;
              }
            }
          }
        } catch (_) {}
      }

      // 3. Hero Promo Banner on Homepage (verified accessible)
      if (!pageImage && heroPromoBanner && isImageAccessible(heroPromoBanner)) {
        pageImage = toAbsoluteUrl(heroPromoBanner, baseUrl, proto);
      }

      // 4. Store Logo (verified accessible)
      if (!pageImage && storeLogo && isImageAccessible(storeLogo)) {
        pageImage = toAbsoluteUrl(storeLogo, baseUrl, proto);
      }

      // 5. Guaranteed verified fallback (always returns 200 OK image/png)
      if (!pageImage) {
        pageImage = `${baseUrl}/og-image.png`;
      }
    }

    // Determine MIME type
    let imgMimeType = 'image/png';
    if (/\.jpe?g(\?.*)?$/i.test(pageImage)) imgMimeType = 'image/jpeg';
    else if (/\.webp(\?.*)?$/i.test(pageImage)) imgMimeType = 'image/webp';
    else if (/\.gif(\?.*)?$/i.test(pageImage)) imgMimeType = 'image/gif';

    // Inject dynamic metadata into HTML
    html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtmlAttr(pageTitle)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/gi, `<meta name="description" content="${escapeHtmlAttr(pageDesc)}"`);
    html = html.replace(/<meta name="author" content="[^"]*"/gi, `<meta name="author" content="${escapeHtmlAttr(storeTitle)}"`);

    // Open Graph
    html = html.replace(/<meta property="og:title" content="[^"]*"/gi, `<meta property="og:title" content="${escapeHtmlAttr(pageTitle)}"`);
    html = html.replace(/<meta property="og:description" content="[^"]*"/gi, `<meta property="og:description" content="${escapeHtmlAttr(pageDesc)}"`);
    html = html.replace(/<meta property="og:url" content="[^"]*"/gi, `<meta property="og:url" content="${escapeHtmlAttr(currentUrl)}"`);
    html = html.replace(/<meta property="og:image" content="[^"]*"/gi, `<meta property="og:image" content="${pageImage}"`);
    html = html.replace(/<meta property="og:image:secure_url" content="[^"]*"/gi, `<meta property="og:image:secure_url" content="${pageImage}"`);
    html = html.replace(/<meta property="og:image:type" content="[^"]*"/gi, `<meta property="og:image:type" content="${imgMimeType}"`);
    html = html.replace(/<meta property="og:image:alt" content="[^"]*"/gi, `<meta property="og:image:alt" content="${escapeHtmlAttr(pageTitle)}"`);

    // Twitter
    html = html.replace(/<meta name="twitter:title" content="[^"]*"/gi, `<meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}"`);
    html = html.replace(/<meta name="twitter:description" content="[^"]*"/gi, `<meta name="twitter:description" content="${escapeHtmlAttr(pageDesc)}"`);
    html = html.replace(/<meta name="twitter:url" content="[^"]*"/gi, `<meta name="twitter:url" content="${escapeHtmlAttr(currentUrl)}"`);
    html = html.replace(/<meta name="twitter:image" content="[^"]*"/gi, `<meta name="twitter:image" content="${pageImage}"`);

    // Clean up any remaining third-party lovable references
    html = html.replace(/https:\/\/lovable\.dev[^\s"'>]*/gi, pageImage);

    res.send(html);
  } catch (err) {
    res.sendFile(indexPath);
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
