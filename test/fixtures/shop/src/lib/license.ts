const LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses';

async function post(path: string, body: Record<string, string>) {
  const response = await fetch(`${LICENSE_API}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams(body),
  });
  return response.json();
}

export const activate = (key: string, device: string) =>
  post('/activate', { license_key: key, instance_name: device });

export async function validate(key: string) {
  const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
    method: 'POST',
    body: new URLSearchParams({ license_key: key }),
  });
  return response.json();
}
