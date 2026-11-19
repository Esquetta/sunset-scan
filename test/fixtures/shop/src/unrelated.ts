// Nothing in this file touches the payment provider; the scanner must stay quiet here.
declare const client: { getOrders(): Promise<unknown[]> };
declare const analytics: { track(name: string): void };

export async function exportOrders() {
  analytics.track('order_created');
  return client.getOrders();
}

export const tls = process.env.TLS_CERT_PATH;
