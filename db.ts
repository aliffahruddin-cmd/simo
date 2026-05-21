import Database from 'better-sqlite3';
import fs from 'fs';

let db: any;
try {
  db = new Database('simak.db');
} catch (err) {
  console.error("Database connection failed. Attempting to recover by recreation...", err);
  if (fs.existsSync('simak.db')) {
    try {
      fs.unlinkSync('simak.db');
    } catch (e) {
      console.error("Failed to delete malformed database file", e);
    }
  }
  db = new Database('simak.db');
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    no_anggota TEXT UNIQUE,
    email TEXT UNIQUE,
    nama_lengkap TEXT,
    password TEXT,
    role TEXT,
    wilayah TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    no_anggota TEXT UNIQUE,
    nik TEXT,
    nama_lengkap TEXT,
    alamat_lengkap TEXT,
    no_whatsapp TEXT,
    pengurus TEXT,
    wilayah TEXT,
    jabatan TEXT,
    seksi TEXT,
    lain_lain TEXT,
    foto_profile_url TEXT,
    foto_ektp_url TEXT,
    status TEXT DEFAULT 'Aktif',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS finance (
    id TEXT PRIMARY KEY,
    tanggal TEXT,
    jenis TEXT,
    nominal REAL,
    keterangan TEXT,
    operator TEXT,
    status TEXT DEFAULT 'Approved',
    role TEXT,
    wilayah TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS structure (
    id TEXT PRIMARY KEY,
    no_anggota TEXT,
    nama_lengkap TEXT,
    jabatan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS permissions (
    role TEXT,
    menu_key TEXT,
    is_allowed INTEGER,
    PRIMARY KEY (role, menu_key)
  );
`);

// Sync default permissions
const allMenus = ['dashboard', 'members', 'structure', 'finance', 'users', 'reports', 'console', 'permissions', 'maintenance'];
const insert = db.prepare('INSERT OR IGNORE INTO permissions (role, menu_key, is_allowed) VALUES (?, ?, ?)');
const update = db.prepare("UPDATE permissions SET is_allowed = 1 WHERE role = 'ADMIN' AND menu_key = 'maintenance'");

db.transaction(() => {
  // 1. Ensure all menus exist in the table (Insert with IGNORE)
  for (const role of ['ADMIN', 'DPP', 'DPD', 'DPC', 'PAC']) {
    for (const menu of allMenus) {
      // By default, only ADMIN gets new menus enabled automatically if they don't exist
      const isAllowed = (role === 'ADMIN') ? 1 : 0; 
      insert.run(role, menu, isAllowed);
    }
  }
  // 2. specifically ensure ADMIN has maintenance enabled in case it was toggled off or missed
  update.run();
})();

// Seeding handled in server.ts
export default db;
