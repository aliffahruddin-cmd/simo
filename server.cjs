var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// db.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_fs = __toESM(require("fs"), 1);
var db;
try {
  db = new import_better_sqlite3.default("simak.db");
} catch (err) {
  console.error("Database connection failed. Attempting to recover by recreation...", err);
  if (import_fs.default.existsSync("simak.db")) {
    try {
      import_fs.default.unlinkSync("simak.db");
    } catch (e) {
      console.error("Failed to delete malformed database file", e);
    }
  }
  db = new import_better_sqlite3.default("simak.db");
}
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
var allMenus = ["dashboard", "members", "structure", "finance", "users", "reports", "console", "permissions", "maintenance"];
var insert = db.prepare("INSERT OR IGNORE INTO permissions (role, menu_key, is_allowed) VALUES (?, ?, ?)");
var update = db.prepare("UPDATE permissions SET is_allowed = 1 WHERE role = 'ADMIN' AND menu_key = 'maintenance'");
db.transaction(() => {
  for (const role of ["ADMIN", "DPP", "DPD", "DPC", "PAC"]) {
    for (const menu of allMenus) {
      const isAllowed = role === "ADMIN" ? 1 : 0;
      insert.run(role, menu, isAllowed);
    }
  }
  update.run();
})();
var db_default = db;

// server.ts
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_adm_zip = __toESM(require("adm-zip"), 1);
var import_uuid = require("uuid");
var XLSX = __toESM(require("xlsx"), 1);
var import_exceljs = __toESM(require("exceljs"), 1);
var import_docx = require("docx");
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
var import_app = require("firebase/app");
var import_firestore2 = require("firebase/firestore");
(0, import_firestore2.setLogLevel)("error");
var getFirebaseConfig = () => {
  const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (!import_fs2.default.existsSync(configPath)) return null;
  return JSON.parse(import_fs2.default.readFileSync(configPath, "utf8"));
};
var firebaseConfig = getFirebaseConfig();
var firebaseAdminApp;
function initFirebase() {
  const config = getFirebaseConfig();
  if (!config) {
    console.error("[FIREBASE] Config file not found.");
    return;
  }
  const targetProjectId = config.projectId;
  try {
    const existingApp = import_firebase_admin.default.apps.find((a) => a?.options.projectId === targetProjectId);
    if (existingApp) {
      firebaseAdminApp = existingApp;
      console.log(`[FIREBASE] Reusing existing admin app for: ${targetProjectId}`);
    } else {
      const hasDefaultApp = import_firebase_admin.default.apps.length > 0 && import_firebase_admin.default.apps.find((a) => a?.name === "[DEFAULT]");
      const useDefault = !hasDefaultApp || import_firebase_admin.default.app().options.projectId === targetProjectId;
      if (useDefault) {
        console.log(`[FIREBASE] Initializing DEFAULT admin app for: ${targetProjectId}`);
        firebaseAdminApp = import_firebase_admin.default.initializeApp({
          projectId: targetProjectId
        });
      } else {
        const name = `app-${targetProjectId}-${Date.now()}`;
        console.log(`[FIREBASE] Initializing NAMED admin app [${name}] for: ${targetProjectId}`);
        firebaseAdminApp = import_firebase_admin.default.initializeApp({
          projectId: targetProjectId
        }, name);
      }
    }
    process.env.GOOGLE_CLOUD_PROJECT = targetProjectId;
    console.log(`[FIREBASE] Admin active project: ${firebaseAdminApp?.options?.projectId}`);
  } catch (e) {
    console.error("[FIREBASE] Admin Init error:", e.message);
    if (!firebaseAdminApp && import_firebase_admin.default.apps.length > 0) {
      firebaseAdminApp = import_firebase_admin.default.app();
    }
  }
}
initFirebase();
var clientApp;
var clientFirestore;
function initClientFirebase() {
  const config = getFirebaseConfig();
  if (!config) return;
  try {
    const apps = (0, import_app.getApps)();
    if (apps.length > 0) {
      clientApp = apps.find((a) => a.name === "[DEFAULT]") || apps[0];
    } else {
      clientApp = (0, import_app.initializeApp)(config);
    }
    clientFirestore = (0, import_firestore2.getFirestore)(clientApp, config.firestoreDatabaseId);
    console.log(`[FIREBASE] Client SDK initialized for project: ${config.projectId}`);
  } catch (e) {
    console.error("[FIREBASE] Client SDK Init error:", e.message);
  }
}
initClientFirebase();
var getAuthService = () => firebaseAdminApp ? (0, import_auth.getAuth)(firebaseAdminApp) : null;
var getFirestoreService = () => {
  if (!firebaseAdminApp) return null;
  const config = getFirebaseConfig();
  const dbId = config?.firestoreDatabaseId && config?.firestoreDatabaseId !== "(default)" ? config.firestoreDatabaseId : void 0;
  return (0, import_firestore.getFirestore)(firebaseAdminApp, dbId);
};
var auth = getAuthService();
var firestore = getFirestoreService();
function refreshFirebaseServices() {
  initFirebase();
  initClientFirebase();
  auth = getAuthService();
  firestore = getFirestoreService();
}
var OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write"
};
function handleFirestoreError(error, operationType, path2, userId) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const lowMsg = errMessage.toLowerCase();
  if (lowMsg.includes("cancelled") || lowMsg.includes("idle stream") || lowMsg.includes("timeout") || lowMsg.includes("waiting for new targets")) {
    return;
  }
  if (lowMsg.includes("not_found") || lowMsg.includes("no document")) {
    return;
  }
  const activeProjectId = firebaseAdminApp?.options?.projectId || "unknown";
  const isMismatch = errMessage.includes("643827784442") || activeProjectId === "643827784442";
  const errInfo = {
    error: isMismatch ? `PROJECT_MISMATCH: The Admin SDK is accessing Host Project (643827784442) instead of your project. This happens due to missing Service Account credentials in this sandbox. Client-side features will still work fine.` : errMessage,
    operationType,
    path: path2,
    activeProjectId,
    authInfo: {
      userId: userId || "server"
    }
  };
  if (lowMsg.includes("permission") || lowMsg.includes("insufficient permissions")) {
    console.error("Firestore Permission Error: ", JSON.stringify(errInfo));
  } else {
    if (!isMismatch) {
      console.error(`Firestore Error [${operationType}] on [${path2}]:`, errMessage);
    }
  }
}
var PORT = 3e3;
var JWT_SECRET = process.env.JWT_SECRET || "simak-secret-key-2024";
var uploadDir = import_path.default.join(process.cwd(), "uploads");
if (!import_fs2.default.existsSync(uploadDir)) {
  import_fs2.default.mkdirSync(uploadDir);
}
var storage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = import_path.default.extname(file.originalname);
    cb(null, `${(0, import_uuid.v4)()}${ext}`);
  }
});
var upload = (0, import_multer.default)({ storage });
async function startServer() {
  const app = (0, import_express.default)();
  app.set("trust proxy", true);
  app.use((0, import_cors.default)({
    origin: (origin, callback) => callback(null, true),
    // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    credentials: true,
    maxAge: 86400
  }));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
    }
    console.log(`>>> [SERVER RECV] ${req.method} ${req.url}`);
    next();
  });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      const originalJson = res.json;
      res.json = function(body) {
        res.setHeader("Content-Type", "application/json");
        return originalJson.call(this, body);
      };
    }
    next();
  });
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "10mb" }));
  app.use("/uploads", import_express.default.static(uploadDir));
  const startupConfig = getFirebaseConfig();
  if (startupConfig?.projectId && startupConfig?.apiKey) {
    try {
      if (clientFirestore) {
        const q = (0, import_firestore2.query)((0, import_firestore2.collection)(clientFirestore, "users"), (0, import_firestore2.limit)(1));
        await (0, import_firestore2.getDocsFromServer)(q);
        console.log(`[STARTUP] Firestore verified (Client SDK) on: ${startupConfig.projectId}`);
      }
    } catch (err) {
      if (err.message.includes("permission-denied")) {
        console.error("[STARTUP] Firestore PERMISSION_DENIED. Check project permissions.");
      } else {
        console.error(`[STARTUP] Firestore check failed: ${err.message}`);
      }
    }
  }
  const authenticate = async (req, res, next) => {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token && req.query.token) {
      token = req.query.token;
    }
    if (!token) {
      return res.status(401).json({
        message: "Login diperlukan (Token tidak ditemukan)",
        error: "NO_TOKEN"
      });
    }
    try {
      try {
        const decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
        const userProfile = db_default.prepare("SELECT * FROM users WHERE id = ? OR no_anggota = ?").get(decoded.id, decoded.no_anggota);
        if (userProfile) {
          req.user = {
            id: userProfile.id,
            no_anggota: userProfile.no_anggota,
            role: userProfile.role,
            wilayah: userProfile.wilayah,
            nama_lengkap: userProfile.nama_lengkap,
            extra_email: userProfile.email
          };
        } else {
          req.user = decoded;
        }
        console.log(`[AUTH OK] Standard JWT for ${req.user.nama_lengkap || req.user.id}`);
        return next();
      } catch (jwtErr) {
      }
      if (token.length > 500) {
        try {
          if (!auth) throw new Error("Firebase Auth service not initialized");
          const decodedToken = await auth.verifyIdToken(token);
          const email = decodedToken.email?.toLowerCase();
          console.log(`[AUTH] Firebase token verified for: ${email || decodedToken.uid}`);
          let userProfile = db_default.prepare("SELECT * FROM users WHERE id = ? OR email = ?").get(decodedToken.uid, email);
          if (userProfile) {
            req.user = {
              id: userProfile.id || decodedToken.uid,
              no_anggota: userProfile.no_anggota,
              role: userProfile.role,
              wilayah: userProfile.wilayah,
              nama_lengkap: userProfile.nama_lengkap || decodedToken.name || "User",
              extra_email: email
            };
          } else {
            req.user = {
              id: decodedToken.uid,
              email,
              no_anggota: "G-" + decodedToken.uid.substring(0, 5),
              role: email && email === "asp.onshop@gmail.com" ? "ADMIN" : "PAC",
              wilayah: "PUSAT",
              nama_lengkap: decodedToken.name || "Firebase Guest",
              extra_email: email
            };
          }
          return next();
        } catch (firebaseErr) {
          console.log(`[AUTH] Firebase verification failed: ${firebaseErr.message}`);
        }
      }
      console.error("[AUTH FAIL] All token checks failed.");
      return res.status(401).json({
        message: "Sesi tidak valid. Silakan login kembali.",
        error: "INVALID_TOKEN"
      });
    } catch (err) {
      console.error("[AUTH CRASH]", err);
      res.status(500).json({ message: "Sistem otentikasi bermasalah." });
    }
  };
  const isAdmin = (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Otorisasi diperlukan." });
    }
    const allowedRoles = ["ADMIN", "DPP"];
    if (!allowedRoles.includes(req.user.role)) {
      console.log(`[AUTH DENIED] User: ${req.user.id}, Role: ${req.user.role}, Attempt: ${req.method} ${req.path}`);
      return res.status(403).json({
        message: "Akses ditolak. Tindakan ini memerlukan hak akses Admin atau Pengurus Pusat (DPP).",
        currentRole: req.user.role,
        requiredRoles: allowedRoles
      });
    }
    next();
  };
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      firestore: firestore ? "initialized" : "null",
      projectId: firebaseAdminApp?.options?.projectId || "Default (ADC)",
      configMatchesEnv: firebaseConfig?.projectId === firebaseAdminApp?.options?.projectId
    });
  });
  app.get("/api/admin/diagnose", authenticate, isAdmin, async (req, res) => {
    const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
    const freshConfig = import_fs2.default.existsSync(configPath) ? JSON.parse(import_fs2.default.readFileSync(configPath, "utf8")) : {};
    let authStatus = "working";
    let firestoreStatus = "working";
    let authErrorDetails = null;
    let firestoreErrorDetails = null;
    try {
      if (auth) {
        await auth.listUsers(1);
      } else {
        throw new Error("Auth service initialized is null");
      }
    } catch (err) {
      const msg = err.message || "";
      const isMismatch = msg.includes("643827784442") || msg.toLowerCase().includes("permission");
      authStatus = isMismatch ? "ADMIN_API_LIMITATION" : `ERROR: ${msg}`;
      authErrorDetails = {
        message: isMismatch ? "Admin SDK is restricted or mismatching with the Host project ID (643827784442). This is an infrastructure limitation in the sandbox. Users can still login using the Client SDK, but Admin user management via Admin SDK may be limited." : msg,
        code: err.code,
        url: msg.includes("http") ? msg.match(/https?:\/\/[^\s]+/)?.[0] : null
      };
      if (!isMismatch) {
        console.error("[DIAGNOSE] Auth check failed:", msg);
      }
    }
    try {
      if (clientFirestore) {
        const q = (0, import_firestore2.query)((0, import_firestore2.collection)(clientFirestore, "test_connectivity"), (0, import_firestore2.limit)(1));
        await (0, import_firestore2.getDocsFromServer)(q);
        firestoreStatus = "working";
      } else if (firestore) {
        await firestore.collection("users").limit(1).get();
        firestoreStatus = "working";
      } else {
        firestoreStatus = "NOT_INITIALIZED";
      }
    } catch (err) {
      const msg = err.message || "";
      const lowMsg = msg.toLowerCase();
      if (lowMsg.includes("permission") || lowMsg.includes("missing or insufficient")) {
        firestoreStatus = "working";
      } else if (lowMsg.includes("643827784442")) {
        firestoreStatus = "ADMIN_API_LIMITATION";
        firestoreErrorDetails = {
          message: "Firestore Admin SDK is mismatching with Host project. Client connectivity should still be fine.",
          code: err.code
        };
      } else {
        console.error("[DIAGNOSE] Firestore connectivity failed:", msg);
        firestoreStatus = `ERROR: ${msg}`;
        firestoreErrorDetails = {
          message: msg,
          code: err.code
        };
      }
    }
    res.json({
      authStatus,
      firestoreStatus,
      authErrorDetails,
      firestoreErrorDetails,
      firebaseAdmin: {
        projectId: firebaseAdminApp?.options?.projectId || "NOT_INITIALIZED",
        appsCount: import_firebase_admin.default.apps.length,
        initializedWith: freshConfig?.projectId
      },
      clientConfig: {
        projectId: freshConfig.projectId,
        databaseId: freshConfig.firestoreDatabaseId
      },
      environment: {
        googleProject: process.env.GOOGLE_CLOUD_PROJECT || "unknown",
        nodeEnv: process.env.NODE_ENV
      }
    });
  });
  app.use((req, res, next) => {
    next();
  });
  app.get("/api/auth/me", authenticate, (req, res) => {
    res.json(req.user);
  });
  app.post("/api/auth/sync", authenticate, async (req, res) => {
    const { user } = req;
    try {
      const existing = db_default.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      if (!existing) {
        console.log(`[AUTH SYNC] New user detected, creating SQLite profile for ${user.id}`);
        db_default.prepare("INSERT INTO users (id, no_anggota, email, nama_lengkap, role, wilayah) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, user.no_anggota, user.extra_email || null, user.nama_lengkap, user.role || "PAC", user.wilayah || "PUSAT");
      } else {
        db_default.prepare("UPDATE users SET nama_lengkap = ?, role = ?, wilayah = ? WHERE id = ?").run(user.nama_lengkap, user.role, user.wilayah, user.id);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[AUTH SYNC ERROR]", err);
      res.status(500).json({ message: "Gagal menyinkronkan profil." });
    }
  });
  app.post("/api/login", async (req, res) => {
    const { no_anggota, password } = req.body;
    console.log(`[LOGIN ATTEMPT] No. Anggota: ${no_anggota}`);
    if (!no_anggota || !password) {
      return res.status(400).json({ message: "No. Anggota and Password are required" });
    }
    try {
      const user = db_default.prepare("SELECT * FROM users WHERE no_anggota = ?").get(no_anggota);
      if (!user) {
        console.log(`[LOGIN FAILED] User not found: ${no_anggota}`);
        return res.status(401).json({ message: "User tidak ditemukan" });
      }
      const validPassword = import_bcryptjs.default.compareSync(password, user.password);
      if (!validPassword) {
        console.log(`[LOGIN FAILED] Wrong password for user: ${no_anggota}`);
        return res.status(401).json({ message: "Password salah" });
      }
      console.log(`[LOGIN SUCCESS] User ${no_anggota} authenticated, generating tokens...`);
      const token = import_jsonwebtoken.default.sign(
        {
          id: user.id,
          no_anggota: user.no_anggota,
          role: user.role,
          wilayah: user.wilayah,
          nama_lengkap: user.nama_lengkap,
          type: "standard"
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      res.json({
        token,
        user: {
          id: user.id,
          no_anggota: user.no_anggota,
          role: user.role,
          wilayah: user.wilayah,
          nama_lengkap: user.nama_lengkap
        }
      });
    } catch (err) {
      console.error("Login creation error:", err);
      res.status(500).json({ message: "Gagal membuat sesi login." });
    }
  });
  app.post("/api/admin/firebase-config", authenticate, isAdmin, async (req, res) => {
    const { config } = req.body;
    try {
      const parsed = typeof config === "string" ? JSON.parse(config) : config;
      if (!parsed.projectId) {
        return res.status(400).json({ message: "Konfigurasi tidak valid. Pastikan ada projectId." });
      }
      import_fs2.default.writeFileSync(import_path.default.join(process.cwd(), "firebase-applet-config.json"), JSON.stringify(parsed, null, 2));
      try {
        refreshFirebaseServices();
        console.log("[CONFIG] Firebase/Firestore services re-initialized with new project config.");
      } catch (reInitErr) {
        console.error("[CONFIG] Re-initialization failed:", reInitErr.message);
      }
      res.json({ success: true, message: "Konfigurasi disimpan dan layanan diperbarui." });
    } catch (err) {
      res.status(400).json({ message: "Format JSON tidak valid." });
    }
  });
  app.get("/api/users", authenticate, isAdmin, async (req, res) => {
    try {
      const users = db_default.prepare("SELECT id, no_anggota, email, nama_lengkap, role, wilayah, created_at FROM users").all();
      const usersWithStatus = await Promise.all(users.map(async (u) => {
        let synced = false;
        if (u.email && u.id.length > 20 && auth) {
          try {
            const fbUser = await auth.getUser(u.id);
            synced = !!fbUser;
          } catch (e) {
            const msg = e.message || "";
            if (msg.includes("643827784442") || msg.toLowerCase().includes("permission")) {
              synced = "UNKNOWN (LIMIT)";
            } else {
              synced = false;
            }
          }
        }
        return { ...u, firebase_synced: synced };
      }));
      res.json(usersWithStatus);
    } catch (err) {
      console.error("[USER GET ERROR]", err);
      res.status(500).json({ message: "Gagal mengambil data pengguna" });
    }
  });
  app.post("/api/users", authenticate, isAdmin, async (req, res) => {
    const { no_anggota, email, nama_lengkap, password, role, wilayah } = req.body;
    console.log(`[USER CREATE] Attempting to create user: ${no_anggota} (${email})`);
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter." });
    }
    const hashedPassword = import_bcryptjs.default.hashSync(password, 10);
    const cleanEmail = email && email.trim() !== "" ? email.trim() : null;
    const cleanNoAnggota = no_anggota && no_anggota.trim() !== "" ? no_anggota.trim() : null;
    try {
      const existing = db_default.prepare("SELECT * FROM users WHERE (no_anggota = ? AND ? IS NOT NULL) OR (email = ? AND ? IS NOT NULL)").get(cleanNoAnggota, cleanNoAnggota, cleanEmail, cleanEmail);
      if (existing) {
        console.log(`[USER CREATE FAILED] Conflict: ${cleanNoAnggota} / ${cleanEmail}`);
        return res.status(400).json({ message: "No. Anggota atau Email sudah terdaftar." });
      }
      let firebaseUid = (0, import_uuid.v4)();
      let fbCreated = false;
      if (cleanEmail && auth) {
        try {
          const userRecord = await auth.createUser({
            email: cleanEmail,
            password,
            displayName: nama_lengkap
          });
          firebaseUid = userRecord.uid;
          fbCreated = true;
          console.log(`[USER CREATE] Firebase account created: ${firebaseUid}`);
        } catch (fbAuthErr) {
          console.error("[FIREBASE AUTH ERROR] Failed to create user:", fbAuthErr.message);
          if (fbAuthErr.message.includes("identitytoolkit.googleapis.com") || fbAuthErr.code === "auth/internal-error") {
            console.error("CRITICAL: Identity Toolkit API is disabled in this Google Cloud Project.");
            return res.status(500).json({
              message: "Sistem Otentikasi (Firebase) belum aktif di proyek ini. Admin harus mengaktifkan 'Identity Toolkit API' di Google Cloud Console.",
              error: "FIREBASE_API_DISABLED",
              helpUrl: `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${firebaseAdminApp?.options?.projectId || "805555714202"}`
            });
          }
          if (fbAuthErr.code === "auth/email-already-exists") {
            return res.status(400).json({ message: "Email sudah terdaftar di Firebase." });
          }
          console.warn("[USER CREATE] Proceeding with SQLite only due to Firebase Auth error.");
        }
      } else if (!cleanNoAnggota) {
        return res.status(400).json({ message: "Harus mencantumkan Email atau No. Anggota" });
      }
      db_default.prepare("INSERT INTO users (id, no_anggota, email, nama_lengkap, password, role, wilayah) VALUES (?, ?, ?, ?, ?, ?, ?)").run(firebaseUid, cleanNoAnggota, cleanEmail, nama_lengkap, hashedPassword, role, wilayah);
      if (fbCreated && auth) {
        await auth.setCustomUserClaims(firebaseUid, { role, wilayah }).catch((e) => console.error("Claim set failed", e.message));
      }
      try {
        if (firestore) {
          await firestore.collection("users").doc(firebaseUid).set({
            no_anggota: cleanNoAnggota,
            email: cleanEmail,
            nama_lengkap,
            role,
            wilayah,
            created_at: import_firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUid}`, req.user?.id);
      }
      console.log(`[USER CREATE SUCCESS] Created ${firebaseUid}`);
      res.json({ success: true, id: firebaseUid });
    } catch (err) {
      console.error("[USER CREATE CRASH]", err);
      res.status(500).json({ message: err.message || "Gagal menambah pengguna." });
    }
  });
  app.delete("/api/users/:id", authenticate, isAdmin, (req, res) => {
    try {
      console.log(`[USER DELETE] Attempting to delete user ID: ${req.params.id}`);
      const result = db_default.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      console.log(`[USER DELETE SUCCESS] Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (err) {
      console.error("[USER DELETE ERROR]", err);
      res.status(500).json({ message: "Gagal menghapus pengguna" });
    }
  });
  app.put("/api/users/:id", authenticate, isAdmin, (req, res) => {
    const { no_anggota, nama_lengkap, password, role, wilayah } = req.body;
    try {
      console.log(`[USER UPDATE] ID: ${req.params.id}, No: ${no_anggota}, Name: ${nama_lengkap}`);
      if (password && password.trim() !== "") {
        const hashedPassword = import_bcryptjs.default.hashSync(password, 10);
        db_default.prepare("UPDATE users SET no_anggota = ?, nama_lengkap = ?, password = ?, role = ?, wilayah = ? WHERE id = ?").run(no_anggota, nama_lengkap, hashedPassword, role, wilayah, req.params.id);
      } else {
        db_default.prepare("UPDATE users SET no_anggota = ?, nama_lengkap = ?, role = ?, wilayah = ? WHERE id = ?").run(no_anggota, nama_lengkap, role, wilayah, req.params.id);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[USER UPDATE ERROR]", err);
      res.status(400).json({ message: err.message });
    }
  });
  app.get("/api/permissions", authenticate, (req, res) => {
    const perms = db_default.prepare("SELECT * FROM permissions").all();
    res.json(perms);
  });
  app.post("/api/permissions", authenticate, isAdmin, (req, res) => {
    const { role, menu_key, is_allowed } = req.body;
    db_default.prepare("INSERT OR REPLACE INTO permissions (role, menu_key, is_allowed) VALUES (?, ?, ?)").run(role, menu_key, is_allowed ? 1 : 0);
    res.json({ success: true });
  });
  app.get("/api/members", authenticate, (req, res) => {
    const members = db_default.prepare("SELECT * FROM members").all();
    res.json(members);
  });
  app.get("/api/members/export", authenticate, async (req, res) => {
    const { role, wilayah: userWilayah } = req.user;
    const { pengurus, wilayah, format } = req.query;
    if ((format === "xlsx" || format === "docx" || !format) && (role !== "ADMIN" && role !== "DPP")) {
      return res.status(403).json({ message: "Hanya Admin dan DPP yang dapat mengekspor format ini. Silakan gunakan format PDF." });
    }
    let query = "SELECT no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, status FROM members WHERE 1=1";
    let params = [];
    if (pengurus && pengurus !== "ALL") {
      query += " AND pengurus = ?";
      params.push(pengurus);
    }
    if (wilayah && wilayah !== "ALL") {
      query += " AND wilayah = ?";
      params.push(wilayah);
    }
    const members = db_default.prepare(query).all(...params);
    const orgName = db_default.prepare("SELECT value FROM config WHERE key = 'orgName'").get()?.value || "SIMAK";
    let logoConfig = db_default.prepare("SELECT value FROM config WHERE key = 'exportLogoUrl'").get();
    if (!logoConfig || !logoConfig.value) {
      logoConfig = db_default.prepare("SELECT value FROM config WHERE key = 'logoUrl'").get();
    }
    const logoUrl = logoConfig?.value;
    const logoPath = logoUrl && logoUrl.startsWith("/uploads/") ? import_path.default.join(process.cwd(), logoUrl) : null;
    if (format === "docx") {
      const children = [];
      if (logoPath && import_fs2.default.existsSync(logoPath)) {
        children.push(new import_docx.Paragraph({
          alignment: import_docx.AlignmentType.LEFT,
          children: [
            new import_docx.ImageRun({
              data: import_fs2.default.readFileSync(logoPath),
              transformation: { width: 80, height: 80 },
              type: "png"
            })
          ]
        }));
      }
      children.push(
        new import_docx.Paragraph({
          alignment: import_docx.AlignmentType.CENTER,
          children: [
            new import_docx.TextRun({ text: orgName, bold: true, size: 32 })
          ]
        }),
        new import_docx.Paragraph({
          alignment: import_docx.AlignmentType.CENTER,
          children: [
            new import_docx.TextRun({ text: "DATA ANGGOTA ORGANISASI", bold: true, size: 24 })
          ]
        }),
        new import_docx.Paragraph({ text: "" }),
        // spacer
        new import_docx.Table({
          width: { size: 100, type: import_docx.WidthType.PERCENTAGE },
          rows: [
            new import_docx.TableRow({
              children: [
                "No Anggota",
                "Nama",
                "Wilayah",
                "Jabatan",
                "Status"
              ].map((h) => new import_docx.TableCell({
                children: [new import_docx.Paragraph({ children: [new import_docx.TextRun({ text: h, bold: true })] })],
                shading: { fill: "f0f0f0" }
              }))
            }),
            ...members.map((m) => new import_docx.TableRow({
              children: [
                m.no_anggota,
                m.nama_lengkap,
                m.wilayah,
                m.jabatan,
                m.status
              ].map((v) => new import_docx.TableCell({ children: [new import_docx.Paragraph({ text: String(v || "") })] }))
            }))
          ]
        })
      );
      const doc = new import_docx.Document({
        sections: [{
          properties: {},
          children
        }]
      });
      const buffer = await import_docx.Packer.toBuffer(doc);
      res.setHeader("Content-Disposition", 'attachment; filename="data_anggota.docx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      return res.send(buffer);
    } else {
      const workbook = new import_exceljs.default.Workbook();
      const worksheet = workbook.addWorksheet("Members");
      worksheet.columns = [
        { header: "No Anggota", key: "no_anggota", width: 20 },
        { header: "Nama Lengkap", key: "nama_lengkap", width: 30 },
        { header: "Wilayah", key: "wilayah", width: 20 },
        { header: "Jabatan", key: "jabatan", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Level", key: "pengurus", width: 15 },
        { header: "WhatsApp", key: "no_whatsapp", width: 20 }
      ];
      members.forEach((m) => worksheet.addRow(m));
      if (logoPath && import_fs2.default.existsSync(logoPath)) {
        try {
          const imageId = workbook.addImage({
            buffer: import_fs2.default.readFileSync(logoPath),
            extension: "png"
          });
          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 60, height: 60 }
          });
        } catch (e) {
          console.error("Failed to add image to excel", e);
        }
      }
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Disposition", 'attachment; filename="data_anggota.xlsx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    }
  });
  app.post("/api/members/import", authenticate, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      const stmt = db_default.prepare(`
        INSERT INTO members (id, no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, lain_lain, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const transaction = db_default.transaction((membersData) => {
        for (const row of membersData) {
          stmt.run(
            (0, import_uuid.v4)(),
            row.no_anggota || "",
            row.nik || "",
            row.nama_lengkap || "",
            row.alamat_lengkap || "",
            row.no_whatsapp || "",
            row.pengurus || "PAC",
            row.wilayah || req.user.wilayah,
            row.jabatan || "",
            row.seksi || "",
            row.lain_lain || "",
            row.status || "Aktif",
            req.user.id
          );
        }
      });
      transaction(data);
      import_fs2.default.unlinkSync(req.file.path);
      res.json({ success: true, count: data.length });
    } catch (err) {
      if (req.file) import_fs2.default.unlinkSync(req.file.path);
      res.status(400).json({ message: err.message });
    }
  });
  app.post("/api/members/bulk", authenticate, (req, res) => {
    const { members: membersData } = req.body;
    if (!membersData || !Array.isArray(membersData)) {
      return res.status(400).json({ message: "Data tidak valid" });
    }
    try {
      const stmt = db_default.prepare(`
        INSERT INTO members (id, no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, lain_lain, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const transaction = db_default.transaction((data) => {
        for (const row of data) {
          stmt.run(
            (0, import_uuid.v4)(),
            row.no_anggota || "",
            row.nik || "",
            row.nama_lengkap || "",
            row.alamat_lengkap || "",
            row.no_whatsapp || "",
            row.pengurus || "PAC",
            row.wilayah || req.user.wilayah,
            row.jabatan || "",
            row.seksi || "",
            row.lain_lain || "",
            row.status || "Aktif",
            req.user.id
          );
        }
      });
      transaction(membersData);
      res.json({ success: true, count: membersData.length });
    } catch (err) {
      console.error("[MEMBER BULK ERROR]", err);
      res.status(500).json({ message: err.message });
    }
  });
  app.post("/api/members", authenticate, upload.fields([{ name: "foto_profile" }, { name: "foto_ektp" }]), (req, res) => {
    const data = req.body;
    const { role } = req.user;
    console.log(`[MEMBER CREATE] Attempting to create member: ${data.nama_lengkap} by user ${req.user.id}`);
    if (data.pengurus === "DPP" && (role !== "ADMIN" && role !== "DPP")) {
      console.log(`[MEMBER CREATE FORBIDDEN] User ${req.user.id} role ${role} tried to add DPP member`);
      return res.status(403).json({ message: "Anda tidak memiliki hak akses untuk menambah pengurus pusat (DPP)." });
    }
    const files = req.files;
    const foto_profile_url = files?.foto_profile ? `/uploads/${files.foto_profile[0].filename}` : null;
    const foto_ektp_url = files?.foto_ektp ? `/uploads/${files.foto_ektp[0].filename}` : null;
    try {
      const cleanData = {
        no_anggota: data.no_anggota || null,
        nik: data.nik || null,
        nama_lengkap: data.nama_lengkap || null,
        alamat_lengkap: data.alamat_lengkap || null,
        no_whatsapp: data.no_whatsapp || null,
        pengurus: data.pengurus || "PAC",
        wilayah: data.wilayah || req.user.wilayah,
        jabatan: data.jabatan || "Anggota",
        seksi: data.seksi || null,
        lain_lain: data.lain_lain || null,
        status: data.status || "Aktif"
      };
      const memberId = (0, import_uuid.v4)();
      db_default.prepare(`
        INSERT INTO members (id, no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, lain_lain, foto_profile_url, foto_ektp_url, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberId,
        cleanData.no_anggota,
        cleanData.nik,
        cleanData.nama_lengkap,
        cleanData.alamat_lengkap,
        cleanData.no_whatsapp,
        cleanData.pengurus,
        cleanData.wilayah,
        cleanData.jabatan,
        cleanData.seksi,
        cleanData.lain_lain,
        foto_profile_url,
        foto_ektp_url,
        cleanData.status,
        req.user.id
      );
      console.log(`[MEMBER CREATE SUCCESS] ID: ${memberId}`);
      res.json({ success: true, id: memberId });
    } catch (err) {
      console.error("[MEMBER CREATE ERROR]", err);
      res.status(400).json({ message: err.message });
    }
  });
  app.put("/api/members/:id", authenticate, upload.fields([{ name: "foto_profile" }, { name: "foto_ektp" }]), (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const { role } = req.user;
    const existingMember = db_default.prepare("SELECT * FROM members WHERE id = ?").get(id);
    if (!existingMember) return res.status(404).json({ message: "Member not found" });
    if ((existingMember.pengurus === "DPP" || data.pengurus === "DPP") && (role !== "ADMIN" && role !== "DPP")) {
      return res.status(403).json({ message: "Anda tidak memiliki hak akses untuk mengubah data pengurus pusat (DPP)." });
    }
    const files = req.files;
    let foto_profile_url = existingMember.foto_profile_url;
    let foto_ektp_url = existingMember.foto_ektp_url;
    if (files.foto_profile) foto_profile_url = `/uploads/${files.foto_profile[0].filename}`;
    if (files.foto_ektp) foto_ektp_url = `/uploads/${files.foto_ektp[0].filename}`;
    try {
      db_default.prepare(`
        UPDATE members SET 
          no_anggota = ?, nik = ?, nama_lengkap = ?, alamat_lengkap = ?, no_whatsapp = ?, 
          pengurus = ?, wilayah = ?, jabatan = ?, seksi = ?, lain_lain = ?, 
          foto_profile_url = ?, foto_ektp_url = ?, status = ?
        WHERE id = ?
      `).run(
        data.no_anggota,
        data.nik,
        data.nama_lengkap,
        data.alamat_lengkap,
        data.no_whatsapp,
        data.pengurus,
        data.wilayah,
        data.jabatan,
        data.seksi,
        data.lain_lain,
        foto_profile_url,
        foto_ektp_url,
        data.status,
        id
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  app.get("/api/finance", authenticate, (req, res) => {
    const { role, wilayah } = req.user;
    let query = "SELECT * FROM finance";
    let params = [];
    if (role !== "ADMIN" && role !== "DPP") {
      query += " WHERE role = ? AND wilayah = ?";
      params.push(role, wilayah);
    }
    const transactions = db_default.prepare(query).all(...params);
    res.json(transactions);
  });
  app.post("/api/finance", authenticate, (req, res) => {
    const { tanggal, jenis, nominal, keterangan } = req.body;
    try {
      db_default.prepare(`
        INSERT INTO finance (id, tanggal, jenis, nominal, keterangan, operator, role, wilayah)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run((0, import_uuid.v4)(), tanggal, jenis, nominal, keterangan, req.user.nama_lengkap, req.user.role, req.user.wilayah);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  app.delete("/api/finance/:id", authenticate, (req, res) => {
    try {
      console.log(`[FINANCE DELETE] Attempting to delete id: ${req.params.id} by user ${req.user.id}`);
      const result = db_default.prepare("DELETE FROM finance WHERE id = ?").run(req.params.id);
      console.log(`[FINANCE DELETE SUCCESS] Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (err) {
      console.error("[FINANCE DELETE ERROR]", err);
      res.status(500).json({ message: "Gagal menghapus data keuangan" });
    }
  });
  app.get("/api/config", (req, res) => {
    const config = db_default.prepare("SELECT * FROM config").all();
    const result = config.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(result);
  });
  app.post("/api/config", authenticate, isAdmin, (req, res) => {
    const updates = req.body;
    try {
      const stmt = db_default.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
      const transaction = db_default.transaction((data) => {
        for (const [key, value] of Object.entries(data)) {
          stmt.run(key, value);
        }
      });
      transaction(updates);
      console.log(`[CONFIG UPDATE] Successful by user ${req.user?.id || "unknown"}`);
      res.json({ success: true });
    } catch (err) {
      console.error("[CONFIG UPDATE ERROR]", err);
      res.status(500).json({ message: "Gagal menyimpan konfigurasi" });
    }
  });
  app.post("/api/config/logo", authenticate, isAdmin, upload.single("logo"), (req, res) => {
    console.log(`[LOGO UPLOAD] Start. User: ${req.user.id}, Role: ${req.user.role}`);
    if (!req.file) {
      console.log(`[LOGO UPLOAD FAILED] No file in request`);
      return res.status(400).json({ message: "File logo tidak ditemukan dalam permintaan." });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    const type = req.body.type || "main";
    const key = type === "export" ? "exportLogoUrl" : "logoUrl";
    console.log(`[LOGO UPLOAD] Success. Path: ${logoUrl}, Type: ${type}, Key: ${key}`);
    try {
      db_default.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, logoUrl);
      res.json({ success: true, logoUrl });
    } catch (err) {
      console.error("[LOGO UPLOAD DB ERROR]", err);
      res.status(500).json({ message: "Gagal menyimpan konfigurasi logo ke database." });
    }
  });
  app.post("/api/config/qris", authenticate, isAdmin, upload.single("qris"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "File gambar QRIS tidak ditemukan." });
    }
    const qrisUrl = `/uploads/${req.file.filename}`;
    try {
      db_default.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("qrisUrl", qrisUrl);
      res.json({ success: true, qrisUrl });
    } catch (err) {
      console.error("[QRIS UPLOAD DB ERROR]", err);
      res.status(500).json({ message: "Gagal menyimpan konfigurasi QRIS ke database." });
    }
  });
  app.get("/api/structure", (req, res) => {
    try {
      const structure = db_default.prepare(`
        SELECT 
          s.*, 
          m.foto_profile_url,
          m.wilayah as member_wilayah
        FROM structure s
        LEFT JOIN members m ON (
          (s.no_anggota IS NOT NULL AND m.no_anggota IS NOT NULL AND LOWER(TRIM(s.no_anggota)) = LOWER(TRIM(m.no_anggota)))
          OR 
          (s.no_anggota IS NULL AND LOWER(TRIM(s.nama_lengkap)) = LOWER(TRIM(m.nama_lengkap)))
        )
      `).all();
      res.json(structure);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  app.post("/api/structure", authenticate, isAdmin, (req, res) => {
    const { no_anggota, nama_lengkap, jabatan } = req.body;
    try {
      db_default.prepare("INSERT INTO structure (id, no_anggota, nama_lengkap, jabatan) VALUES (?, ?, ?, ?)").run((0, import_uuid.v4)(), no_anggota, nama_lengkap, jabatan);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  app.delete("/api/structure/:id", authenticate, isAdmin, (req, res) => {
    const result = db_default.prepare("DELETE FROM structure WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });
  app.put("/api/structure/:id", authenticate, isAdmin, (req, res) => {
    const { no_anggota, nama_lengkap, jabatan } = req.body;
    db_default.prepare("UPDATE structure SET no_anggota = ?, nama_lengkap = ?, jabatan = ? WHERE id = ?").run(no_anggota, nama_lengkap, jabatan, req.params.id);
    res.json({ success: true });
  });
  app.delete("/api/members/:id", authenticate, (req, res) => {
    const { role } = req.user;
    const { id } = req.params;
    console.log(`[MEMBER DELETE] Attempting to delete member id: ${id} by user ${req.user.id}`);
    try {
      const existingMember = db_default.prepare("SELECT * FROM members WHERE id = ?").get(id);
      if (!existingMember) {
        console.log(`[MEMBER DELETE FAILED] Not found: ${id}`);
        return res.status(404).json({ message: "Member not found" });
      }
      if (existingMember.pengurus === "DPP" && (role !== "ADMIN" && role !== "DPP")) {
        console.log(`[MEMBER DELETE FORBIDDEN] User ${req.user.id} role ${role} tried to delete DPP member`);
        return res.status(403).json({ message: "Anda tidak memiliki hak akses untuk menghapus data pengurus pusat (DPP)." });
      }
      const result = db_default.prepare("DELETE FROM members WHERE id = ?").run(id);
      console.log(`[MEMBER DELETE SUCCESS] Member ${id} deleted. Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (err) {
      console.error("[MEMBER DELETE ERROR]", err);
      res.status(500).json({ message: "Gagal menghapus anggota" });
    }
  });
  app.get("/api/admin/backup/db", authenticate, isAdmin, (req, res) => {
    const dbPath = import_path.default.join(process.cwd(), "simak.db");
    if (!import_fs2.default.existsSync(dbPath)) return res.status(404).json({ message: "Database file not found" });
    res.download(dbPath, `backup_db_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.db`);
  });
  app.post("/api/admin/restore/db", authenticate, isAdmin, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const dbPath = import_path.default.join(process.cwd(), "simak.db");
    try {
      import_fs2.default.copyFileSync(req.file.path, dbPath);
      import_fs2.default.unlinkSync(req.file.path);
      res.json({ success: true, message: "Pangkalan data berhasil dipulihkan. Sistem akan memulai ulang." });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  app.get("/api/admin/backup/full", authenticate, isAdmin, async (req, res) => {
    try {
      const zip = new import_adm_zip.default();
      const dbPath = import_path.default.join(process.cwd(), "simak.db");
      if (import_fs2.default.existsSync(dbPath)) zip.addLocalFile(dbPath);
      if (import_fs2.default.existsSync(uploadDir)) zip.addLocalFolder(uploadDir, "uploads");
      const buffer = zip.toBuffer();
      res.setHeader("Content-Disposition", `attachment; filename="backup_full_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.zip"`);
      res.setHeader("Content-Type", "application/zip");
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  app.post("/api/admin/restore/full", authenticate, isAdmin, upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const zip = new import_adm_zip.default(req.file.path);
      zip.extractAllTo(process.cwd(), true);
      import_fs2.default.unlinkSync(req.file.path);
      res.json({ success: true, message: "Pemulihan penuh berhasil. Sistem akan memulai ulang." });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  app.get("/api/admin/export/tables", authenticate, isAdmin, (req, res) => {
    try {
      const tables = ["users", "members", "finance", "config", "structure", "permissions"];
      const data = {};
      for (const table of tables) {
        data[table] = db_default.prepare(`SELECT * FROM ${table}`).all();
      }
      res.setHeader("Content-Disposition", `attachment; filename="data_export_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(data, null, 2));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  app.post("/api/admin/import/tables", authenticate, isAdmin, (req, res) => {
    const data = req.body;
    try {
      db_default.transaction(() => {
        for (const [table, rows] of Object.entries(data)) {
          if (!Array.isArray(rows)) continue;
          if (!["users", "members", "finance", "config", "structure", "permissions"].includes(table)) continue;
          db_default.prepare(`DELETE FROM ${table}`).run();
          if (rows.length === 0) continue;
          const keys = Object.keys(rows[0]);
          const placeholders = keys.map(() => "?").join(",");
          const stmt = db_default.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${placeholders})`);
          for (const row of rows) {
            const values = keys.map((k) => row[k]);
            stmt.run(...values);
          }
        }
      })();
      res.json({ success: true, message: "Impor tabel berhasil dilakukan." });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  const seedUser = (id, no, name, pass, role, vil) => {
    try {
      const existing = db_default.prepare("SELECT * FROM users WHERE no_anggota = ?").get(no);
      if (!existing) {
        const hashedPassword = import_bcryptjs.default.hashSync(pass, 10);
        db_default.prepare("INSERT INTO users (id, no_anggota, nama_lengkap, password, role, wilayah) VALUES (?, ?, ?, ?, ?, ?)").run(id, no, name, hashedPassword, role, vil);
        console.log(`[SEED] Created user ${no}`);
      } else {
        const hashedPassword = import_bcryptjs.default.hashSync(pass, 10);
        db_default.prepare("UPDATE users SET password = ?, role = ?, wilayah = ?, nama_lengkap = ? WHERE no_anggota = ?").run(hashedPassword, role, vil, name, no);
        console.log(`[SEED] Updated user ${no}`);
        id = existing.id;
      }
      if (firestore && firebaseConfig?.projectId && firebaseConfig?.apiKey) {
        firestore.collection("users").doc(id).set({
          no_anggota: no,
          nama_lengkap: name,
          role,
          wilayah: vil,
          created_at: import_firestore.FieldValue.serverTimestamp()
        }).catch((e) => {
          if (!e.message.includes("PERMISSION_DENIED")) {
            console.log(`[SEED FS] Failed to sync ${no}: ${e.message}`);
          }
        });
      }
    } catch (err) {
      console.error(`[SEED ERROR] Failed for ${no}:`, err.message);
    }
  };
  seedUser((0, import_uuid.v4)(), "admin", "Admin System", "Anggra09", "ADMIN", "PUSAT");
  seedUser((0, import_uuid.v4)(), "alif", "Alif User", "password123", "PAC", "PUSAT");
  const configExists = db_default.prepare("SELECT count(*) as count FROM config WHERE key = 'orgName'").get();
  if (configExists.count === 0) {
    db_default.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("orgName", "SIMO - SISTEM INFORMASI MANAJEMEN ORGANISASI");
    db_default.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("logoUrl", "");
  }
  app.use((err, req, res, next) => {
    console.error("Server Internal Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        message: err.message || "Internal Server Error",
        stack: process.env.NODE_ENV === "development" ? err.stack : void 0
      });
    }
  });
  app.all("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[404] API NOT FOUND: ${req.method} ${req.path}`);
      res.setHeader("Content-Type", "application/json");
      return res.status(404).json({
        status: "error",
        message: `Route ${req.method} ${req.path} tidak ditemukan di server.`
      });
    }
    next();
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.use((err, req, res, next) => {
    console.error("Server Error:", err);
    res.status(500).json({ message: err.message || "Internal Server Error" });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Critical failure during server startup:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
