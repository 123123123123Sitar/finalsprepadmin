import { requireDb } from "@/lib/admin/firestore";
import { normalizePlanTier } from "@/lib/admin/plans";
import { getStripeClient } from "@/lib/admin/stripe";
import type { BillingRiskItem } from "@/lib/admin/types";
import { daysAgo } from "@/lib/admin/utils";

export async function getBillingRiskItems(): Promise<BillingRiskItem[]> {
  const db = requireDb();
  const snap = await db.collectionGroup("profile").limit(5000).get();
  const items: BillingRiskItem[] = [];

  for (const doc of snap.docs) {
    if (doc.id !== "billing") continue;
    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;
    const data = doc.data();
    const status = typeof data.status === "string" ? data.status : "inactive";
    const risky =
      status === "past_due" ||
      status === "incomplete" ||
      status === "unpaid" ||
      Boolean(data.cancelAt) ||
      Boolean(data.canceledAt);
    if (!risky) continue;

    items.push({
      uid,
      email: null,
      plan: normalizePlanTier(data.plan),
      status,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAt: data.cancelAt ?? null,
      cancelAtPeriodEnd: Boolean(data.cancelAt),
      amountDue: data.amountDue ?? null,
      invoiceStatus: data.invoiceStatus ?? null,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
    });
  }

  return items.sort((a, b) => (b.currentPeriodEnd || 0) - (a.currentPeriodEnd || 0));
}

export async function syncStripeSubscriptionIntoFirestore(uid: string) {
  const db = requireDb();
  const stripe = getStripeClient();
  if (!stripe) throw new Error("Stripe is not configured");

  const billingRef = db.doc(`users/${uid}/profile/billing`);
  const billingSnap = await billingRef.get();
  const billing = billingSnap.data() || {};

  let subscriptionId = billing.stripeSubscriptionId as string | undefined;
  if (!subscriptionId && billing.stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: billing.stripeCustomerId,
      status: "all",
      limit: 10,
    });
    subscriptionId = subscriptions.data[0]?.id;
  }

  if (!subscriptionId) {
    throw new Error("No Stripe subscription id found for this user");
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const latestInvoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  const latestInvoice = latestInvoiceId
    ? await stripe.invoices.retrieve(latestInvoiceId)
    : null;

  const payload = {
    plan: normalizePlanTier(billing.plan),
    status: subscription.status,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price?.id,
    currentPeriodEnd: subscription.current_period_end,
    cancelAt: subscription.cancel_at,
    canceledAt: subscription.canceled_at,
    trialEndsAt: subscription.trial_end,
    amountDue: latestInvoice?.amount_due ?? null,
    invoiceStatus: latestInvoice?.status ?? null,
    updatedAt: Date.now(),
  };

  await billingRef.set(payload, { merge: true });
  return payload;
}

export async function getBillingSnapshots(days = 30) {
  const stripe = getStripeClient();
  if (!stripe) return [];

  const invoices = await stripe.invoices.list({
    created: {
      gte: Math.floor(daysAgo(days) / 1000),
    },
    limit: 100,
  });

  return invoices.data.map((invoice) => ({
    id: invoice.id,
    customer: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
    status: invoice.status,
    amountDue: invoice.amount_due / 100,
    amountPaid: invoice.amount_paid / 100,
    createdAt: invoice.created * 1000,
    paidAt: invoice.status_transitions.paid_at
      ? invoice.status_transitions.paid_at * 1000
      : null,
  }));
}
