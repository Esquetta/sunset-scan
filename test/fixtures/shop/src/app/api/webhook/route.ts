import crypto from 'node:crypto';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!);
  const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
  const signature = Buffer.from(request.headers.get('X-Signature') ?? '', 'utf8');
  if (digest.length !== signature.length || !crypto.timingSafeEqual(digest, signature)) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const userId = event.meta.custom_data?.user_id;
  switch (event.meta.event_name) {
    case 'order_created':
      await grantAccess(userId);
      break;
    case 'subscription_created':
    case 'subscription_updated':
      await syncSubscription(userId, event.data);
      break;
    case 'subscription_cancelled':
    case 'subscription_expired':
      await revokeAccess(userId);
      break;
    case 'subscription_payment_failed':
      await warnUser(userId);
      break;
    case 'license_key_created':
      await storeLicenseKey(userId, event.data);
      break;
  }
  return new Response('ok');
}

declare function grantAccess(userId: string): Promise<void>;
declare function syncSubscription(userId: string, data: unknown): Promise<void>;
declare function revokeAccess(userId: string): Promise<void>;
declare function warnUser(userId: string): Promise<void>;
declare function storeLicenseKey(userId: string, data: unknown): Promise<void>;
