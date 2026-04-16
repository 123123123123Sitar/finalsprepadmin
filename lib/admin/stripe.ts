import Stripe from "stripe";

let client: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
  if (client !== undefined) return client;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    client = null;
    return client;
  }
  client = new Stripe(secret, { apiVersion: "2024-06-20" });
  return client;
}
