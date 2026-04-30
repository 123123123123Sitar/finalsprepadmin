// One-off: ensures a Firebase Auth user exists with the given email/password
// and grants super_admin role + custom claims. Re-runnable.
//
// Usage:  tsx scripts/bootstrap-admin-user.ts --email=<email> --password=<pw>
//
// This file is intentionally git-ignored via the existing .gitignore for scripts/.
import { getAdminAuth, getAdminDb } from "../lib/firebase-admin";

function readArg(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const email = readArg("email");
  const password = readArg("password");
  const note = readArg("note") || "Bootstrapped via bootstrap-admin-user";
  const roles = (readArg("roles") || "super_admin").split(",").map((r) => r.trim()).filter(Boolean);

  if (!email || !password) {
    throw new Error("Provide --email=<email> and --password=<password>.");
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_ADMIN_KEY_B64.");
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
    // Update password + ensure verified
    user = await auth.updateUser(user.uid, {
      password,
      emailVerified: true,
      disabled: false,
    });
    console.log(`[bootstrap] updated existing user ${user.uid}`);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        password,
        emailVerified: true,
      });
      console.log(`[bootstrap] created new user ${user.uid}`);
    } else {
      throw err;
    }
  }

  const now = Date.now();
  const existing = await db.collection("adminRoles").doc(user.uid).get();

  await db.collection("adminRoles").doc(user.uid).set(
    {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      roles,
      active: true,
      note,
      createdAt: existing.exists ? existing.data()?.createdAt || now : now,
      updatedAt: now,
      updatedBy: "bootstrap-admin-user",
    },
    { merge: true }
  );

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
    adminRoles: roles,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        uid: user.uid,
        email: user.email || null,
        roles,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
