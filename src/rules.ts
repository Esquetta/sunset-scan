// Every statement about the Lemon Squeezy migration tool and about Stripe in
// this file was read from the linked pages on FACTS_READ_ON. Nothing here is
// written from memory; if a page does not say something, coverage is
// "not-stated".

export const FACTS_READ_ON = '2026-11-19';

export const DOCS = {
  shutdownPost: 'https://www.lemonsqueezy.com/blog/saying-goodbye-to-lemon-squeezy',
  lsMigration: 'https://docs.lemonsqueezy.com/migration',
  lsFaq: 'https://docs.lemonsqueezy.com/migration/faq',
  lsComparison: 'https://docs.lemonsqueezy.com/migration/comparison',
  lsFulfillment: 'https://docs.lemonsqueezy.com/migration/digital-fulfillment',
  lsAffiliates: 'https://docs.lemonsqueezy.com/migration/affiliates',
  lsExport: 'https://docs.lemonsqueezy.com/help/orders/exporting-orders',
  managedPayments: 'https://docs.stripe.com/payments/managed-payments/how-it-works',
  managedPaymentsSetup: 'https://docs.stripe.com/payments/managed-payments/set-up',
  checkoutCreate: 'https://docs.stripe.com/api/checkout/sessions/create',
  checkoutHow: 'https://docs.stripe.com/payments/checkout/how-checkout-works',
  paymentLinks: 'https://docs.stripe.com/payment-links',
  portalCreate: 'https://docs.stripe.com/api/customer_portal/sessions/create',
  portalGuide: 'https://docs.stripe.com/customer-management',
  subscriptions: 'https://docs.stripe.com/api/subscriptions',
  subscriptionsCancel: 'https://docs.stripe.com/billing/subscriptions/cancel',
  pauseCollection: 'https://docs.stripe.com/billing/subscriptions/pause-payment',
  usageBased: 'https://docs.stripe.com/billing/subscriptions/usage-based',
  meterEvents: 'https://docs.stripe.com/api/billing/meter-event/create',
  webhooks: 'https://docs.stripe.com/webhooks',
  webhookEndpoints: 'https://docs.stripe.com/api/webhook_endpoints/create',
  eventTypes: 'https://docs.stripe.com/api/events/types',
  fulfillment: 'https://docs.stripe.com/checkout/fulfillment',
  coupons: 'https://docs.stripe.com/api/coupons',
  promotionCodes: 'https://docs.stripe.com/api/promotion_codes',
  products: 'https://docs.stripe.com/api/products',
  prices: 'https://docs.stripe.com/api/prices',
  customers: 'https://docs.stripe.com/api/customers',
  invoices: 'https://docs.stripe.com/api/invoices',
  refunds: 'https://docs.stripe.com/api/refunds/create',
  keys: 'https://docs.stripe.com/keys',
} as const;

/**
 * What Lemon Squeezy's own migration tool does for this part of an integration.
 * - not-covered: the docs say it is not moved, not included or not redirected.
 * - data-only: the tool moves the records, but the code that uses them still has to change.
 * - not-stated: the migration docs do not mention it.
 */
export type Coverage = 'not-covered' | 'data-only' | 'not-stated';

export type CategoryId =
  | 'setup'
  | 'checkout'
  | 'checkout-links'
  | 'subscriptions'
  | 'portal'
  | 'licenses'
  | 'usage'
  | 'webhooks'
  | 'catalog'
  | 'customers'
  | 'orders'
  | 'discounts'
  | 'files'
  | 'affiliates'
  | 'env'
  | 'api-other';

export interface Category {
  id: CategoryId;
  title: string;
  /** Closest Stripe equivalent. */
  stripe: string;
  coverage: Coverage;
  /** What the migration docs say, quoted or closely paraphrased. */
  coverageNote: string;
  docs: string[];
}

const API_AND_LINKS_QUOTE =
  '"All Lemon Squeezy checkout links, storefront URLs, embedded checkouts, API endpoints, and webhook events must transition to Stripe or another provider. There are no automatic redirects."';

export const CATEGORIES: Category[] = [
  {
    id: 'checkout',
    title: 'Checkout creation',
    stripe:
      'Checkout Sessions: POST /v1/checkout/sessions (mode payment or subscription). To keep a merchant of record, set managed_payments[enabled]=true (Stripe Managed Payments, API version 2025-03-31.basil or later). Custom checkout data maps to metadata or client_reference_id.',
    coverage: 'not-covered',
    coverageNote: `The tool copies products and payment links into a Stripe sandbox; code that creates checkouts is yours to change. ${API_AND_LINKS_QUOTE}`,
    docs: [DOCS.lsFaq, DOCS.checkoutCreate, DOCS.managedPaymentsSetup],
  },
  {
    id: 'checkout-links',
    title: 'Checkout links and overlay (Lemon.js)',
    stripe:
      'Payment Links, or a Checkout Session opened on a hosted page (ui_mode hosted_page) or embedded in your site (ui_mode embedded_page). Lemon.js has no drop-in replacement.',
    coverage: 'not-covered',
    coverageNote: `${API_AND_LINKS_QUOTE} Also: "If you use Lemon Squeezy checkout overlays or a custom checkout, plan to update it."`,
    docs: [DOCS.lsFaq, DOCS.lsMigration, DOCS.paymentLinks, DOCS.checkoutHow],
  },
  {
    id: 'subscriptions',
    title: 'Subscription reads and changes',
    stripe:
      'Subscriptions API: GET/POST/DELETE /v1/subscriptions/:id. Cancel at period end with cancel_at_period_end=true; pause payment collection with pause_collection. A canceled Stripe subscription cannot be reactivated.',
    coverage: 'data-only',
    coverageNote:
      'Eligible subscriptions are migrated (most card subscriptions without customers re-entering details; "PayPal subscriptions can\'t migrate"). IDs change and the API calls must be rewritten.',
    docs: [DOCS.lsMigration, DOCS.subscriptions, DOCS.subscriptionsCancel, DOCS.pauseCollection],
  },
  {
    id: 'portal',
    title: 'Customer portal links',
    stripe:
      'With Managed Payments customers manage subscriptions and payment methods at link.com. You can also create Stripe Customer Portal sessions: POST /v1/billing_portal/sessions (sessions expire after 5 minutes and cannot be shown in an iframe).',
    coverage: 'not-covered',
    coverageNote:
      'Customers "manage subscriptions and payment methods through Link, Stripe\'s consumer platform, instead of the Lemon Squeezy Customer Portal." Portal URLs stored or linked in your app stop working.',
    docs: [DOCS.lsMigration, DOCS.managedPayments, DOCS.portalCreate, DOCS.portalGuide],
  },
  {
    id: 'licenses',
    title: 'Licence keys',
    stripe:
      'No Stripe equivalent. Issue and check keys in your own service (triggered by checkout.session.completed) or connect a licensing provider, and move existing keys there.',
    coverage: 'not-covered',
    coverageNote:
      '"Managed Payments does not offer license-key management or file and link hosting." and "Customers may lose access to their license keys, files, and links after March 31, 2027."',
    docs: [DOCS.lsFaq, DOCS.lsFulfillment, DOCS.fulfillment],
  },
  {
    id: 'usage',
    title: 'Usage records',
    stripe:
      'Billing meter events: POST /v1/billing/meter_events (basic usage-based billing on the Meters API; Stripe recommends Metronome for new usage-based integrations).',
    coverage: 'not-stated',
    coverageNote:
      'The migration docs do not mention usage-based billing. Confirm with Lemon Squeezy support whether usage-based subscriptions are eligible.',
    docs: [DOCS.lsMigration, DOCS.usageBased, DOCS.meterEvents],
  },
  {
    id: 'webhooks',
    title: 'Webhook handlers',
    stripe:
      'A new Stripe webhook endpoint. Verify the Stripe-Signature header with the endpoint\'s whsec_ signing secret and the raw request body, then handle Stripe event types (closest match shown per event). Events can arrive out of order and more than once.',
    coverage: 'not-covered',
    coverageNote: API_AND_LINKS_QUOTE,
    docs: [DOCS.lsFaq, DOCS.webhooks, DOCS.eventTypes, DOCS.webhookEndpoints],
  },
  {
    id: 'catalog',
    title: 'Products, variants and prices',
    stripe:
      'Products and Prices APIs: /v1/products, /v1/prices. Variant IDs in code and config become Stripe Price or Product IDs.',
    coverage: 'data-only',
    coverageNote:
      'The tool creates your products in Stripe. "Stripe doesn\'t support product variants, so each Lemon Squeezy variant becomes its own Stripe product." IDs change and later edits are not synced.',
    docs: [DOCS.lsFaq, DOCS.products, DOCS.prices],
  },
  {
    id: 'customers',
    title: 'Customers',
    stripe: 'Customers API: /v1/customers.',
    coverage: 'data-only',
    coverageNote:
      'Customers are migrated "with a report mapping Lemon Squeezy customer IDs to Stripe customer IDs". Stored customer IDs and the API calls must be updated.',
    docs: [DOCS.lsMigration, DOCS.customers],
  },
  {
    id: 'orders',
    title: 'Orders, invoices and refunds',
    stripe:
      'Checkout Sessions and Invoices for purchase records (/v1/checkout/sessions, /v1/invoices); refunds with POST /v1/refunds.',
    coverage: 'not-stated',
    coverageNote:
      'The migration docs do not say past orders are moved to Stripe; they point to the export guide for customer, order and subscription data.',
    docs: [DOCS.lsMigration, DOCS.lsExport, DOCS.invoices, DOCS.refunds],
  },
  {
    id: 'discounts',
    title: 'Discounts',
    stripe: 'Coupons and Promotion Codes: /v1/coupons, /v1/promotion_codes; apply with discounts or allow_promotion_codes on a Checkout Session.',
    coverage: 'not-stated',
    coverageNote:
      'The migration docs do not say discount codes are recreated in Stripe; they only advise to "Keep any discounts attached to active subscriptions".',
    docs: [DOCS.lsMigration, DOCS.coupons, DOCS.promotionCodes],
  },
  {
    id: 'files',
    title: 'Files and downloads',
    stripe:
      'No Stripe equivalent. Deliver files from your own fulfilment code (triggered by checkout.session.completed) or a fulfilment provider.',
    coverage: 'not-covered',
    coverageNote:
      '"Managed Payments doesn\'t deliver files, download links, or license keys." Historical orders must be moved to the new fulfilment solution before March 31, 2027.',
    docs: [DOCS.lsFulfillment, DOCS.fulfillment],
  },
  {
    id: 'affiliates',
    title: 'Affiliates',
    stripe: 'No Stripe equivalent. Connect an affiliate platform.',
    coverage: 'not-covered',
    coverageNote:
      '"Managed Payments does not offer affiliate management." Lemon Squeezy Affiliates closes on March 31, 2027 and later referrals are not tracked.',
    docs: [DOCS.lsFaq, DOCS.lsAffiliates],
  },
  {
    id: 'setup',
    title: 'SDK dependency and setup',
    stripe:
      'Stripe\'s server library with a secret or restricted API key (sk_... / rk_...). Remove the Lemon Squeezy package once nothing imports it.',
    coverage: 'not-covered',
    coverageNote: API_AND_LINKS_QUOTE,
    docs: [DOCS.lsFaq, DOCS.keys],
  },
  {
    id: 'api-other',
    title: 'Other direct API calls',
    stripe: 'Depends on the endpoint. Review each call against the Stripe API.',
    coverage: 'not-covered',
    coverageNote: API_AND_LINKS_QUOTE,
    docs: [DOCS.lsFaq],
  },
  {
    id: 'env',
    title: 'Environment variables',
    stripe:
      'Stripe API key (sk_... / rk_...), publishable key (pk_...), webhook signing secret (whsec_...) and Price or Product IDs. Names only are reported; values are never read into the report.',
    coverage: 'not-covered',
    coverageNote:
      'Configuration lives in your project and hosting, outside the migration tool. Each variable needs a Stripe counterpart or removal.',
    docs: [DOCS.keys, DOCS.webhooks],
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Lemon Squeezy webhook event -> closest Stripe event. Lemon Squeezy names from its event-types page. */
export const WEBHOOK_EVENTS: Record<string, string> = {
  order_created: 'checkout.session.completed',
  order_refunded: 'charge.refunded (details in refund.created)',
  customer_updated: 'customer.updated',
  subscription_created: 'customer.subscription.created',
  subscription_updated: 'customer.subscription.updated',
  subscription_cancelled:
    'customer.subscription.updated with cancel_at_period_end=true (the subscription is still active until the period ends)',
  subscription_resumed: 'customer.subscription.updated with cancel_at_period_end back to false',
  subscription_expired: 'customer.subscription.deleted',
  subscription_paused:
    'customer.subscription.updated with pause_collection set (customer.subscription.paused only fires for status=paused)',
  subscription_unpaused: 'customer.subscription.updated with pause_collection unset',
  subscription_payment_success: 'invoice.paid',
  subscription_payment_failed: 'invoice.payment_failed',
  subscription_payment_recovered: 'invoice.paid (Stripe has no separate "recovered" event)',
  subscription_payment_refunded: 'charge.refunded',
  license_key_created: 'none: Stripe has no licence keys',
  license_key_updated: 'none: Stripe has no licence keys',
  affiliate_activated: 'none: Stripe has no affiliate programme',
};

export const SDK_PACKAGES = ['@lemonsqueezy/lemonsqueezy.js', 'lemonsqueezy.ts'];

/**
 * Method names of the client classes in @lemonsqueezy/lemonsqueezy.js v1
 * (`new LemonSqueezy(key)`) and lemonsqueezy.ts (`new LemonsqueezyClient(key)`),
 * plus the function names of the current SDK, read from the packages' type
 * definitions. Used to recognise calls on a client object that was created in
 * another file.
 */
export const SDK_FUNCTIONS = new Set(
  `activateLicense archiveCustomer cancelSubscription createCheckout createCustomer createDiscount
  createUsageRecord createWebhook deactivateLicense deleteDiscount deleteWebhook generateOrderInvoice
  generateSubscriptionInvoice getAuthenticatedUser getCheckout getCustomer getDiscount
  getDiscountRedemption getFile getLicenseKey getLicenseKeyInstance getOrder getOrderItem getPrice
  getProduct getStore getSubscription getSubscriptionInvoice getSubscriptionItem
  getSubscriptionItemCurrentUsage getUsageRecord getVariant getWebhook issueOrderRefund
  issueSubscriptionInvoiceRefund lemonSqueezySetup listCheckouts listCustomers listDiscountRedemptions
  listDiscounts listFiles listLicenseKeyInstances listLicenseKeys listOrderItems listOrders listPrices
  listProducts listStores listSubscriptionInvoices listSubscriptionItems listSubscriptions
  listUsageRecords listVariants listWebhooks updateCustomer updateLicenseKey updateSubscription
  updateSubscriptionItem updateWebhook validateLicense
  getCheckouts getCustomers getDiscountRedemptions getDiscounts getFiles getLicenseKeyInstances
  getLicenseKeys getOrderItems getOrders getPrices getProducts getStores getSubscriptionInvoices
  getSubscriptionItemUsage getSubscriptionItems getSubscriptions getUsageRecords getUser getVariants
  getWebhooks pauseSubscription resumeSubscription unpauseSubscription
  listAllCheckouts listAllCustomers listAllDiscounts listAllFiles listAllLicenseKeyInstances
  listAllLicenseKeys listAllOrderItems listAllOrders listAllProducts listAllStores
  listAllSubscriptionInvoices listAllSubscriptions listAllVariants retrieveCheckout retrieveCustomer
  retrieveDiscount retrieveFile retrieveLicenseKey retrieveLicenseKeyInstance retrieveOrder
  retrieveOrderItem retrieveProduct retrieveStore retrieveSubscription retrieveSubscriptionInvoice
  retrieveVariant`
    .split(/\s+/)
    .filter(Boolean),
);

/** Category of an SDK function or method, from its name. */
export function categoryOfSdkName(name: string): CategoryId {
  if (/licen[sc]e/i.test(name)) return 'licenses';
  if (/usage/i.test(name)) return 'usage';
  if (/checkout/i.test(name)) return 'checkout';
  if (/webhook/i.test(name)) return 'webhooks';
  if (/discount/i.test(name)) return 'discounts';
  if (/file/i.test(name)) return 'files';
  if (/subscriptionInvoice|order|refund/i.test(name)) return 'orders';
  if (/subscription/i.test(name)) return 'subscriptions';
  if (/customer/i.test(name)) return 'customers';
  if (/product|variant|price/i.test(name)) return 'catalog';
  return 'setup';
}

/** Category of a direct API path such as `/v1/subscription-items`. */
export function categoryOfApiPath(resource: string): CategoryId {
  switch (resource) {
    case 'licenses':
    case 'license-keys':
    case 'license-key-instances':
      return 'licenses';
    case 'checkouts':
      return 'checkout';
    case 'subscriptions':
    case 'subscription-items':
      return 'subscriptions';
    case 'usage-records':
      return 'usage';
    case 'subscription-invoices':
    case 'orders':
    case 'order-items':
      return 'orders';
    case 'customers':
      return 'customers';
    case 'products':
    case 'variants':
    case 'prices':
      return 'catalog';
    case 'discounts':
    case 'discount-redemptions':
      return 'discounts';
    case 'files':
      return 'files';
    case 'webhooks':
      return 'webhooks';
    case 'affiliates':
      return 'affiliates';
    case 'stores':
    case 'users':
      return 'setup';
    default:
      return 'api-other';
  }
}

export const API_RESOURCES = [
  'license-key-instances',
  'license-keys',
  'licenses',
  'checkouts',
  'subscription-invoices',
  'subscription-items',
  'subscriptions',
  'usage-records',
  'order-items',
  'orders',
  'customers',
  'products',
  'variants',
  'prices',
  'discount-redemptions',
  'discounts',
  'files',
  'webhooks',
  'affiliates',
  'stores',
  'users',
];

/** What a Lemon Squeezy environment variable most likely becomes, from its name. */
export function envHint(name: string): string {
  if (/WEBHOOK|SIGNING/.test(name)) return 'Stripe webhook signing secret (whsec_...)';
  if (/VARIANT|PRODUCT|PLAN|PRICE/.test(name)) return 'Stripe Price or Product ID';
  if (/STORE/.test(name)) return 'store identifier: check whether anything still needs it';
  if (/KEY|SECRET|TOKEN/.test(name)) return 'Stripe secret or restricted API key (sk_... / rk_...)';
  return 'review';
}

/** Things a code scan cannot see, each taken from the migration docs. */
export const NOT_VISIBLE_IN_CODE: { text: string; doc: string }[] = [
  {
    text: 'Subscriptions paid with PayPal cannot migrate; those customers must start a new subscription with a supported payment method.',
    doc: DOCS.lsMigration,
  },
  {
    text: 'Links outside this project (emails, docs, social posts, affiliate links) are not redirected.',
    doc: DOCS.lsMigration,
  },
  {
    text: 'Files, download links and licence keys already delivered to customers may stop working after March 31, 2027.',
    doc: DOCS.lsFulfillment,
  },
  {
    text: 'Stripe Managed Payments is not available in every country Lemon Squeezy supports; check eligibility for your business location first.',
    doc: 'https://docs.stripe.com/payments/managed-payments/eligibility',
  },
];
