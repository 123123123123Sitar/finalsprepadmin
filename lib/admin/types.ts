import type { UserRecord } from "firebase-admin/auth";
import type { PlanTier, BillingInterval } from "@/lib/admin/plans";

export type AdminRole =
  | "readonly_admin"
  | "support_admin"
  | "content_admin"
  | "billing_admin"
  | "super_admin";

export type AdminPermission =
  | "dashboard.read"
  | "users.read"
  | "users.write"
  | "support.write"
  | "billing.read"
  | "billing.write"
  | "usage.read"
  | "usage.write"
  | "content.read"
  | "content.write"
  | "settings.read"
  | "settings.write"
  | "audit.read"
  | "impersonation.use";

export type AdminRoleRecord = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  roles: AdminRole[];
  active: boolean;
  note?: string | null;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string | null;
};

export type AdminSessionClaims = {
  admin?: boolean;
  adminRoles?: AdminRole[];
};

export type AdminContext = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  roles: AdminRole[];
  permissions: AdminPermission[];
  displayName?: string | null;
};

export type AppBillingProfile = {
  plan: PlanTier;
  billingInterval?: BillingInterval;
  status?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: number;
  updatedAt?: number;
  cancelAt?: number | null;
  canceledAt?: number | null;
  trialEndsAt?: number | null;
};

export type TokenBank = {
  balance: number;
  updatedAt?: number;
  lastSource?: string | null;
};

export type AdminUserOverlay = {
  uid: string;
  flags?: {
    banned?: boolean;
    suspicious?: boolean;
    refunded?: boolean;
    testAccount?: boolean;
    shadowRestricted?: boolean;
    billingWatch?: boolean;
  };
  adminNotesSummary?: string;
  supportTier?: "normal" | "priority" | "vip";
  manualPlanOverride?: {
    plan: PlanTier;
    source: "manual" | "comp";
    reason: string;
    expiresAt?: number | null;
    updatedBy: string;
    updatedAt: number;
  } | null;
  quotaOverride?: {
    monthlyTokens?: number | null;
    dailyMessages?: number | null;
    reason: string;
    updatedBy: string;
    updatedAt: number;
  } | null;
  betaFeatures?: string[];
  featureFlags?: Record<string, boolean>;
  unlockedCourses?: string[];
  unlockedTools?: string[];
  referralSource?: string | null;
  pricingCohort?: string | null;
  deactivatedAt?: number | null;
  deactivatedBy?: string | null;
  lastStripeSyncAt?: number | null;
  updatedAt?: number;
};

export type UserAiUsageSummary = {
  totalTokens: number;
  totalCostUsd: number;
  totalRequests: number;
  failedRequests: number;
  lastUsedAt?: number;
  byKind: Record<string, number>;
  byModel: Record<string, number>;
};

export type AdminUserListItem = {
  uid: string;
  name: string | null;
  email: string | null;
  disabled: boolean;
  createdAt?: number;
  lastSignInAt?: number;
  emailVerified: boolean;
  providerIds: string[];
  plan: PlanTier;
  subscriptionStatus: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tokenBalance: number;
  aiUsage: UserAiUsageSummary;
  flags: Required<NonNullable<AdminUserOverlay["flags"]>>;
  referralSource?: string | null;
};

export type AdminUserDetail = {
  auth: UserRecord;
  billing: AppBillingProfile;
  tokenBank: TokenBank;
  overlay: AdminUserOverlay;
  aiUsage: UserAiUsageSummary;
  recentAiHistory: Array<Record<string, unknown> & { id: string }>;
  recentEvents: Array<Record<string, unknown> & { id: string }>;
  notes: Array<AdminNote>;
  ledger: Array<ManualCreditAdjustment>;
};

export type AdminOverviewMetrics = {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  totalPaidUsers: number;
  freeUsers: number;
  proUsers: number;
  premiumUsers: number;
  recentSignups7d: number;
  freeToPaidConversionRate: number;
  churnedSubscriptions30d: number;
  totalTokensUsed30d: number;
  totalMessages30d: number;
  totalAiRequests30d: number;
  estimatedAiCost30d: number;
  revenue: {
    mrr: number;
    arr: number;
    openInvoices: number;
    failedPayments: number;
    activeSubscriptions: number;
    cancelAtPeriodEnd: number;
  };
  popularCourses: Array<{ name: string; value: number }>;
  popularUnits: Array<{ name: string; value: number }>;
  featureUsage: Array<{ name: string; value: number }>;
  recentAuditCount24h: number;
  suspiciousUsers: number;
  supportHotUsers: number;
  systemStatus: {
    firebaseAdmin: boolean;
    stripe: boolean;
    contentSourceAvailable: boolean;
    lastContentHealthSyncAt?: number;
  };
};

export type UsageTimeseriesPoint = {
  key: string;
  label: string;
  tokens: number;
  costUsd: number;
  requests: number;
  failedRequests: number;
};

export type BillingRiskItem = {
  uid: string;
  email: string | null;
  plan: PlanTier;
  status: string;
  currentPeriodEnd?: number;
  cancelAt?: number | null;
  cancelAtPeriodEnd?: boolean | null;
  amountDue?: number | null;
  invoiceStatus?: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

export type ContentHealthRecord = {
  id: string;
  title: string;
  category: string;
  totalUnits: number;
  totalTopics: number;
  curriculumUnitsPresent: number;
  cedLessonsPresent: number;
  missingCurriculumUnits: string[];
  missingCedLessons: string[];
  missingPracticeUnits: string[];
  missingInteractiveUnits: string[];
  draftUnits: string[];
  unpublishedTopics: string[];
  staleSignals: string[];
};

export type PlatformSettings = {
  maintenanceMode: boolean;
  announcementBanner: {
    enabled: boolean;
    text: string;
    tone: "info" | "warning" | "success" | "danger";
  };
  ai: {
    provider: "anthropic" | "google" | "hybrid";
    chatModel: string;
    explainModel: string;
    hardDailyTokenReserve: number;
  };
  credits: {
    learnerMonthlyTokens: number;
    proMonthlyTokens: number;
    hackerMonthlyTokens: number;
    proDailyMessages: number;
    hackerDailyMessages: number;
  };
  trials: {
    freeTrialDays: number;
    enabled: boolean;
  };
  pricing: {
    showAnnualPromo: boolean;
    defaultCheckoutPlan: string;
  };
  release: {
    waitlistMode: boolean;
    betaAccessMode: "open" | "allowlist" | "disabled";
    studentAppReadOnly: boolean;
  };
  referrals: {
    enabled: boolean;
    promoEnabled: boolean;
    maxRedemptionsPerUser: number;
  };
  abuse: {
    hardRequestsPerMinute: number;
    sharedAccountDeviceThreshold: number;
    couponAbuseThreshold: number;
  };
  content: {
    featuredCourseSlugs: string[];
    homepageCourseOrder: string[];
    courseVisibility: Record<string, boolean>;
    draftCourseSlugs: string[];
    hiddenTopicIds: string[];
  };
  support: {
    supportEmail: string;
    statusPageUrl?: string;
  };
  legal: {
    contentNotice: string;
    updatedAt?: number;
  };
  updatedAt: number;
  updatedBy?: string;
};

export type FeatureFlagRecord = {
  key: string;
  enabled: boolean;
  description: string;
  rollout: {
    strategy: "all" | "none" | "roles" | "cohort" | "percentage" | "uids";
    value?: string[] | number | null;
  };
  updatedAt: number;
  updatedBy?: string;
};

export type AdminNote = {
  id: string;
  targetUid: string;
  authorUid: string;
  authorEmail?: string | null;
  body: string;
  createdAt: number;
  tags?: string[];
};

export type ManualCreditAdjustment = {
  id: string;
  uid: string;
  amount: number;
  reason: string;
  previousValue: number;
  newValue: number;
  source: "manual_add" | "manual_remove" | "reset" | "comp" | "billing_fix";
  actorUid: string;
  actorEmail?: string | null;
  createdAt: number;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  actorUid: string;
  actorEmail?: string | null;
  actorRoles: AdminRole[];
  targetType: "user" | "settings" | "feature_flag" | "billing" | "content" | "system";
  targetId: string;
  reason?: string | null;
  status: "success" | "failed";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: number;
};
