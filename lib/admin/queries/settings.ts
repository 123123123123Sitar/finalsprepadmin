import { requireDb, collections } from "@/lib/admin/firestore";
import type { FeatureFlagRecord, PlatformSettings } from "@/lib/admin/types";

export const DEFAULT_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  announcementBanner: {
    enabled: false,
    text: "",
    tone: "info",
  },
  ai: {
    provider: "hybrid",
    chatModel: "claude-haiku-4-5",
    explainModel: "claude-haiku-4-5",
    hardDailyTokenReserve: 700,
  },
  credits: {
    learnerMonthlyTokens: 10000,
    proMonthlyTokens: 20000,
    hackerMonthlyTokens: 80000,
    proDailyMessages: 80,
    hackerDailyMessages: 250,
  },
  trials: {
    freeTrialDays: 7,
    enabled: true,
  },
  pricing: {
    showAnnualPromo: true,
    defaultCheckoutPlan: "pro-monthly",
  },
  release: {
    waitlistMode: false,
    betaAccessMode: "allowlist",
    studentAppReadOnly: false,
  },
  referrals: {
    enabled: true,
    promoEnabled: true,
    maxRedemptionsPerUser: 3,
  },
  abuse: {
    hardRequestsPerMinute: 12,
    sharedAccountDeviceThreshold: 4,
    couponAbuseThreshold: 3,
  },
  content: {
    featuredCourseSlugs: [],
    homepageCourseOrder: [],
    courseVisibility: {},
    draftCourseSlugs: [],
    hiddenTopicIds: [],
  },
  support: {
    supportEmail: "support@finalsprep.com",
  },
  legal: {
    contentNotice: "Practice content is for study support and not an official College Board product.",
  },
  updatedAt: 0,
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const db = requireDb();
  const doc = await db.collection(collections.platformSettings).doc("current").get();
  return {
    ...DEFAULT_SETTINGS,
    announcementBanner: {
      ...DEFAULT_SETTINGS.announcementBanner,
      ...((doc.exists ? doc.data()?.announcementBanner : null) || {}),
    },
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...((doc.exists ? doc.data()?.ai : null) || {}),
    },
    credits: {
      ...DEFAULT_SETTINGS.credits,
      ...((doc.exists ? doc.data()?.credits : null) || {}),
    },
    trials: {
      ...DEFAULT_SETTINGS.trials,
      ...((doc.exists ? doc.data()?.trials : null) || {}),
    },
    pricing: {
      ...DEFAULT_SETTINGS.pricing,
      ...((doc.exists ? doc.data()?.pricing : null) || {}),
    },
    release: {
      ...DEFAULT_SETTINGS.release,
      ...((doc.exists ? doc.data()?.release : null) || {}),
    },
    referrals: {
      ...DEFAULT_SETTINGS.referrals,
      ...((doc.exists ? doc.data()?.referrals : null) || {}),
    },
    abuse: {
      ...DEFAULT_SETTINGS.abuse,
      ...((doc.exists ? doc.data()?.abuse : null) || {}),
    },
    content: {
      ...DEFAULT_SETTINGS.content,
      ...((doc.exists ? doc.data()?.content : null) || {}),
    },
    support: {
      ...DEFAULT_SETTINGS.support,
      ...((doc.exists ? doc.data()?.support : null) || {}),
    },
    legal: {
      ...DEFAULT_SETTINGS.legal,
      ...((doc.exists ? doc.data()?.legal : null) || {}),
    },
    ...(doc.exists ? (doc.data() as Partial<PlatformSettings>) : {}),
  };
}

export async function getFeatureFlags(): Promise<FeatureFlagRecord[]> {
  const db = requireDb();
  const snap = await db
    .collection(collections.featureFlags)
    .orderBy("key", "asc")
    .limit(200)
    .get();
  return snap.docs.map((doc) => ({
    key: doc.id,
    ...(doc.data() as Omit<FeatureFlagRecord, "key">),
  }));
}
