import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import {
  API_RESOURCES,
  CATEGORIES,
  SDK_FUNCTIONS,
  WEBHOOK_EVENTS,
  categoryOfApiPath,
  categoryOfSdkName,
  envHint,
  type CategoryId,
} from './rules.js';

export type FindingKind =
  | 'dependency'
  | 'import'
  | 'sdk-call'
  | 'api-call'
  | 'link'
  | 'overlay'
  | 'portal-url'
  | 'webhook-signature'
  | 'webhook-event'
  | 'custom-data'
  | 'env-var'
  | 'stored-id';

export interface Finding {
  category: CategoryId;
  kind: FindingKind;
  /** Path relative to the scanned folder, with forward slashes. */
  file: string;
  line: number;
  /** What was matched. For environment variables this is the name only. */
  match: string;
  /** Closest Stripe equivalent for this specific finding, when more precise than the category's. */
  stripe?: string;
  /** True when the file looks like a test, fixture or mock. */
  test?: boolean;
}

export interface ScanResult {
  filesScanned: number;
  findings: Finding[];
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'vendor',
  '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.turbo', '.vercel', '.netlify', '.cache',
]);
const SKIP_FILES = new Set(['package-lock.json', 'npm-shrinkwrap.json']);
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.astro']);
const MARKUP_EXT = new Set(['.html', '.htm', '.md', '.mdx']);
const CONFIG_EXT = new Set(['.json', '.yml', '.yaml', '.toml']);
const SCHEMA_EXT = new Set(['.prisma', '.sql']);
const TEST_PATH = /(?:^|\/)(?:__tests__|__mocks__|tests?|e2e|fixtures?|mocks?|cypress|playwright)\/|\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/i;
const MAX_BYTES = 1_000_000;

type FileType = 'code' | 'markup' | 'config' | 'env' | 'package' | 'schema';

function fileType(name: string): FileType | undefined {
  if (name === 'package.json') return 'package';
  if (SKIP_FILES.has(name) || name.endsWith('.min.js') || name.endsWith('.d.ts')) return undefined;
  if (name.startsWith('.env') || name.endsWith('.env')) return 'env';
  const ext = extname(name);
  if (CODE_EXT.has(ext)) return 'code';
  if (MARKUP_EXT.has(ext)) return 'markup';
  if (CONFIG_EXT.has(ext)) return 'config';
  if (SCHEMA_EXT.has(ext)) return 'schema';
  return undefined;
}

function* walk(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

const SDK_MODULE = String.raw`(?:@lemonsqueezy/lemonsqueezy\.js|lemonsqueezy\.ts)(?:/[^'"]*)?`;
const IMPORT_RE = new RegExp(String.raw`import\s+(type\s+)?([\w*\s{},$]*?)\s*from\s*['"](${SDK_MODULE})['"]`, 'g');
const REQUIRE_RE = new RegExp(
  String.raw`(?:(?:const|let|var)\s+([\w$]+|\{[^}]*\})\s*=\s*)?(?:await\s+)?(?:require|import)\s*\(\s*['"](${SDK_MODULE})['"]\s*\)`,
  'g',
);
const MENTIONS_LS = /lemon[\s_-]?squeezy|lmsqueezy/i;
const LS_RECEIVER = /^(?:ls|lsq|\w*lemon\w*|\w*squeezy\w*)$/i;
const API_HOST_RE = /api\.lemonsqueezy\.com(?:\/v1\/([a-z-]+)(?:\/([a-z-]+))?)?/g;
const API_FRAGMENT_RE = new RegExp('[\'"`}]/(?:v1/)?(' + API_RESOURCES.join('|') + ')(?:/(activate|validate|deactivate))?(?![\\w-])', 'g');
const CHECKOUT_LINK_RE = /([\w-]*)\.?lemonsqueezy\.com\/(checkout\/buy|checkout\/custom|checkout|buy)\b/g;
const PORTAL_LINK_RE = /lemonsqueezy\.com\/billing\b/g;
const LEMON_JS_RE = /(?:lemonsqueezy|lmsqueezy)\.com\/(?:js\/)?lemon\.js/g;
const OVERLAY_RE = /lemonsqueezy-button|createLemonSqueezy|LemonSqueezy\.(?:Setup|Refresh|Url\.Open|Url\.Close)|Checkout\.Success|PaymentMethodUpdate\.(?:Mounted|Closed|Updated)/g;
const AFFILIATE_RE = /LemonSqueezy\.Affiliate\.\w+|lmsqueezy\.com\/affiliate\.js/g;
const STORED_ID_RE = /\b\w*lemon_?squeezy\w*\b/gi;
const SCHEMA_PATH = /schema|migration|\/models?\/|entit/i;
const PORTAL_PROP_RE = /\b(?:customer_portal_update_subscription|customer_portal|update_payment_method)\b/g;
const EVENT_NAMES = Object.keys(WEBHOOK_EVENTS).join('|');
const EVENT_RE = new RegExp('[\'"`](' + EVENT_NAMES + ')[\'"`]', 'g');
// Unquoted object keys in a handler map: `subscription_created: onCreated,`
const EVENT_KEY_RE = new RegExp('(?<![\\w.$])(' + EVENT_NAMES + ')\\s*:(?!:)', 'g');
// Upper-case names with at least one underscore, not ending in one (skips template prefixes like `LS_${plan}`).
const ENV_TOKEN_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b(?![`$])/g;
// `env` as its own word: process.env, import.meta.env, env.X; not FOO_ENV_KEYS.
const ENV_LINE = /\benv\b/i;
const LS_ENV_NAME = /LEMON|LMSQUEEZY|^(?:(?:NEXT_PUBLIC|NUXT_PUBLIC|EXPO_PUBLIC|REACT_APP|VITE|PUBLIC|NUXT)_)?LS_[A-Z0-9_]+$/;
const ENV_FILE_KEY = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

function lineOf(content: string, index: number): number {
  let line = 1;
  for (let i = content.indexOf('\n'); i !== -1 && i < index; i = content.indexOf('\n', i + 1)) line++;
  return line;
}

/** Local names bound by an import clause or a require destructuring pattern. */
function parseBindings(clause: string): { named: Map<string, string>; whole: string[] } {
  const named = new Map<string, string>();
  const whole: string[] = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  if (braces?.[1]) {
    for (const part of braces[1].split(',')) {
      const m = /^\s*(type\s+)?([\w$]+)(?:\s*(?:as|:)\s*([\w$]+))?\s*$/.exec(part);
      if (m && !m[1] && m[2]) named.set(m[3] ?? m[2], m[2]);
    }
  }
  const rest = clause.replace(/\{[^}]*\}/, '');
  for (const part of rest.split(',')) {
    const m = /^\s*(?:\*\s*as\s+)?([\w$]+)\s*$/.exec(part);
    if (m?.[1]) whole.push(m[1]);
  }
  return { named, whole };
}

function scanPackageJson(content: string, add: Add): void {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }
  const lines = content.split(/\r?\n/);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[section];
    if (!deps || typeof deps !== 'object') continue;
    for (const name of Object.keys(deps)) {
      // @lemonsqueezy/wedges is a UI component library, not a payments integration.
      if (!MENTIONS_LS.test(name) || name === '@lemonsqueezy/wedges') continue;
      const line = lines.findIndex((l) => l.includes(`"${name}"`)) + 1;
      add('setup', 'dependency', line || 1, name);
    }
  }
}

type Add = (category: CategoryId, kind: FindingKind, line: number, match: string, stripe?: string) => void;

function scanEnvFile(lines: string[], add: Add): void {
  lines.forEach((text, i) => {
    const name = ENV_FILE_KEY.exec(text)?.[1];
    if (name && LS_ENV_NAME.test(name)) add('env', 'env-var', i + 1, name, envHint(name));
  });
}

function scanEnvNames(lines: string[], everyLine: boolean, add: Add): void {
  const seen = new Set<string>();
  lines.forEach((text, i) => {
    if (!everyLine && !ENV_LINE.test(text)) return;
    for (const m of text.matchAll(ENV_TOKEN_RE)) {
      const name = m[0];
      if (!LS_ENV_NAME.test(name) || seen.has(name)) continue;
      seen.add(name);
      add('env', 'env-var', i + 1, name, envHint(name));
    }
  });
}

function scanStoredIds(lines: string[], add: Add): void {
  const seen = new Set<string>();
  lines.forEach((text, i) => {
    if (/^\s*(?:\/\/|--|#)/.test(text)) return;
    for (const m of text.matchAll(STORED_ID_RE)) {
      const name = m[0];
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      add('stored-ids', 'stored-id', i + 1, name);
    }
  });
}

function scanLinks(lines: string[], mentionsLs: boolean, add: Add): void {
  lines.forEach((text, i) => {
    const n = i + 1;
    for (const m of text.matchAll(CHECKOUT_LINK_RE)) {
      if (m[1] === 'api' || m[1] === 'docs') continue;
      add('checkout-links', 'link', n, `lemonsqueezy.com/${m[2]}`);
    }
    for (const _ of text.matchAll(PORTAL_LINK_RE)) add('portal', 'link', n, 'lemonsqueezy.com/billing');
    for (const _ of text.matchAll(LEMON_JS_RE)) add('checkout-links', 'overlay', n, 'lemon.js script');
    if (/lemonsqueezy\.imgix\.net/.test(text)) add('files', 'link', n, 'lemonsqueezy.imgix.net (image hosted by Lemon Squeezy)');
    for (const m of text.matchAll(AFFILIATE_RE)) add('affiliates', 'overlay', n, m[0]);
    if (!mentionsLs) return;
    for (const m of text.matchAll(OVERLAY_RE)) add('checkout-links', 'overlay', n, m[0]);
  });
}

function scanCode(content: string, lines: string[], mentionsLs: boolean, add: Add): void {
  const fns = new Map<string, string>(); // local name -> SDK name
  const receivers = new Set<string>(); // namespaces and client instances
  const classes = new Set<string>();

  const bind = (clause: string | undefined) => {
    if (!clause) return;
    const { named, whole } = parseBindings(clause);
    for (const [local, original] of named) {
      if (/^Lemon\w*$/.test(original)) classes.add(local);
      else fns.set(local, original);
    }
    for (const name of whole) {
      receivers.add(name);
      classes.add(name);
    }
  };
  for (const m of content.matchAll(IMPORT_RE)) {
    bind(m[2]);
    add('setup', 'import', lineOf(content, m.index + m[0].length), `import from '${m[3]}'`);
  }
  for (const m of content.matchAll(REQUIRE_RE)) {
    bind(m[1]);
    add('setup', 'import', lineOf(content, m.index + m[0].length), `import from '${m[2]}'`);
  }
  if (classes.size) {
    const newRe = new RegExp(String.raw`([\w$]+)\s*(?::[^=]+)?=\s*new\s+(?:${[...classes].join('|').replace(/\$/g, '\\$')})\s*\(`, 'g');
    for (const m of content.matchAll(newRe)) if (m[1]) receivers.add(m[1]);
  }

  const fnRe = fns.size
    ? new RegExp(String.raw`(?<![\w$.])(${[...fns.keys()].join('|').replace(/\$/g, '\\$')})\s*(?:<[^<>()]*>)?\s*\(`, 'g')
    : undefined;
  const memberRe = /([\w$]+)\s*\??\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
  const hasApiHost = content.includes('api.lemonsqueezy.com');
  // Provider-agnostic handlers often never name the provider; three or more
  // distinct Lemon Squeezy event names in one file are enough evidence.
  const eventNames = new Set([...content.matchAll(EVENT_RE), ...content.matchAll(EVENT_KEY_RE)].map((m) => m[1]));
  const hasEvents = mentionsLs || /event_name|x-signature/i.test(content) || eventNames.size >= 3;

  lines.forEach((text, i) => {
    const n = i + 1;
    if (fnRe && !/^\s*(?:export\s+)?(?:async\s+)?function\b/.test(text)) {
      for (const m of text.matchAll(fnRe)) {
        const original = fns.get(m[1] ?? '') ?? '';
        add(categoryOfSdkName(original), 'sdk-call', n, `${original}()`);
      }
    }
    for (const m of text.matchAll(memberRe)) {
      const receiver = m[1] ?? '';
      const method = m[2] ?? '';
      const known = SDK_FUNCTIONS.has(method);
      // Any method on an SDK namespace or client created in this file; elsewhere
      // only known SDK method names on an object whose name points at Lemon Squeezy.
      if (!receivers.has(receiver) && !(known && LS_RECEIVER.test(receiver))) continue;
      if (!known && /^(?:then|catch|finally)$/.test(method)) continue;
      add(categoryOfSdkName(method), 'sdk-call', n, `${receiver}.${method}()`);
    }

    let hostOnLine = false;
    for (const m of text.matchAll(API_HOST_RE)) {
      hostOnLine = true;
      const path = m[1] ? `/v1/${m[1]}${m[2] ? `/${m[2]}` : ''}` : '';
      add(m[1] ? categoryOfApiPath(m[1]) : 'api-other', 'api-call', n, `api.lemonsqueezy.com${path}`);
    }
    if (hasApiHost && !hostOnLine) {
      for (const m of text.matchAll(API_FRAGMENT_RE)) {
        const resource = m[1] ?? '';
        add(categoryOfApiPath(resource), 'api-call', n, `/v1/${resource}${m[2] ? `/${m[2]}` : ''}`);
      }
    }

    if (hasEvents) {
      if (/x-signature/i.test(text)) add('webhooks', 'webhook-signature', n, 'X-Signature check');
      for (const m of [...text.matchAll(EVENT_RE), ...text.matchAll(EVENT_KEY_RE)]) {
        const event = m[1] ?? '';
        add(event.startsWith('license') ? 'licenses' : event.startsWith('affiliate') ? 'affiliates' : 'webhooks', 'webhook-event', n, event, WEBHOOK_EVENTS[event]);
      }
    }
    if (mentionsLs) {
      if (/\bcustom_data\b/.test(text)) {
        add('webhooks', 'custom-data', n, 'custom_data', 'metadata or client_reference_id on the Checkout Session');
      }
      for (const m of text.matchAll(PORTAL_PROP_RE)) add('portal', 'portal-url', n, `urls.${m[0]}`);
    }
  });
}

const CATEGORY_ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i]));

export function scan(root: string): ScanResult {
  const findings: Finding[] = [];
  let filesScanned = 0;

  for (const full of walk(root)) {
    const type = fileType(basename(full));
    if (!type || statSync(full).size > MAX_BYTES) continue;
    const content = readFileSync(full, 'utf8');
    filesScanned++;
    const file = relative(root, full).split('\\').join('/');
    const isTest = TEST_PATH.test(file);
    const seen = new Set<string>();
    const add: Add = (category, kind, line, match, stripe) => {
      const key = `${category}|${kind}|${line}|${match}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push({ category, kind, file, line, match, ...(stripe ? { stripe } : {}), ...(isTest ? { test: true } : {}) });
    };

    if (type === 'package') {
      scanPackageJson(content, add);
      continue;
    }
    const lines = content.split(/\r?\n/);
    if (type === 'env') {
      scanEnvFile(lines, add);
      continue;
    }
    const mentionsLs = MENTIONS_LS.test(content);
    if (type === 'schema' || (type === 'code' && mentionsLs && SCHEMA_PATH.test(file) && !isTest)) scanStoredIds(lines, add);
    if (type === 'schema') continue;
    scanLinks(lines, mentionsLs, add);
    if (type === 'code') scanCode(content, lines, mentionsLs, add);
    if (type === 'code') scanEnvNames(lines, /env/i.test(basename(full)), add);
    if (type === 'config') scanEnvNames(lines, true, add);
  }

  // A stored ID column usually shows up in a schema and in every old migration.
  // Report each name once, preferring the schema over migration history.
  const storedFirst = new Map<string, Finding>();
  const isMigration = (f: Finding) => /(?:^|\/)migrations?\//i.test(f.file);
  for (const f of findings) {
    if (f.kind !== 'stored-id') continue;
    const key = f.match.toLowerCase();
    const current = storedFirst.get(key);
    if (!current || (isMigration(current) && !isMigration(f))) storedFirst.set(key, f);
  }
  const keep = new Set(storedFirst.values());
  const deduped = findings.filter((f) => f.kind !== 'stored-id' || keep.has(f));
  findings.length = 0;
  findings.push(...deduped);

  findings.sort(
    (a, b) =>
      (CATEGORY_ORDER.get(a.category) ?? 0) - (CATEGORY_ORDER.get(b.category) ?? 0) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
  return { filesScanned, findings };
}
