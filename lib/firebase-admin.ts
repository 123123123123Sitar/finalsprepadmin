import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let triedInit = false;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_ADMIN_KEY_B64);
}

function ensureAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (triedInit) return null;
  triedInit = true;

  const b64 = process.env.FIREBASE_ADMIN_KEY_B64;
  if (!b64) return null;

  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(json) as ServiceAccount;
    adminApp =
      getApps().find((app) => app.name === "finalsprep-admin-console") ??
      initializeApp(
        {
          credential: cert(serviceAccount),
          projectId: (serviceAccount as { project_id?: string }).project_id,
        },
        "finalsprep-admin-console"
      );
    return adminApp;
  } catch (error) {
    console.error("[admin] failed to initialize Firebase Admin", error);
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  if (adminAuth) return adminAuth;
  const app = ensureAdminApp();
  if (!app) return null;
  adminAuth = getAuth(app);
  return adminAuth;
}

export function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const app = ensureAdminApp();
  if (!app) return null;
  adminDb = getFirestore(app);
  adminDb.settings({ ignoreUndefinedProperties: true });
  return adminDb;
}
