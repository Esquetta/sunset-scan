import { CATEGORIES, DOCS, FACTS_READ_ON, NOT_VISIBLE_IN_CODE, type Coverage } from './rules.js';
import type { Finding, ScanResult } from './scan.js';

const COVERAGE_LABEL: Record<Coverage, string> = {
  'not-covered': 'NOT COVERED',
  'data-only': 'DATA ONLY',
  'not-stated': 'NOT STATED',
};

export function toJson(result: ScanResult, version: string): string {
  const used = new Set(result.findings.map((f) => f.category));
  return JSON.stringify(
    {
      tool: 'sunset-scan',
      version,
      factsReadOn: FACTS_READ_ON,
      deadline: { date: '2027-03-31', source: DOCS.shutdownPost },
      summary: {
        filesScanned: result.filesScanned,
        findings: result.findings.length,
        findingsInTests: result.findings.filter((f) => f.test).length,
        filesWithFindings: new Set(result.findings.map((f) => f.file)).size,
      },
      categories: CATEGORIES.filter((c) => used.has(c.id)).map((c) => ({
        id: c.id,
        title: c.title,
        stripe: c.stripe,
        migrationTool: { coverage: c.coverage, note: c.coverageNote },
        docs: c.docs,
        findings: result.findings.filter((f) => f.category === c.id).map(({ category: _, ...rest }) => rest),
      })),
      notVisibleInCode: NOT_VISIBLE_IN_CODE,
    },
    null,
    2,
  );
}

function wrap(text: string, indent: string, width = 96): string {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && indent.length + line.length + 1 + word.length > width) {
      out.push(indent + line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(indent + line);
  return out.join('\n');
}

function findingLine(f: Finding, width: number): string {
  const where = `${f.file}:${f.line}`.padEnd(width);
  const line = `    ${where}  ${f.match}${f.stripe ? `  ->  ${f.stripe}` : ''}`;
  if (!f.stripe || line.length <= 96) return line;
  // Long Stripe hints go on their own wrapped lines under the match.
  const hint = wrap(f.stripe, ' '.repeat(11)).replace(/^ {11}/, '        -> ');
  return `    ${where}  ${f.match}\n${hint}`;
}

export function toText(result: ScanResult, version: string, color: boolean): string {
  const bold = (s: string) => (color ? `\x1b[1m${s}\x1b[0m` : s);
  const dim = (s: string) => (color ? `\x1b[2m${s}\x1b[0m` : s);
  const yellow = (s: string) => (color ? `\x1b[33m${s}\x1b[0m` : s);
  const out: string[] = [];
  const app = result.findings.filter((f) => !f.test);
  const tests = result.findings.length - app.length;
  const files = new Set(app.map((f) => f.file)).size;

  out.push(bold(`sunset-scan ${version}`) + '  Lemon Squeezy shutdown audit');
  out.push(
    `Scanned ${result.filesScanned} files: ${app.length} findings in ${files} files` +
      (tests ? `, plus ${tests} in test files (listed with --json).` : '.'),
  );
  out.push('');
  if (result.findings.length === 0) {
    out.push('No Lemon Squeezy integration points found in this folder.');
    out.push(dim('Only JavaScript/TypeScript source, markup, config and .env files are scanned.'));
    return out.join('\n') + '\n';
  }
  out.push(
    wrap(
      'Lemon Squeezy stops processing payments on March 31, 2027. Its migration tool moves products, customers and eligible subscriptions to Stripe Managed Payments. It does not change your code. Everything below has to be replaced before that date.',
      '',
    ),
  );
  out.push(dim(DOCS.shutdownPost));
  out.push('');

  const width = Math.min(60, Math.max(0, ...app.map((f) => `${f.file}:${f.line}`.length)));
  for (const category of CATEGORIES) {
    const all = result.findings.filter((f) => f.category === category.id);
    if (all.length === 0) continue;
    const findings = all.filter((f) => !f.test);
    const inTests = all.length - findings.length;
    out.push(bold(`${category.title.toUpperCase()} (${findings.length}${inTests ? `, +${inTests} in tests` : ''})`));
    for (const f of findings) out.push(findingLine(f, width));
    out.push(wrap(`Stripe: ${category.stripe}`, '  '));
    out.push(wrap(`${yellow(`Migration tool: ${COVERAGE_LABEL[category.coverage]}.`)} ${category.coverageNote}`, '  '));
    for (const doc of category.docs) out.push(dim(`  ${doc}`));
    out.push('');
  }

  out.push(bold('NOT VISIBLE IN CODE: CHECK BY HAND'));
  for (const item of NOT_VISIBLE_IN_CODE) {
    out.push(`  - ${wrap(item.text, '    ').trimStart()}`);
    out.push(dim(`    ${item.doc}`));
  }
  out.push('');
  out.push(
    dim(
      wrap(
        `Migration and Stripe facts were read from the linked pages on ${FACTS_READ_ON}; check them again before you act. "Closest Stripe equivalent" is a starting point, not a drop-in replacement. This scan is static and can miss dynamic code. Not affiliated with Lemon Squeezy or Stripe.`,
        '',
      ),
    ),
  );
  return out.join('\n') + '\n';
}

const code = (s: string) => '`' + s.replace(/`/g, "'") + '`';
const linkText = (url: string) => url.replace(/^https:\/\//, '');

function checklistLine(f: Finding): string {
  return `- [ ] ${code(`${f.file}:${f.line}`)} ${code(f.match)}${f.stripe ? ` → ${f.stripe}` : ''}`;
}

/** A checklist to paste into an issue or keep next to the migration branch. */
export function toMarkdown(result: ScanResult, version: string): string {
  const app = result.findings.filter((f) => !f.test);
  const tests = result.findings.length - app.length;
  const files = new Set(app.map((f) => f.file)).size;
  const out: string[] = [];

  out.push('# Lemon Squeezy exit checklist', '');
  out.push(
    `Lemon Squeezy stops processing payments on March 31, 2027 ([source](${DOCS.shutdownPost})). ` +
      'Its migration tool moves products, customers and eligible subscriptions to Stripe Managed Payments; ' +
      'it does not change your code. Tick each item once it is replaced.',
    '',
  );
  out.push(
    `Generated by sunset-scan ${version}: ${result.filesScanned} files scanned, ${app.length} findings in ${files} files` +
      (tests ? `, plus ${tests} in test files.` : '.'),
    '',
  );
  if (result.findings.length === 0) {
    out.push('No Lemon Squeezy integration points found in this folder.', '');
    return out.join('\n');
  }

  for (const category of CATEGORIES) {
    const all = result.findings.filter((f) => f.category === category.id);
    if (all.length === 0) continue;
    const inApp = all.filter((f) => !f.test);
    const inTests = all.filter((f) => f.test);
    out.push(`## ${category.title} (${inApp.length}${inTests.length ? `, +${inTests.length} in tests` : ''})`, '');
    out.push(`**Stripe:** ${category.stripe}`, '');
    out.push(`**Migration tool: ${COVERAGE_LABEL[category.coverage]}.** ${category.coverageNote}`, '');
    out.push(`Docs: ${category.docs.map((d) => `[${linkText(d)}](${d})`).join(', ')}`, '');
    for (const f of inApp) out.push(checklistLine(f));
    if (inTests.length) {
      if (inApp.length) out.push('');
      out.push(`<details><summary>${inTests.length} in test files</summary>`, '');
      for (const f of inTests) out.push(checklistLine(f));
      out.push('', '</details>');
    }
    out.push('');
  }

  out.push('## Not visible in code: check by hand', '');
  for (const item of NOT_VISIBLE_IN_CODE) out.push(`- [ ] ${item.text} ([source](${item.doc}))`);
  out.push('');
  out.push(
    `_Migration and Stripe facts were read from the linked pages on ${FACTS_READ_ON}; check them again before you act. ` +
      'The closest Stripe equivalent is a starting point, not a drop-in replacement. ' +
      'Not affiliated with Lemon Squeezy or Stripe._',
    '',
  );
  return out.join('\n');
}
