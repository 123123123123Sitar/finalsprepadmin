import { getAdminAuth, getAdminDb } from "../lib/firebase-admin";

function readArg(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

async function main() {
  const email = readArg("email");
  const uid = readArg("uid");
  const rolesArg = readArg("roles") || "super_admin";
  const note = readArg("note") || "Seeded from CLI";
  const roles = rolesArg
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (!email && !uid) {
    throw new Error(
      "Provide either --email=<admin@finalsprep.com> or --uid=<firebase-uid>."
    );
  }
  if (roles.length === 0) {
    throw new Error("At least one admin role is required.");
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
  if (!auth || !db) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_ADMIN_KEY_B64 first.");
  }

  const user = email ? await auth.getUserByEmail(email) : await auth.getUser(uid!);
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
      updatedBy: "seed-super-admin-script",
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

