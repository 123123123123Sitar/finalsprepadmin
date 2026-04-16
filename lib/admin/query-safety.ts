type FirestoreQueryError = Error & {
  code?: number | string;
  details?: string;
};

export function isFirestoreFailedPrecondition(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const firestoreError = error as FirestoreQueryError;
  return (
    firestoreError.code === 9 ||
    firestoreError.code === "9" ||
    firestoreError.code === "failed-precondition"
  );
}

export async function withFirestoreFallback<T>(
  label: string,
  fallback: T,
  query: () => Promise<T>
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (isFirestoreFailedPrecondition(error)) {
      console.warn(`[admin] ${label} skipped due to Firestore index/precondition`, {
        message: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
    throw error;
  }
}

export function sortByNumericFieldDesc<T extends Record<string, unknown>>(
  items: T[],
  field: string
): T[] {
  return [...items].sort(
    (a, b) =>
      Number((b as Record<string, unknown>)[field] || 0) -
      Number((a as Record<string, unknown>)[field] || 0)
  );
}
