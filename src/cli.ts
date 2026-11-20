#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { toJson, toMarkdown, toText } from './report.js';
import { scan } from './scan.js';

const HELP = `Usage: sunset-scan [path] [--json | --markdown]

Lists what breaks in a JavaScript/TypeScript project when Lemon Squeezy
shuts down, with the closest Stripe equivalent for each finding.
Read-only: nothing in the scanned folder is changed and no network calls are made.

  path        Folder to scan (default: current folder)
  --json      Print the report as JSON
  --markdown  Print the report as a Markdown checklist (redirect it to a file
              to keep it, for example > lemon-squeezy-exit.md)
  --version   Print the version
  --help      Print this help
`;

function main(argv: string[]): number {
  const version = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string })
    .version;
  const flags = argv.filter((a) => a.startsWith('-'));
  const paths = argv.filter((a) => !a.startsWith('-'));
  const unknown = flags.find((f) => !['--json', '--markdown', '--md', '--help', '-h', '--version', '-v'].includes(f));
  const json = flags.includes('--json');
  const markdown = flags.includes('--markdown') || flags.includes('--md');
  const problem = unknown
    ? `Unknown option: ${unknown}`
    : paths.length > 1
      ? 'Pass one folder at most.'
      : json && markdown
        ? 'Choose --json or --markdown, not both.'
        : undefined;
  if (problem) {
    process.stderr.write(`${problem}\n\n${HELP}`);
    return 2;
  }
  if (flags.includes('--help') || flags.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }
  if (flags.includes('--version') || flags.includes('-v')) {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  const root = resolve(paths[0] ?? '.');
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    process.stderr.write(`Not a folder: ${root}\n`);
    return 2;
  }
  const result = scan(root);
  if (json) {
    process.stdout.write(toJson(result, version) + '\n');
  } else if (markdown) {
    process.stdout.write(toMarkdown(result, version));
  } else {
    process.stdout.write(toText(result, version, process.stdout.isTTY === true && !process.env.NO_COLOR));
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
