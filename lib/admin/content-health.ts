import fs from "node:fs";
import path from "node:path";
import { requireDb, collections } from "@/lib/admin/firestore";
import type { ContentHealthRecord } from "@/lib/admin/types";

type CourseSummary = {
  slug: string;
  title: string;
  category: string;
  units: number[];
  topics: string[];
};

function sourceRoot(): string {
  return path.resolve(
    process.cwd(),
    process.env.FINALSPREP_SOURCE_ROOT || "../finalsprep"
  );
}

export function contentSourceAvailable(): boolean {
  try {
    return fs.existsSync(path.join(sourceRoot(), "package.json"));
  } catch {
    return false;
  }
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(sourceRoot(), relPath), "utf8");
}

function parseCourses(): CourseSummary[] {
  const topicsFile = readSource("lib/topics.ts");
  const courseRegex =
    /slug:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"[\s\S]*?units:\s*cedUnits\("([^"]+)",\s*\[([\s\S]*?)\]\)/g;

  const courses: CourseSummary[] = [];
  for (const match of topicsFile.matchAll(courseRegex)) {
    const slug = match[1];
    const title = match[2];
    const category = match[3];
    const unitsBlock = match[5];
    const units = [...unitsBlock.matchAll(/number:\s*(\d+)/g)].map((m) =>
      Number(m[1])
    );
    courses.push({
      slug,
      title,
      category,
      units,
      topics: [],
    });
  }

  const apUnitFiles = [
    "lib/apUnits/math.ts",
    "lib/apUnits/science.ts",
    "lib/apUnits/cs.ts",
    "lib/apUnits/history.ts",
  ];
  const bySlug = new Map(courses.map((course) => [course.slug, course]));

  for (const file of apUnitFiles) {
    const content = readSource(file);
    const courseBlockRegex = /"([^"]+)":\s*\[([\s\S]*?)\n\s*\],/g;
    for (const block of content.matchAll(courseBlockRegex)) {
      const course = bySlug.get(block[1]);
      if (!course) continue;
      course.topics = [...block[2].matchAll(/id:\s*"([^"]+)"/g)].map(
        (topicMatch) => topicMatch[1]
      );
    }
  }

  return courses;
}

function parseCurriculumUnits(): Record<string, Set<number>> {
  const result: Record<string, Set<number>> = {};
  const files = [
    "lib/curriculum/math.ts",
    "lib/curriculum/science.ts",
    "lib/curriculum/cs.ts",
    "lib/curriculum/history.ts",
  ];

  for (const file of files) {
    const content = readSource(file);
    const blockRegex = /"([^"]+)":\s*\{[\s\S]*?units:\s*\[([\s\S]*?)\n\s*\],/g;
    for (const block of content.matchAll(blockRegex)) {
      const slug = block[1];
      const units = [...block[2].matchAll(/unitNumber:\s*(\d+)/g)].map((m) =>
        Number(m[1])
      );
      result[slug] = new Set(units);
    }
  }
  return result;
}

function parseCedLessonTopics(): Record<string, Set<string>> {
  const cedDir = path.join(sourceRoot(), "lib/cedLessons");
  const files = fs
    .readdirSync(cedDir)
    .filter((file) => file.endsWith(".ts") && file !== "index.ts" && file !== "types.ts");
  const result: Record<string, Set<string>> = {};

  for (const file of files) {
    const content = fs.readFileSync(path.join(cedDir, file), "utf8");
    const slug =
      file
        .replace(/^ap-/, "ap-")
        .replace(/\.ts$/, "")
        .replace("calc-ab", "calc-ab")
        .replace("calc-bc", "calc-bc") || file;
    const normalizedSlug = mapLessonFileToCourseSlug(file);
    result[normalizedSlug] = new Set(
      [...content.matchAll(/"(\d+(?:\.\d+)?)":\s*\{/g)].map((match) => match[1])
    );
  }

  return result;
}

function mapLessonFileToCourseSlug(file: string): string {
  const key = file.replace(/\.ts$/, "");
  switch (key) {
    case "ap-environmental":
    case "ap-biology":
    case "ap-chemistry":
    case "ap-calc-ab":
    case "ap-calc-bc":
    case "ap-precalc":
    case "ap-statistics":
    case "ap-cs-a":
    case "ap-cs-principles":
    case "ap-us-history":
    case "ap-world-history":
    case "ap-euro-history":
    case "ap-physics-1":
    case "ap-physics-2":
    case "ap-physics-c-mech":
    case "ap-physics-c-em":
      return key;
    default:
      return key;
  }
}

function parsePracticeUnits(): Record<string, Set<number>> {
  const files = [
    "lib/practice/math.ts",
    "lib/practice/science.ts",
    "lib/practice/cs.ts",
    "lib/practice/history.ts",
  ];
  const result: Record<string, Set<number>> = {};

  for (const file of files) {
    const content = readSource(file);
    const blockRegex = /"([^"]+)":\s*\[([\s\S]*?)\n\s*\],/g;
    for (const block of content.matchAll(blockRegex)) {
      result[block[1]] = new Set(
        [...block[2].matchAll(/unitNumber:\s*(\d+)/g)].map((match) =>
          Number(match[1])
        )
      );
    }
  }

  return result;
}

function parseToolUnits(): Record<string, Set<number>> {
  const content = readSource("lib/courseTools.ts");
  const blockRegex = /"([^"]+)":\s*\[([\s\S]*?)\n\s*\],/g;
  const result: Record<string, Set<number>> = {};
  for (const block of content.matchAll(blockRegex)) {
    result[block[1]] = new Set(
      [...block[2].matchAll(/unitNumber:\s*(\d+)/g)].map((match) =>
        Number(match[1])
      )
    );
  }
  return result;
}

export async function computeContentHealth(): Promise<ContentHealthRecord[]> {
  if (!contentSourceAvailable()) return [];

  const courses = parseCourses();
  const curriculum = parseCurriculumUnits();
  const ced = parseCedLessonTopics();
  const practice = parsePracticeUnits();
  const tools = parseToolUnits();

  return courses.map((course) => {
    const curriculumUnits = curriculum[course.slug] ?? new Set<number>();
    const practiceUnits = practice[course.slug] ?? new Set<number>();
    const toolUnits = tools[course.slug] ?? new Set<number>();
    const lessonTopics = ced[course.slug] ?? new Set<string>();

    const missingCurriculumUnits = course.units
      .filter((unit) => !curriculumUnits.has(unit))
      .map((unit) => `Unit ${unit}`);
    const missingPracticeUnits = course.units
      .filter((unit) => !practiceUnits.has(unit))
      .map((unit) => `Unit ${unit}`);
    const missingInteractiveUnits = course.units
      .filter((unit) => !toolUnits.has(unit))
      .map((unit) => `Unit ${unit}`);
    const missingCedLessons = course.topics.filter((topic) => !lessonTopics.has(topic));

    const staleSignals: string[] = [];
    if (missingCurriculumUnits.length > 0) staleSignals.push("curriculum gaps");
    if (missingCedLessons.length > 0) staleSignals.push("missing CED topics");
    if (missingPracticeUnits.length > 0) staleSignals.push("practice gaps");
    if (missingInteractiveUnits.length > 0) staleSignals.push("interactive gaps");

    return {
      id: course.slug,
      title: course.title,
      category: course.category,
      totalUnits: course.units.length,
      totalTopics: course.topics.length,
      curriculumUnitsPresent: curriculumUnits.size,
      cedLessonsPresent: lessonTopics.size,
      missingCurriculumUnits,
      missingCedLessons,
      missingPracticeUnits,
      missingInteractiveUnits,
      draftUnits: [],
      unpublishedTopics: [],
      staleSignals,
    };
  });
}

export async function refreshContentHealthSnapshot(actorUid: string) {
  const db = requireDb();
  const health = await computeContentHealth();
  const batch = db.batch();
  const syncedAt = Date.now();

  for (const record of health) {
    const ref = db.collection(collections.contentHealth).doc(record.id);
    batch.set(ref, {
      ...record,
      syncedAt,
      syncedBy: actorUid,
    });
  }

  batch.set(
    db.collection(collections.platformSettings).doc("contentHealthMeta"),
    { syncedAt, syncedBy: actorUid },
    { merge: true }
  );

  await batch.commit();
  return health;
}
