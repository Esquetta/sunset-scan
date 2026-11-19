import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { toJson, toText } from './report.js';
import { CATEGORIES, WEBHOOK_EVENTS } from './rules.js';
import { scan, type Finding } from './scan.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'shop');

const pick = (findings: Finding[], file: string) =>
  findings.filter((f) => f.file === file).map((f) => `${f.line} ${f.category} ${f.match}`);

describe('fixture project', () => {
  const { findings, filesScanned } = scan(FIXTURE);

  it('scans source, markup, config and env files', () => {
    expect(filesScanned).toBe(13);
  });

  it('finds the dependency and both import styles', () => {
    expect(pick(findings, 'package.json')).toEqual(['5 setup @lemonsqueezy/lemonsqueezy.js']);
    expect(findings.filter((f) => f.kind === 'import').map((f) => f.file)).toEqual([
      'src/legacy/client.js',
      'src/lib/billing.ts',
    ]);
  });

  it('groups SDK calls by what they do', () => {
    expect(pick(findings, 'src/lib/billing.ts').filter((s) => s.includes('()'))).toEqual([
      '13 checkout createCheckout()',
      '22 subscriptions getSubscription()',
      '27 subscriptions updateSubscription()',
      '31 subscriptions cancelSubscription()',
      '35 usage createUsageRecord()',
      '10 setup lemonSqueezySetup()',
    ]);
  });

  it('finds methods on a legacy client instance', () => {
    expect(pick(findings, 'src/legacy/client.js')).toContain('5 subscriptions ls.getSubscriptions()');
  });

  it('finds the webhook signature check and every handled event with its Stripe match', () => {
    const webhook = findings.filter((f) => f.file === 'src/app/api/webhook/route.ts' && f.kind === 'webhook-event');
    expect(webhook.map((f) => f.match)).toEqual([
      'license_key_created',
      'order_created',
      'subscription_created',
      'subscription_updated',
      'subscription_cancelled',
      'subscription_expired',
      'subscription_payment_failed',
    ]);
    expect(webhook.find((f) => f.match === 'order_created')?.stripe).toBe('checkout.session.completed');
    expect(findings.some((f) => f.kind === 'webhook-signature' && f.line === 7)).toBe(true);
  });

  it('finds direct licence API calls', () => {
    expect(pick(findings, 'src/lib/license.ts')).toEqual([
      '1 licenses api.lemonsqueezy.com/v1/licenses',
      '16 licenses api.lemonsqueezy.com/v1/licenses/validate',
    ]);
  });

  it('finds checkout links, lemon.js, overlays and portal links', () => {
    expect(pick(findings, 'public/index.html')).toEqual([
      '4 checkout-links lemon.js script',
      '8 portal lemonsqueezy.com/billing',
      '9 files lemonsqueezy.imgix.net (image hosted by Lemon Squeezy)',
      '5 affiliates lmsqueezy.com/affiliate.js',
    ]);
    expect(pick(findings, 'src/components/BuyButton.tsx')).toContain('15 checkout-links lemonsqueezy.com/checkout/buy');
    expect(pick(findings, 'src/components/BuyButton.tsx')).toContain('22 checkout-links LemonSqueezy.Url.Open');
    expect(pick(findings, 'src/lib/billing.ts')).toContain('23 portal urls.customer_portal');
  });

  it('reports environment variable names and never their values', () => {
    expect(pick(findings, '.env.example')).toEqual([
      '2 env LEMONSQUEEZY_API_KEY',
      '3 env LEMONSQUEEZY_STORE_ID',
      '4 env LEMONSQUEEZY_WEBHOOK_SECRET',
      '5 env NEXT_PUBLIC_LS_PRO_VARIANT_ID',
    ]);
    const json = toJson(scan(FIXTURE), 'test');
    expect(json).not.toContain('fixture-value-not-a-real-key');
    expect(json).not.toContain('DATABASE_URL');
  });

  it('finds handler maps that never name the provider', () => {
    expect(pick(findings, 'src/server/subscription-events.ts')).toEqual([
      '5 webhooks subscription_resumed',
      '6 webhooks subscription_paused',
      '7 webhooks subscription_unpaused',
    ]);
  });

  it('reports stored IDs once, from the schema rather than migration history', () => {
    expect(findings.filter((f) => f.kind === 'stored-id').map((f) => `${f.file}:${f.line} ${f.match}`)).toEqual([
      'prisma/schema.prisma:4 lemonSqueezyCustomerId',
      'prisma/schema.prisma:5 lemonSqueezySubscriptionId',
    ]);
  });

  it('flags findings in test files and keeps them out of the main text list', () => {
    const inTests = findings.filter((f) => f.test);
    expect(inTests.map((f) => `${f.file} ${f.match}`)).toEqual(['src/__tests__/webhook.test.ts subscription_created']);
    expect(toText(scan(FIXTURE), 'test', false)).not.toContain('src/__tests__/webhook.test.ts');
  });

  it('stays quiet on code that does not use Lemon Squeezy', () => {
    expect(pick(findings, 'src/unrelated.ts')).toEqual([]);
  });
});

describe('scanner behaviour', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });
  const project = (files: Record<string, string>) => {
    dir = mkdtempSync(join(tmpdir(), 'sunset-scan-'));
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), content);
    }
    return dir;
  };

  it('skips node_modules and build output', () => {
    const root = project({
      'node_modules/x/index.js': "fetch('https://api.lemonsqueezy.com/v1/checkouts')",
      '.next/server.js': "fetch('https://api.lemonsqueezy.com/v1/checkouts')",
      'src/a.ts': "fetch('https://api.lemonsqueezy.com/v1/checkouts')",
    });
    expect(scan(root).findings.map((f) => f.file)).toEqual(['src/a.ts']);
  });

  it('handles aliased imports, namespace imports and API path fragments', () => {
    const root = project({
      'a.ts': [
        "import { activateLicense as activate } from '@lemonsqueezy/lemonsqueezy.js';",
        "import * as ls from '@lemonsqueezy/lemonsqueezy.js';",
        'await activate(key, name);',
        'await ls.listOrders();',
      ].join('\n'),
      'b.ts': [
        "const BASE = 'https://api.lemonsqueezy.com';",
        'await fetch(`${BASE}/v1/subscriptions/${id}`, { method: "DELETE" });',
      ].join('\n'),
    });
    expect(scan(root).findings.map((f) => `${f.file}:${f.line} ${f.category} ${f.match}`)).toEqual([
      'b.ts:2 subscriptions /v1/subscriptions',
      'a.ts:3 licenses activateLicense()',
      'a.ts:4 orders ls.listOrders()',
      'a.ts:1 setup import from \'@lemonsqueezy/lemonsqueezy.js\'',
      'a.ts:2 setup import from \'@lemonsqueezy/lemonsqueezy.js\'',
      'b.ts:1 api-other api.lemonsqueezy.com',
    ]);
  });

  it('does not change the scanned folder', () => {
    const before = readdirSync(FIXTURE, { recursive: true }).map(String).sort();
    const mtimes = before.map((p) => statSync(join(FIXTURE, p)).mtimeMs);
    scan(FIXTURE);
    expect(readdirSync(FIXTURE, { recursive: true }).map(String).sort()).toEqual(before);
    expect(before.map((p) => statSync(join(FIXTURE, p)).mtimeMs)).toEqual(mtimes);
  });
});

describe('rules and report', () => {
  it('maps every Lemon Squeezy webhook event and links docs for every category', () => {
    expect(Object.keys(WEBHOOK_EVENTS)).toHaveLength(17);
    for (const c of CATEGORIES) {
      expect(c.docs.length).toBeGreaterThan(0);
      for (const url of c.docs) expect(url).toMatch(/^https:\/\//);
    }
  });

  it('prints a text report without colour codes when colour is off', () => {
    const text = toText(scan(FIXTURE), 'test', false);
    expect(text).not.toContain('\x1b[');
    expect(text).toContain('WEBHOOK HANDLERS (11, +1 in tests)');
    expect(text).toContain('Migration tool: NOT COVERED.');
  });

  it('keeps the README example in step with real output', () => {
    const readme = readFileSync(join(FIXTURE, '..', '..', '..', 'README.md'), 'utf8');
    const block = /<!-- example:start -->\n```text\n([\s\S]*?)```\n<!-- example:end -->/.exec(readme)?.[1];
    expect(block).toBeDefined();
    const text = toText(scan(FIXTURE), '0.0.0', false);
    // The README shows excerpts separated by "[...]" lines; each excerpt must be real output.
    const chunks = block!.trimEnd().split(/\n\[\.\.\.\]\n/);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(text).toContain(chunk);
  });
});

describe('safety', () => {
  it('has no network or write access in shipped code', () => {
    const srcDir = dirname(fileURLToPath(import.meta.url));
    for (const name of readdirSync(srcDir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
      const source = readFileSync(join(srcDir, name), 'utf8');
      expect(source, name).not.toMatch(/node:(?:https?|net|tls|dgram|child_process)|\bfetch\s*\(|writeFile|appendFile|unlink|rmSync|mkdir/);
    }
  });
});
