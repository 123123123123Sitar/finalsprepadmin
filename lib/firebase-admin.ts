import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// HMR-safe singleton: dev re-evaluates this module on file changes, and
// Firestore.settings() may only be called once per Firestore instance, so we
// stash the cached references on globalThis.
type AdminCache = {
  app: App | null;
  auth: Auth | null;
  db: Firestore | null;
  triedInit: boolean;
};

const globalScope = globalThis as typeof globalThis & {
  __finalsprepAdminCache?: AdminCache;
};

const cache: AdminCache =
  globalScope.__finalsprepAdminCache ??
  (globalScope.__finalsprepAdminCache = {
    app: null,
    auth: null,
    db: null,
    triedInit: false,
  });

export function isAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_ADMIN_KEY_B64);
}

function ensureAdminApp(): App | null {
  if (cache.app) return cache.app;
  if (cache.triedInit) return null;
  cache.triedInit = true;

  const b64 = process.env.FIREBASE_ADMIN_KEY_B64;
  if (!b64) return null;

  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(json) as ServiceAccount;
    cache.app =
      getApps().find((app) => app.name === "finalsprep-admin-console") ??
      initializeApp(
        {
          credential: cert(serviceAccount),
          projectId: (serviceAccount as { project_id?: string }).project_id,
        },
        "finalsprep-admin-console"
      );
    return cache.app;
  } catch (error) {
    console.error("[admin] failed to initialize Firebase Admin", error);
    return null;
  }
}

export function getAdminAuth(): Auth | null {
  if (cache.auth) return cache.auth;
  const app = ensureAdminApp();
  if (!app) return null;
  cache.auth = getAuth(app);
  return cache.auth;
}

export function getAdminDb(): Firestore | null {
  if (cache.db) return cache.db;
  const app = ensureAdminApp();
  if (!app) return null;
  const db = getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch (error) {
    // Settings can only be set once per Firestore instance — under HMR the
    // instance can survive past module re-evaluation. Safe to ignore.
    if (
      !(error instanceof Error) ||
      !error.message.includes("settings() once")
    ) {
      throw error;
    }
  }
  cache.db = db;
  return cache.db;
}
