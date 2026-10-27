// A Vite plugin that writes third-party-notices.txt into the build: the name, version, licence and
// licence text of every package whose code the app ships. MIT, BSD and the like ask that their
// notice travel with every copy of the code, and bundling strips it from the code.
//
// The packages are read from the modules the build bundled, so the list holds what ships and
// nothing else; the workspace's own packages are not in node_modules and are left out. A package
// that ships no licence file has its text kept by hand in scripts/notices/, named after it, and
// the build fails while one is missing. Code the build ships without bundling it, such as the
// service worker's runtime, is declared by the caller, its text kept there too.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const FILE_NAME = 'third-party-notices.txt';
const NODE_MODULES = '/node_modules/';
const LICENCE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;
const KEPT_BY_HAND = fileURLToPath(new URL('notices/', import.meta.url));

/** Code the build ships but does not bundle, with its text in scripts/notices/<notice>.txt. */
export interface UnbundledCode {
  readonly name: string;
  readonly license: string;
  readonly notice: string;
}

interface Notice {
  /** The package's name and version, or what the code is. */
  readonly title: string;
  readonly license: string;
  readonly text: string;
}

export function thirdPartyNotices(unbundled: readonly UnbundledCode[]): Plugin {
  return {
    name: 'tesel-third-party-notices',
    apply: 'build',
    generateBundle() {
      const notices = new Map<string, Notice>();
      for (const id of this.getModuleIds()) {
        const root = packageRoot(id);
        if (root === null) continue;
        const notice = packageNotice(root);
        notices.set(notice.title, notice);
      }
      const sorted = [...notices.values()].sort((a, b) => a.title.localeCompare(b.title));
      const others = unbundled.map(({ name, license, notice }) => ({
        title: name,
        license,
        text: keptByHand(notice),
      }));
      this.emitFile({ type: 'asset', fileName: FILE_NAME, source: format([...sorted, ...others]) });
    },
  };
}

/** The folder of the package a bundled module belongs to, or null if it is not a dependency. */
function packageRoot(moduleId: string): string | null {
  // Rollup marks virtual modules with a leading NUL, and a query may follow the path.
  const path = moduleId.replace(/^\0/, '').split('?')[0] ?? '';
  const start = path.lastIndexOf(NODE_MODULES);
  if (start === -1) return null;
  const [first, second] = path.slice(start + NODE_MODULES.length).split('/');
  if (first === undefined || second === undefined) return null;
  const folder = first.startsWith('@') ? `${first}/${second}` : first;
  return path.slice(0, start + NODE_MODULES.length) + folder;
}

function packageNotice(root: string): Notice {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    readonly name: string;
    readonly version: string;
    readonly license?: string;
  };
  const licenceFile = readdirSync(root).find((file) => LICENCE_FILE.test(file));
  return {
    title: `${manifest.name} ${manifest.version}`,
    license: manifest.license ?? 'not stated',
    text:
      licenceFile === undefined
        ? keptByHand(manifest.name)
        : readFileSync(join(root, licenceFile), 'utf8'),
  };
}

/** A licence text kept in scripts/notices/; the build fails without it. */
function keptByHand(name: string): string {
  const path = join(KEPT_BY_HAND, `${name}.txt`);
  if (!existsSync(path)) {
    throw new Error(`${name} ships no licence text: add it as ${path}`);
  }
  return readFileSync(path, 'utf8');
}

function format(notices: readonly Notice[]): string {
  const header =
    'Tesel is free software under the EUPL-1.2. Its web app includes the following ' +
    'third-party code, under its own licences.';
  const sections = notices.map(
    ({ title, license, text }) => `${title}\nLicence: ${license}\n\n${text.trim()}`,
  );
  return `${[header, ...sections].join(`\n\n${'-'.repeat(80)}\n\n`)}\n`;
}
