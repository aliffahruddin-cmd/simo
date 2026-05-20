import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import db from "./db.ts";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import AdmZip from "adm-zip";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType } from "docx";

import admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { initializeApp as initializeClientApp, getApp, getApps, deleteApp } from "firebase/app";
import { getFirestore as getClientFirestore, initializeFirestore as initializeClientFirestore, collection as clientCollection, getDocsFromServer as clientGetDocs, limit as clientLimit, query as clientQuery, setLogLevel } from "firebase/firestore";
import { getAuth as getClientAuth } from "firebase/auth";

// Silence noisy background logs from Client SDK on server
setLogLevel("error");

// Load Firebase Config
const getFirebaseConfig = () => {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
};
const firebaseConfig = getFirebaseConfig();

// Initialize Firebase Admin
let firebaseAdminApp: admin.app.App;

function initFirebase() {
  const config = getFirebaseConfig();
  if (!config) {
    console.error("[FIREBASE] Config file not found.");
    return;
  }
  
  const targetProjectId = config.projectId;
  
  try {
    // 1. Try to find if we already have an app with this project ID
    const existingApp = admin.apps.find(a => a?.options.projectId === targetProjectId);
    
    if (existingApp) {
      firebaseAdminApp = existingApp;
      console.log(`[FIREBASE] Reusing existing admin app for: ${targetProjectId}`);
    } else {
      // 2. If not, we initialize a new one. 
      // We use a unique name if the default app is already taken by a different project
      const hasDefaultApp = admin.apps.length > 0 && admin.apps.find(a => a?.name === "[DEFAULT]");
      const useDefault = !hasDefaultApp || (admin.app().options.projectId === targetProjectId);
      
      if (useDefault) {
        console.log(`[FIREBASE] Initializing DEFAULT admin app for: ${targetProjectId}`);
        firebaseAdminApp = admin.initializeApp({
          projectId: targetProjectId
        });
      } else {
        const name = `app-${targetProjectId}-${Date.now()}`;
        console.log(`[FIREBASE] Initializing NAMED admin app [${name}] for: ${targetProjectId}`);
        firebaseAdminApp = admin.initializeApp({
          projectId: targetProjectId
        }, name);
      }
    }
    
    // Always set this to help other GCP SDKs if they are used implicitly
    process.env.GOOGLE_CLOUD_PROJECT = targetProjectId;
    console.log(`[FIREBASE] Admin active project: ${firebaseAdminApp?.options?.projectId}`);
  } catch (e: any) {
    console.error("[FIREBASE] Admin Init error:", e.message);
    // Fallback to whatever is available
    if (!firebaseAdminApp && admin.apps.length > 0) {
      firebaseAdminApp = admin.app();
    }
  }
}
initFirebase();

// Initialize Client SDK on Server (to bypass ADC project mismatch issues for specific tests)
let clientApp: any;
let clientFirestore: any;
function initClientFirebase() {
    const config = getFirebaseConfig();
    if (!config) return;
    try {
        const apps = getApps();
        if (apps.length > 0) {
            clientApp = apps.find(a => a.name === "[DEFAULT]") || apps[0];
        } else {
            clientApp = initializeClientApp(config);
        }
        
        // Use initializeFirestore with forceLongPolling to resolve connection issues in restricted environments
        clientFirestore = initializeClientFirestore(clientApp, {
            experimentalForceLongPolling: true,
        }, config.firestoreDatabaseId);
        
        console.log(`[FIREBASE] Client SDK initialized for project: ${config.projectId}`);
    } catch (e: any) {
        console.error("[FIREBASE] Client SDK Init error:", e.message);
    }
}
initClientFirebase();

// Proxies for auth and firestore to ensure they always use the latest firebaseAdminApp
const getAuthService = () => firebaseAdminApp ? getAuth(firebaseAdminApp) : null;
const getFirestoreService = () => {
    if (!firebaseAdminApp) return null;
    const config = getFirebaseConfig();
    const dbId = (config?.firestoreDatabaseId && config?.firestoreDatabaseId !== "(default)") ? config.firestoreDatabaseId : undefined;
    
    // If using named app, we must pass it to getFirestore
    return getFirestore(firebaseAdminApp, dbId);
};

// Initial services
let auth = getAuthService();
let firestore = getFirestoreService();

// Function to refresh all services if config changes
function refreshFirebaseServices() {
    initFirebase();
    initClientFirebase();
    auth = getAuthService();
    firestore = getFirestoreService();
}

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

type OperationType = (typeof OperationType)[keyof typeof OperationType];

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  // Silence gRPC noise entirely (especially on server)
  const lowMsg = errMessage.toLowerCase();
  if (lowMsg.includes("cancelled") || lowMsg.includes("idle stream") || lowMsg.includes("timeout") || lowMsg.includes("waiting for new targets")) {
    return;
  }

  // Silence 404s (NOT_FOUND) as they are common and expected
  if (lowMsg.includes("not_found") || lowMsg.includes("no document")) {
    return;
  }

  const activeProjectId = firebaseAdminApp?.options?.projectId || "unknown";
  const isMismatch = errMessage.includes("643827784442") || (activeProjectId === "643827784442");

  const errInfo: any = {
    error: isMismatch 
      ? `PROJECT_MISMATCH: The Admin SDK is accessing Host Project (643827784442) instead of your project. This happens due to missing Service Account credentials in this sandbox. Client-side features will still work fine.` 
      : errMessage,
    operationType,
    path,
    activeProjectId,
    authInfo: {
      userId: userId || 'server',
    }
  };
  
  // If it's a permission denied, we log the JSON as requested
  if (lowMsg.includes("permission") || lowMsg.includes("insufficient permissions")) {
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
  } else {
    // Only log real connectivity issues
    if (!isMismatch) {
      console.error(`Firestore Error [${operationType}] on [${path}]:`, errMessage);
    }
  }
}

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "simak-secret-key-2024";

// Ensure upload directories exist
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

async function startServer() {
  const app = express();
  app.set("trust proxy", true);

  // 1. Permissive CORS (RELY ON THIS EXCLUSIVELY)
  app.use(cors({
    origin: (origin, callback) => callback(null, true), // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 86400
  }));

  // 2. Global logger and JSON enforcer
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
    }
    
    console.log(`>>> [SERVER RECV] ${req.method} ${req.url}`);
    next();
  });

  // Ensure JSON response for common status codes in /api
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const originalJson = res.json;
      res.json = function(body) {
        res.setHeader('Content-Type', 'application/json');
        return originalJson.call(this, body);
      };
    }
    next();
  });

  // 3. Body Parers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Static Uploads
  app.use("/uploads", express.static(uploadDir));

  // --- Start Listening NOW to avoid platform timeout ---
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Express instance listening on port ${PORT}`);
  });

  // Startup check for Firestore (Non-blocking)
  const startupConfig = getFirebaseConfig();
  if (startupConfig?.projectId && startupConfig?.apiKey) {
    (async () => {
      try {
        if (clientFirestore) {
          // Wrap in a timeout to ensure it doesn't hang the server indefinitely
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase check timeout")), 5000));
          
          const testDoc = clientCollection(clientFirestore, "health_check");
          const checkPromise = clientGetDocs(clientQuery(testDoc, clientLimit(1)));
          
          await Promise.race([checkPromise, timeoutPromise]);
          console.log(`[STARTUP] Firestore connectivity verified on: ${startupConfig.projectId}`);
        }
      } catch (err: any) {
        const msg = err.message || "";
        if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
          console.log(`[STARTUP] Firestore reached successfully (Access restricted as expected unauthenticated)`);
        } else {
          console.warn(`[STARTUP] Firestore check warning: ${msg}`);
        }
      }
    })();
  }

  // --- Auth Middleware ---
  const authenticate = async (req: any, res: any, next: any) => {
    let token = req.headers.authorization?.split(" ")[1];
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    
    if (!token) {
      return res.status(401).json({ 
        message: "Login diperlukan (Token tidak ditemukan)",
        error: "NO_TOKEN"
      });
    }

    try {
      // 1. Try Standard/Legacy JWT first (generated by our /api/login)
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Ensure we have the full user context for standard JWTs
        const userProfile = db.prepare("SELECT * FROM users WHERE id = ? OR no_anggota = ?").get(decoded.id, decoded.no_anggota) as any;
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
      } catch (jwtErr: any) {
        // Not a standard JWT, maybe it's a Firebase token?
      }

      // 2. Try Firebase Token - Only if it matches Firebase token structure (long and has kid claim usually)
      if (token.length > 500) {
        try {
          if (!auth) throw new Error("Firebase Auth service not initialized");
          const decodedToken = await auth.verifyIdToken(token);
          const email = decodedToken.email?.toLowerCase();
          
          console.log(`[AUTH] Firebase token verified for: ${email || decodedToken.uid}`);
          
          let userProfile = db.prepare("SELECT * FROM users WHERE id = ? OR email = ?").get(decodedToken.uid, email) as any;
          
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
                email: email,
                no_anggota: 'G-' + decodedToken.uid.substring(0, 5),
                role: (email && email === 'asp.onshop@gmail.com') ? 'ADMIN' : "PAC",
                wilayah: "PUSAT",
                nama_lengkap: decodedToken.name || "Firebase Guest",
                extra_email: email
            };
          }
          return next();
        } catch (firebaseErr: any) {
          console.log(`[AUTH] Firebase verification failed: ${firebaseErr.message}`);
        }
      }
      
      console.error("[AUTH FAIL] All token checks failed.");
      return res.status(401).json({ 
        message: "Sesi tidak valid. Silakan login kembali.",
        error: "INVALID_TOKEN"
      });
    } catch (err: any) {
      console.error("[AUTH CRASH]", err);
      res.status(500).json({ message: "Sistem otentikasi bermasalah." });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
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

  // --- Core API Routes (registered very early) ---
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      firestore: firestore ? "initialized" : "null",
      projectId: firebaseAdminApp?.options?.projectId || "Default (ADC)",
      configMatchesEnv: firebaseConfig?.projectId === firebaseAdminApp?.options?.projectId
    });
  });

  app.get("/api/admin/diagnose", authenticate, isAdmin, async (req: any, res) => {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const freshConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
    
    let authStatus = "working";
    let firestoreStatus = "working";
    let authErrorDetails: any = null;
    let firestoreErrorDetails: any = null;
    
    // Check Auth Admin API
    try {
      if (auth) {
        await auth.listUsers(1);
      } else {
        throw new Error("Auth service initialized is null");
      }
    } catch (err: any) {
      const msg = err.message || "";
      const isMismatch = msg.includes("643827784442") || msg.toLowerCase().includes("permission");
      
      authStatus = isMismatch ? "ADMIN_API_LIMITATION" : `ERROR: ${msg}`;
      authErrorDetails = {
        message: isMismatch 
          ? "Admin SDK is restricted or mismatching with the Host project ID (643827784442). This is an infrastructure limitation in the sandbox. Users can still login using the Client SDK, but Admin user management via Admin SDK may be limited."
          : msg,
        code: err.code,
        url: msg.includes("http") ? msg.match(/https?:\/\/[^\s]+/)?.[0] : null
      };

      if (!isMismatch) {
        console.error("[DIAGNOSE] Auth check failed:", msg);
      }
    }

    // Check Firestore (try Client SDK first for more reliable diagnosis in this environment)
    try {
      if (clientFirestore) {
        // We try to read a document. 
        // In the client SDK, if it reaches the rules engine and returns PERMISSION_DENIED, 
        // it means connection is WORKING but rules are enforced.
        const q = clientQuery(clientCollection(clientFirestore, "test_connectivity"), clientLimit(1));
        await clientGetDocs(q);
        firestoreStatus = "working";
      } else if (firestore) {
        await firestore.collection("users").limit(1).get();
        firestoreStatus = "working";
      } else {
        firestoreStatus = "NOT_INITIALIZED";
      }
    } catch (err: any) {
      const msg = err.message || "";
      const lowMsg = msg.toLowerCase();
      
      // If it's a permission error, it means we REACHED the server
      if (lowMsg.includes("permission") || lowMsg.includes("missing or insufficient")) {
          firestoreStatus = "working"; // Connectivity verified, but rules blocked the specific read
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
        appsCount: admin.apps.length,
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

  // --- Global Admin Override ---
  app.use((req: any, res, next) => {
    // If the token is already verified by authenticate (which runs per route), 
    // we want a global safety net to ensure certain emails are ALWAYS admin if present.
    // However, since authenticate hasn't run yet in global middleware, we'll keep the logic inside authenticate.
    next();
  });

  app.get("/api/auth/me", authenticate, (req: any, res) => {
    res.json(req.user);
  });

  // Auth routes (NOT duplicated)

  // --- Auth Sync ---
  app.post("/api/auth/sync", authenticate, async (req: any, res) => {
    const { user } = req;
    try {
      // Check if user exists in SQLite
      const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
      if (!existing) {
        console.log(`[AUTH SYNC] New user detected, creating SQLite profile for ${user.id}`);
        db.prepare("INSERT INTO users (id, no_anggota, email, nama_lengkap, role, wilayah) VALUES (?, ?, ?, ?, ?, ?)")
          .run(user.id, user.no_anggota, user.extra_email || null, user.nama_lengkap, user.role || 'PAC', user.wilayah || 'PUSAT');
      } else {
        // Update existing to keep in sync
        db.prepare("UPDATE users SET nama_lengkap = ?, role = ?, wilayah = ? WHERE id = ?")
          .run(user.nama_lengkap, user.role, user.wilayah, user.id);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[AUTH SYNC ERROR]", err);
      res.status(500).json({ message: "Gagal menyinkronkan profil." });
    }
  });

  // --- Auth Routes ---
  app.post("/api/login", async (req, res) => {
    const { no_anggota, password } = req.body;
    console.log(`[LOGIN ATTEMPT] No. Anggota: ${no_anggota}`);
    
    if (!no_anggota || !password) {
      return res.status(400).json({ message: "No. Anggota and Password are required" });
    }

    try {
      const user = db.prepare("SELECT * FROM users WHERE no_anggota = ?").get(no_anggota) as any;
      if (!user) {
        console.log(`[LOGIN FAILED] User not found: ${no_anggota}`);
        return res.status(401).json({ message: "User tidak ditemukan" });
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        console.log(`[LOGIN FAILED] Wrong password for user: ${no_anggota}`);
        return res.status(401).json({ message: "Password salah" });
      }

      console.log(`[LOGIN SUCCESS] User ${no_anggota} authenticated, generating tokens...`);
      
      // Standard JWT instead of Firebase Custom Token to bypass signBlob permission issues
      const token = jwt.sign(
        { 
          id: user.id, 
          no_anggota: user.no_anggota, 
          role: user.role, 
          wilayah: user.wilayah,
          nama_lengkap: user.nama_lengkap,
          type: 'standard'
        }, 
        JWT_SECRET, 
        { expiresIn: "24h" }
      );

      res.json({ 
        token: token, 
        user: { 
          id: user.id, 
          no_anggota: user.no_anggota, 
          role: user.role, 
          wilayah: user.wilayah, 
          nama_lengkap: user.nama_lengkap 
        } 
      });
    } catch (err: any) {
      console.error("Login creation error:", err);
      res.status(500).json({ message: "Gagal membuat sesi login." });
    }
  });

  // --- Config & Firebase Management ---
  app.post("/api/admin/firebase-config", authenticate, isAdmin, async (req: any, res) => {
    const { config } = req.body;
    try {
      const parsed = typeof config === 'string' ? JSON.parse(config) : config;
      if (!parsed.projectId) {
          return res.status(400).json({ message: "Konfigurasi tidak valid. Pastikan ada projectId." });
      }
      
      fs.writeFileSync(path.join(process.cwd(), "firebase-applet-config.json"), JSON.stringify(parsed, null, 2));
      
      // Re-initialize for immediate effect in this process
      try {
        refreshFirebaseServices();
        console.log("[CONFIG] Firebase/Firestore services re-initialized with new project config.");
      } catch (reInitErr: any) {
        console.error("[CONFIG] Re-initialization failed:", reInitErr.message);
      }
      
      res.json({ success: true, message: "Konfigurasi disimpan dan layanan diperbarui." });
    } catch (err: any) {
      res.status(400).json({ message: "Format JSON tidak valid." });
    }
  });

  app.get("/api/users", authenticate, isAdmin, async (req: any, res) => {
    try {
      const users = db.prepare("SELECT id, no_anggota, email, nama_lengkap, role, wilayah, created_at FROM users").all() as any[];
      
      // Check sync status for each user if Firebase is accessible
      const usersWithStatus = await Promise.all(users.map(async (u) => {
          let synced: boolean | string = false;
          if (u.email && u.id.length > 20 && auth) { // Looks like a real UUID/Firebase ID
              try {
                  const fbUser = await auth.getUser(u.id);
                  synced = !!fbUser;
              } catch (e: any) {
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
    } catch (err: any) {
      console.error("[USER GET ERROR]", err);
      res.status(500).json({ message: "Gagal mengambil data pengguna" });
    }
  });

  app.post("/api/users", authenticate, isAdmin, async (req: any, res) => {
    const { no_anggota, email, nama_lengkap, password, role, wilayah } = req.body;
    console.log(`[USER CREATE] Attempting to create user: ${no_anggota} (${email})`);
    
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const cleanEmail = (email && email.trim() !== "") ? email.trim() : null;
    const cleanNoAnggota = (no_anggota && no_anggota.trim() !== "") ? no_anggota.trim() : null;

    try {
      const existing = db.prepare("SELECT * FROM users WHERE (no_anggota = ? AND ? IS NOT NULL) OR (email = ? AND ? IS NOT NULL)").get(cleanNoAnggota, cleanNoAnggota, cleanEmail, cleanEmail) as any;
      if (existing) {
        console.log(`[USER CREATE FAILED] Conflict: ${cleanNoAnggota} / ${cleanEmail}`);
        return res.status(400).json({ message: "No. Anggota atau Email sudah terdaftar." });
      }

      let firebaseUid = uuidv4();
      let fbCreated = false;
      if (cleanEmail && auth) {
        try {
          const userRecord = await auth.createUser({
            email: cleanEmail,
            password: password,
            displayName: nama_lengkap,
          });
          firebaseUid = userRecord.uid;
          fbCreated = true;
          console.log(`[USER CREATE] Firebase account created: ${firebaseUid}`);
        } catch (fbAuthErr: any) {
          console.error("[FIREBASE AUTH ERROR] Failed to create user:", fbAuthErr.message);
          
          if (fbAuthErr.message.includes("identitytoolkit.googleapis.com") || fbAuthErr.code === "auth/internal-error") {
             console.error("CRITICAL: Identity Toolkit API is disabled in this Google Cloud Project.");
             // We return a specific error that the UI can catch to show instructions
             return res.status(500).json({ 
               message: "Sistem Otentikasi (Firebase) belum aktif di proyek ini. Admin harus mengaktifkan 'Identity Toolkit API' di Google Cloud Console.",
               error: "FIREBASE_API_DISABLED",
               helpUrl: `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${firebaseAdminApp?.options?.projectId || '805555714202'}`
             });
          }

          if (fbAuthErr.code === "auth/email-already-exists") {
            return res.status(400).json({ message: "Email sudah terdaftar di Firebase." });
          }
          // If it's a structural error (API disabled), continue with SQLite only
          console.warn("[USER CREATE] Proceeding with SQLite only due to Firebase Auth error.");
        }
      } else if (!cleanNoAnggota) {
        return res.status(400).json({ message: "Harus mencantumkan Email atau No. Anggota" });
      }

      db.prepare("INSERT INTO users (id, no_anggota, email, nama_lengkap, password, role, wilayah) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(firebaseUid, cleanNoAnggota, cleanEmail, nama_lengkap, hashedPassword, role, wilayah);

      if (fbCreated && auth) {
        await auth.setCustomUserClaims(firebaseUid, { role, wilayah }).catch(e => console.error("Claim set failed", e.message));
      }

      // Try Firestore sync, but don't fail if it doesn't work
      try {
        if (firestore) {
          await firestore.collection("users").doc(firebaseUid).set({
            no_anggota: cleanNoAnggota,
            email: cleanEmail,
            nama_lengkap,
            role,
            wilayah,
            created_at: FieldValue.serverTimestamp()
          });
        }
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUid}`, req.user?.id);
      }

      console.log(`[USER CREATE SUCCESS] Created ${firebaseUid}`);
      res.json({ success: true, id: firebaseUid });
    } catch (err: any) {
      console.error("[USER CREATE CRASH]", err);
      res.status(500).json({ message: err.message || "Gagal menambah pengguna." });
    }
  });

  app.delete("/api/users/:id", authenticate, isAdmin, (req: any, res) => {
    try {
      console.log(`[USER DELETE] Attempting to delete user ID: ${req.params.id}`);
      const result = db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
      console.log(`[USER DELETE SUCCESS] Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[USER DELETE ERROR]", err);
      res.status(500).json({ message: "Gagal menghapus pengguna" });
    }
  });

  app.put("/api/users/:id", authenticate, isAdmin, (req: any, res) => {
    const { no_anggota, nama_lengkap, password, role, wilayah } = req.body;
    try {
      console.log(`[USER UPDATE] ID: ${req.params.id}, No: ${no_anggota}, Name: ${nama_lengkap}`);
      if (password && password.trim() !== "") {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare("UPDATE users SET no_anggota = ?, nama_lengkap = ?, password = ?, role = ?, wilayah = ? WHERE id = ?")
          .run(no_anggota, nama_lengkap, hashedPassword, role, wilayah, req.params.id);
      } else {
        db.prepare("UPDATE users SET no_anggota = ?, nama_lengkap = ?, role = ?, wilayah = ? WHERE id = ?")
          .run(no_anggota, nama_lengkap, role, wilayah, req.params.id);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[USER UPDATE ERROR]", err);
      res.status(400).json({ message: err.message });
    }
  });

  // --- Permissions Management ---
  app.get("/api/permissions", authenticate, (req: any, res) => {
    const perms = db.prepare("SELECT * FROM permissions").all();
    res.json(perms);
  });

  app.post("/api/permissions", authenticate, isAdmin, (req: any, res) => {
    const { role, menu_key, is_allowed } = req.body;
    db.prepare("INSERT OR REPLACE INTO permissions (role, menu_key, is_allowed) VALUES (?, ?, ?)")
      .run(role, menu_key, is_allowed ? 1 : 0);
    res.json({ success: true });
  });

  // --- Members Management ---
  app.get("/api/members", authenticate, (req: any, res) => {
    // All roles can see all members now
    const members = db.prepare("SELECT * FROM members").all();
    res.json(members);
  });

  app.get("/api/members/export", authenticate, async (req: any, res) => {
    const { role, wilayah: userWilayah } = req.user;
    const { pengurus, wilayah, format } = req.query;
    
    // Restriction: Only ADMIN and DPP can export to Excel/Word
    if ((format === 'xlsx' || format === 'docx' || !format) && (role !== "ADMIN" && role !== "DPP")) {
      return res.status(403).json({ message: "Hanya Admin dan DPP yang dapat mengekspor format ini. Silakan gunakan format PDF." });
    }

    let query = "SELECT no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, status FROM members WHERE 1=1";
    let params: any[] = [];

    // Explicit Filter overrides
    if (pengurus && pengurus !== 'ALL') {
      query += " AND pengurus = ?";
      params.push(pengurus);
    }
    if (wilayah && wilayah !== 'ALL') {
      query += " AND wilayah = ?";
      params.push(wilayah);
    }

    const members = db.prepare(query).all(...params) as any[];

    const orgName = (db.prepare("SELECT value FROM config WHERE key = 'orgName'").get() as any)?.value || "SIMAK";
    
    // Try to get export logo first, fallback to main logo
    let logoConfig = db.prepare("SELECT value FROM config WHERE key = 'exportLogoUrl'").get() as any;
    if (!logoConfig || !logoConfig.value) {
      logoConfig = db.prepare("SELECT value FROM config WHERE key = 'logoUrl'").get() as any;
    }
    
    const logoUrl = logoConfig?.value;
    const logoPath = logoUrl && logoUrl.startsWith('/uploads/') ? path.join(process.cwd(), logoUrl) : null;

    if (format === 'docx') {
      // DOCX Export
      const children: any[] = [];

      // Add logo if exists
      if (logoPath && fs.existsSync(logoPath)) {
        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new ImageRun({
              data: fs.readFileSync(logoPath),
              transformation: { width: 80, height: 80 },
              type: 'png'
            } as any),
          ],
        }));
      }

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: orgName, bold: true, size: 32 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "DATA ANGGOTA ORGANISASI", bold: true, size: 24 }),
          ],
        }),
        new Paragraph({ text: "" }), // spacer
        new DocxTable({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new DocxTableRow({
              children: [
                "No Anggota", "Nama", "Wilayah", "Jabatan", "Status"
              ].map(h => new DocxTableCell({ 
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                shading: { fill: "f0f0f0" }
              }))
            }),
            ...members.map(m => new DocxTableRow({
              children: [
                m.no_anggota, m.nama_lengkap, m.wilayah, m.jabatan, m.status
              ].map(v => new DocxTableCell({ children: [new Paragraph({ text: String(v || '') })] }))
            }))
          ]
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Disposition", 'attachment; filename="data_anggota.docx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      return res.send(buffer);
    }
 else {
      // EXCEL Export (Default)
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Members");
      
      // Headers
      worksheet.columns = [
        { header: "No Anggota", key: "no_anggota", width: 20 },
        { header: "Nama Lengkap", key: "nama_lengkap", width: 30 },
        { header: "Wilayah", key: "wilayah", width: 20 },
        { header: "Jabatan", key: "jabatan", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Level", key: "pengurus", width: 15 },
        { header: "WhatsApp", key: "no_whatsapp", width: 20 }
      ];

      members.forEach(m => worksheet.addRow(m));

      // Add Logo if exists
      if (logoPath && fs.existsSync(logoPath)) {
        try {
          const imageId = workbook.addImage({
            buffer: fs.readFileSync(logoPath),
            extension: 'png',
          });
          worksheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 60, height: 60 }
          });
        } catch (e) {
          console.error("Failed to add image to excel", e);
        }
      }

      const buffer = await workbook.xlsx.writeBuffer() as Buffer;
      res.setHeader("Content-Disposition", 'attachment; filename="data_anggota.xlsx"');
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    }
  });

  app.post("/api/members/import", authenticate, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const stmt = db.prepare(`
        INSERT INTO members (id, no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, lain_lain, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((membersData) => {
        for (const row of membersData) {
          stmt.run(
            uuidv4(),
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
      fs.unlinkSync(req.file.path); // Clean up
      res.json({ success: true, count: data.length });
    } catch (err: any) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/members/bulk", authenticate, (req: any, res) => {
    const { members: membersData } = req.body;
    if (!membersData || !Array.isArray(membersData)) {
      return res.status(400).json({ message: "Data tidak valid" });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO members (id, no_anggota, nik, nama_lengkap, alamat_lengkap, no_whatsapp, pengurus, wilayah, jabatan, seksi, lain_lain, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((data) => {
        for (const row of data) {
          stmt.run(
            uuidv4(),
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
    } catch (err: any) {
      console.error("[MEMBER BULK ERROR]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/members", authenticate, upload.fields([{ name: "foto_profile" }, { name: "foto_ektp" }]), (req: any, res) => {
    const data = req.body;
    const { role } = req.user;
    console.log(`[MEMBER CREATE] Attempting to create member: ${data.nama_lengkap} by user ${req.user.id}`);

    // Restriction: Non-Admin/DPP cannot add DPP members
    if (data.pengurus === 'DPP' && (role !== 'ADMIN' && role !== 'DPP')) {
      console.log(`[MEMBER CREATE FORBIDDEN] User ${req.user.id} role ${role} tried to add DPP member`);
      return res.status(403).json({ message: "Anda tidak memiliki hak akses untuk menambah pengurus pusat (DPP)." });
    }

    const files = req.files as any;
    const foto_profile_url = files?.foto_profile ? `/uploads/${files.foto_profile[0].filename}` : null;
    const foto_ektp_url = files?.foto_ektp ? `/uploads/${files.foto_ektp[0].filename}` : null;

    try {
      const cleanData = {
        no_anggota: data.no_anggota || null,
        nik: data.nik || null,
        nama_lengkap: data.nama_lengkap || null,
        alamat_lengkap: data.alamat_lengkap || null,
        no_whatsapp: data.no_whatsapp || null,
        pengurus: data.pengurus || 'PAC',
        wilayah: data.wilayah || req.user.wilayah,
        jabatan: data.jabatan || 'Anggota',
        seksi: data.seksi || null,
        lain_lain: data.lain_lain || null,
        status: data.status || 'Aktif'
      };

      const memberId = uuidv4();
      db.prepare(`
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
    } catch (err: any) {
      console.error("[MEMBER CREATE ERROR]", err);
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/members/:id", authenticate, upload.fields([{ name: "foto_profile" }, { name: "foto_ektp" }]), (req: any, res) => {
    const { id } = req.params;
    const data = req.body;
    const { role } = req.user;

    const existingMember = db.prepare("SELECT * FROM members WHERE id = ?").get(id) as any;
    if (!existingMember) return res.status(404).json({ message: "Member not found" });

    // Restriction: Non-Admin/DPP cannot edit DPP members
    if ((existingMember.pengurus === 'DPP' || data.pengurus === 'DPP') && (role !== 'ADMIN' && role !== 'DPP')) {
      return res.status(403).json({ message: "Anda tidak memiliki hak akses untuk mengubah data pengurus pusat (DPP)." });
    }

    const files = req.files as any;
    let foto_profile_url = existingMember.foto_profile_url;
    let foto_ektp_url = existingMember.foto_ektp_url;

    if (files.foto_profile) foto_profile_url = `/uploads/${files.foto_profile[0].filename}`;
    if (files.foto_ektp) foto_ektp_url = `/uploads/${files.foto_ektp[0].filename}`;

    try {
      db.prepare(`
        UPDATE members SET 
          no_anggota = ?, nik = ?, nama_lengkap = ?, alamat_lengkap = ?, no_whatsapp = ?, 
          pengurus = ?, wilayah = ?, jabatan = ?, seksi = ?, lain_lain = ?, 
          foto_profile_url = ?, foto_ektp_url = ?, status = ?
        WHERE id = ?
      `).run(
        data.no_anggota, data.nik, data.nama_lengkap, data.alamat_lengkap, data.no_whatsapp,
        data.pengurus, data.wilayah, data.jabatan, data.seksi, data.lain_lain,
        foto_profile_url, foto_ektp_url, data.status,
        id
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/finance", authenticate, (req: any, res) => {
    const { role, wilayah } = req.user;
    let query = "SELECT * FROM finance";
    let params: any[] = [];

    if (role !== "ADMIN" && role !== "DPP") {
      query += " WHERE role = ? AND wilayah = ?";
      params.push(role, wilayah);
    }

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  });

  app.post("/api/finance", authenticate, (req: any, res) => {
    const { tanggal, jenis, nominal, keterangan } = req.body;
    try {
      db.prepare(`
        INSERT INTO finance (id, tanggal, jenis, nominal, keterangan, operator, role, wilayah)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), tanggal, jenis, nominal, keterangan, req.user.nama_lengkap, req.user.role, req.user.wilayah);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/finance/:id", authenticate, (req: any, res) => {
    try {
      console.log(`[FINANCE DELETE] Attempting to delete id: ${req.params.id} by user ${req.user.id}`);
      const result = db.prepare("DELETE FROM finance WHERE id = ?").run(req.params.id);
      console.log(`[FINANCE DELETE SUCCESS] Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[FINANCE DELETE ERROR]", err);
      res.status(500).json({ message: "Gagal menghapus data keuangan" });
    }
  });

  app.get("/api/config", (req, res) => {
    const config = db.prepare("SELECT * FROM config").all();
    const result = config.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(result);
  });

  app.post("/api/config", authenticate, isAdmin, (req: any, res) => {
    const updates = req.body;
    try {
      const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
      const transaction = db.transaction((data) => {
        for (const [key, value] of Object.entries(data)) {
          stmt.run(key, value);
        }
      });
      transaction(updates);
      console.log(`[CONFIG UPDATE] Successful by user ${req.user?.id || 'unknown'}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[CONFIG UPDATE ERROR]", err);
      res.status(500).json({ message: "Gagal menyimpan konfigurasi" });
    }
  });

  app.post("/api/config/logo", authenticate, isAdmin, upload.single("logo"), (req: any, res) => {
    console.log(`[LOGO UPLOAD] Start. User: ${req.user.id}, Role: ${req.user.role}`);
    if (!req.file) {
      console.log(`[LOGO UPLOAD FAILED] No file in request`);
      return res.status(400).json({ message: "File logo tidak ditemukan dalam permintaan." });
    }
    
    const logoUrl = `/uploads/${req.file.filename}`;
    const type = req.body.type || 'main';
    const key = type === 'export' ? 'exportLogoUrl' : 'logoUrl';
    
    console.log(`[LOGO UPLOAD] Success. Path: ${logoUrl}, Type: ${type}, Key: ${key}`);
    
    try {
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, logoUrl);
      res.json({ success: true, logoUrl });
    } catch (err: any) {
      console.error("[LOGO UPLOAD DB ERROR]", err);
      res.status(500).json({ message: "Gagal menyimpan konfigurasi logo ke database." });
    }
  });

  app.post("/api/config/qris", authenticate, isAdmin, upload.single("qris"), (req: any, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "File gambar QRIS tidak ditemukan." });
    }
    
    const qrisUrl = `/uploads/${req.file.filename}`;
    try {
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("qrisUrl", qrisUrl);
      res.json({ success: true, qrisUrl });
    } catch (err: any) {
      console.error("[QRIS UPLOAD DB ERROR]", err);
      res.status(500).json({ message: "Gagal menyimpan konfigurasi QRIS ke database." });
    }
  });

  app.get("/api/structure", (req, res) => {
    try {
      const structure = db.prepare(`
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
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/structure", authenticate, isAdmin, (req: any, res) => {
    const { no_anggota, nama_lengkap, jabatan } = req.body;
    try {
      db.prepare("INSERT INTO structure (id, no_anggota, nama_lengkap, jabatan) VALUES (?, ?, ?, ?)")
        .run(uuidv4(), no_anggota, nama_lengkap, jabatan);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/structure/:id", authenticate, isAdmin, (req: any, res) => {
    const result = db.prepare("DELETE FROM structure WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  });

  app.put("/api/structure/:id", authenticate, isAdmin, (req: any, res) => {
    const { no_anggota, nama_lengkap, jabatan } = req.body;
    db.prepare("UPDATE structure SET no_anggota = ?, nama_lengkap = ?, jabatan = ? WHERE id = ?")
      .run(no_anggota, nama_lengkap, jabatan, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/members/:id", authenticate, (req: any, res) => {
    const { role } = req.user;
    const { id } = req.params;
    console.log(`[MEMBER DELETE] Attempting to delete member id: ${id} by user ${req.user.id}`);

    try {
      const existingMember = db.prepare("SELECT * FROM members WHERE id = ?").get(id) as any;
      if (!existingMember) {
        console.log(`[MEMBER DELETE FAILED] Not found: ${id}`);
        return res.status(404).json({ message: "Member not found" });
      }

      // Restriction: Non-Admin/DPP cannot delete DPP members
      if (existingMember.pengurus === 'DPP' && (role !== 'ADMIN' && role !== 'DPP')) {
        console.log(`[MEMBER DELETE FORBIDDEN] User ${req.user.id} role ${role} tried to delete DPP member`);
        return res.status(403).json({ message: "Anda tidak memiliki hak akses untuk menghapus data pengurus pusat (DPP)." });
      }

      const result = db.prepare("DELETE FROM members WHERE id = ?").run(id);
      console.log(`[MEMBER DELETE SUCCESS] Member ${id} deleted. Changes: ${result.changes}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[MEMBER DELETE ERROR]", err);
      res.status(500).json({ message: "Gagal menghapus anggota" });
    }
  });

  // --- Backup & Restore ---
  app.get("/api/admin/backup/db", authenticate, isAdmin, (req, res) => {
    const dbPath = path.join(process.cwd(), "simak.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ message: "Database file not found" });
    res.download(dbPath, `backup_db_${new Date().toISOString().split('T')[0]}.db`);
  });

  app.post("/api/admin/restore/db", authenticate, isAdmin, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    const dbPath = path.join(process.cwd(), "simak.db");
    try {
      // In this environment, we can't easily close/restart synchronously while serving
      // but copying over usually works as SQLite handles it (or the watcher restarts us)
      fs.copyFileSync(req.file.path, dbPath);
      fs.unlinkSync(req.file.path);
      res.json({ success: true, message: "Pangkalan data berhasil dipulihkan. Sistem akan memulai ulang." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/backup/full", authenticate, isAdmin, async (req, res) => {
    try {
      const zip = new AdmZip();
      const dbPath = path.join(process.cwd(), "simak.db");
      if (fs.existsSync(dbPath)) zip.addLocalFile(dbPath);
      if (fs.existsSync(uploadDir)) zip.addLocalFolder(uploadDir, "uploads");
      
      const buffer = zip.toBuffer();
      res.setHeader("Content-Disposition", `attachment; filename="backup_full_${new Date().toISOString().split('T')[0]}.zip"`);
      res.setHeader("Content-Type", "application/zip");
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/restore/full", authenticate, isAdmin, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    
    try {
      const zip = new AdmZip(req.file.path);
      zip.extractAllTo(process.cwd(), true);
      fs.unlinkSync(req.file.path);
      res.json({ success: true, message: "Pemulihan penuh berhasil. Sistem akan memulai ulang." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/export/tables", authenticate, isAdmin, (req, res) => {
    try {
      const tables = ['users', 'members', 'finance', 'config', 'structure', 'permissions'];
      const data: any = {};
      for (const table of tables) {
        data[table] = db.prepare(`SELECT * FROM ${table}`).all();
      }
      res.setHeader("Content-Disposition", `attachment; filename="data_export_${new Date().toISOString().split('T')[0]}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/import/tables", authenticate, isAdmin, (req, res) => {
    const data = req.body;
    try {
      db.transaction(() => {
        for (const [table, rows] of Object.entries(data)) {
          if (!Array.isArray(rows)) continue;
          // Simple validation: check if table exists in our list
          if (!['users', 'members', 'finance', 'config', 'structure', 'permissions'].includes(table)) continue;

          db.prepare(`DELETE FROM ${table}`).run();
          if (rows.length === 0) continue;
          
          const keys = Object.keys(rows[0]);
          const placeholders = keys.map(() => '?').join(',');
          const stmt = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`);
          
          for (const row of rows as any[]) {
            const values = keys.map(k => row[k]);
            stmt.run(...values);
          }
        }
      })();
      res.json({ success: true, message: "Impor tabel berhasil dilakukan." });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // -- Improved Seeding Section (Non-blocking) --
  const seedUser = async (id: string, no: string, name: string, pass: string, role: string, vil: string) => {
    try {
      const existing = db.prepare("SELECT * FROM users WHERE no_anggota = ?").get(no) as any;
      if (!existing) {
        const hashedPassword = bcrypt.hashSync(pass, 10);
        db.prepare("INSERT INTO users (id, no_anggota, nama_lengkap, password, role, wilayah) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, no, name, hashedPassword, role, vil);
        console.log(`[SEED] Created user ${no}`);
      } else {
        // Just update password/role to be sure
        const hashedPassword = bcrypt.hashSync(pass, 10);
        db.prepare("UPDATE users SET password = ?, role = ?, wilayah = ?, nama_lengkap = ? WHERE no_anggota = ?")
          .run(hashedPassword, role, vil, name, no);
        console.log(`[SEED] Updated user ${no}`);
        id = existing.id; // Use existing ID for firestore sync
      }
      
      // Attempt Firestore sync
      if (firestore && firebaseConfig?.projectId && firebaseConfig?.apiKey) {
        firestore.collection("users").doc(id).set({
          no_anggota: no,
          nama_lengkap: name,
          role: role,
          wilayah: vil,
          created_at: FieldValue.serverTimestamp()
        }).catch((e: any) => {
          if (!e.message.includes("PERMISSION_DENIED")) {
             console.log(`[SEED FS] Failed to sync ${no}: ${e.message}`);
          }
        });
      }
    } catch (err: any) {
      console.error(`[SEED ERROR] Failed for ${no}:`, err.message);
    }
  };

  // Run Seeding in background
  (async () => {
    console.log("[SEED] Starting background seeding...");
    // Seed Admin
    await seedUser(uuidv4(), "admin", "Admin System", "Anggra09", "ADMIN", "PUSAT");
    
    // Seed Alif
    await seedUser(uuidv4(), "alif", "Alif User", "password123", "PAC", "PUSAT");

    // Seed default configs
    const configExists = db.prepare("SELECT count(*) as count FROM config WHERE key = 'orgName'").get() as { count: number };
    if (configExists.count === 0) {
        db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("orgName", "SIMO - SISTEM INFORMASI MANAJEMEN ORGANISASI");
        db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run("logoUrl", "");
    }
    console.log("[SEED] Background seeding completed.");
  })();

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server Internal Error:', err);
    // Force JSON response for all errors
    if (!res.headersSent) {
      res.status(500).json({ 
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  app.all("*", (req, res, next) => {
    if (req.path.startsWith('/api/')) {
       console.log(`[404] API NOT FOUND: ${req.method} ${req.path}`);
       res.setHeader('Content-Type', 'application/json');
       return res.status(404).json({ 
         status: "error",
         message: `Route ${req.method} ${req.path} tidak ditemukan di server.` 
       });
    }
    next();
  });

  // --- Vite / Production Serve ---
  if (process.env.NODE_ENV !== "production") {
    console.log("[VITE] Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[VITE] Middleware ready.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("[SERVER] Warning: dist folder not found in production mode!");
    }
  }
}

startServer().catch(err => {
  console.error("Critical failure during server startup:", err);
  process.exit(1);
});
