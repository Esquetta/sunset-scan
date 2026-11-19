#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { toJson, toText } from './report.js';
import { scan } from './scan.js';

const HELP = `Usage: sunset-scan [path] [--json]

Lists what breaks in a JavaScript/TypeScript project when Lemon Squeezy
shuts down, with the closest Stripe equivalent for each finding.
Read-only: nothing in the scanned folder is changed and no network calls are made.

  path        Folder to scan (default: current folder)
  --json      Print the report as JSON
  --version   Print the version
  --help      Print this help
`;

function main(argv: string[]): number {
  const version = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string })
    .version;
  const flags = argv.filter((a) => a.startsWith('-'));
  const paths = argv.filter((a) => !a.startsWith('-'));
  const unknown = flags.find((f) => !['--json', '--help', '-h', '--version', '-v'].includes(f));
  if (unknown || paths.length > 1) {
    process.stderr.write(`${unknown ? `Unknown option: ${unknown}` : 'Pass one folder at most.'}\n\n${HELP}`);
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
  if (flags.includes('--json')) {
    process.stdout.write(toJson(result, version) + '\n');
  } else {
    process.stdout.write(toText(result, version, process.stdout.isTTY === true && !process.env.NO_COLOR));
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
