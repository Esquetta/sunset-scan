import {
  cancelSubscription,
  createCheckout,
  createUsageRecord,
  getSubscription,
  lemonSqueezySetup,
  updateSubscription,
} from '@lemonsqueezy/lemonsqueezy.js';

lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY });

export async function startCheckout(userId: string) {
  const { data } = await createCheckout(
    process.env.LEMONSQUEEZY_STORE_ID!,
    process.env.NEXT_PUBLIC_LS_PRO_VARIANT_ID!,
    { checkoutData: { custom: { user_id: userId } } },
  );
  return data?.data.attributes.url;
}

export async function portalUrl(subscriptionId: string) {
  const { data } = await getSubscription(subscriptionId);
  return data?.data.attributes.urls.customer_portal;
}

export async function changePlan(subscriptionId: string, variantId: number) {
  return updateSubscription(subscriptionId, { variantId });
}

export async function cancel(subscriptionId: string) {
  return cancelSubscription(subscriptionId);
}

export async function reportUsage(subscriptionItemId: number, quantity: number) {
  return createUsageRecord({ subscriptionItemId, quantity });
}
