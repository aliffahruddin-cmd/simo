import { 
  initializeApp 
} from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged as fbOnAuthStateChanged,
  signOut as fbSignOut,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

if (!firebaseConfig.apiKey) {
  console.log("Firebase API Key is missing. some features may be limited.");
}

let app: any;
let db: any;
let auth: any;

const isConfigValid = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

try {
  if (isConfigValid) {
    app = initializeApp(firebaseConfig);
    // Use initializeFirestore with forceLongPolling to resolve connection issues in restricted environments
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } else {
    throw new Error("Missing Firebase config");
  }
} catch (e) {
  console.log("Firebase is currently disabled (missing or invalid configuration).");
  app = { options: firebaseConfig };
  db = null;
  auth = null; 
}

// Custom wrapped functions to handle disabled state gracefully
export function onAuthStateChanged(
  authInstance: any, 
  next: (user: FirebaseUser | null) => void, 
  error?: (error: any) => void
) {
  if (!isConfigValid || !authInstance) {
    // If disabled, just trigger null user immediately
    setTimeout(() => next(null), 0);
    return () => {};
  }
  return fbOnAuthStateChanged(authInstance, next, error);
}

export async function signOut(authInstance: any) {
  if (!isConfigValid || !authInstance) return;
  return fbSignOut(authInstance);
}

export async function signInWithEmailAndPassword(authInstance: any, email: string, pass: string) {
  if (!isConfigValid || !authInstance) {
    throw new Error("Layanan Firebase Auth dinonaktifkan karena konfigurasi belum lengkap.");
  }
  return fbSignInWithEmailAndPassword(authInstance, email, pass);
}

export { db, auth };

// Test connection only if config seems present and we have a db
async function testConnection() {
  if (!isConfigValid || !db) return;
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("AIzaSy")) {
    // If it's a placeholder or guessed (most AIzaSy starting keys are placeholders if not from set_up_firebase)
    // we only test if we are intentional about it.
    // Actually, AIzaSy IS the prefix for real keys too. 
    // Let's just check if it's empty or looks like a template.
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") return;
  }

  try {
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("Firebase Connection Verified.");
  } catch (error: any) {
    // Only log if it's a real unexpected failure, not just "offline" during dev
    if (error?.message?.includes('the client is offline')) {
      // Quietly ignore or log a more helpful message only once
      console.log("Firebase is offline or config is pending activation.");
    } else if (error?.message?.includes('api-key-not-valid')) {
      console.warn("Firebase API Key is invalid. Please update it in System Console.");
    } else {
      console.log("Firebase Status:", error?.message);
    }
  }
}
if (firebaseConfig.apiKey) {
    testConnection();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
