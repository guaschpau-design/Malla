// A Vite plugin that puts the app's Content-Security-Policy and referrer policy in the built
// index.html, so they hold wherever the app is served from, a static host included. Servers of
// Tesel send the same policy as a header, with frame-ancestors, which a meta tag cannot carry
// (deploy/common/headers.caddy); content-security-policy.test.ts keeps the two the same.
//
// Only the build gets it: the development server injects inline scripts of its own.
//
// The app connects to whichever servers its groups use and reads public map services, hence the
// open connect-src and img-src; MapLibre runs its workers from blobs and styles elements inline.

import type { Plugin } from 'vite';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: http: ws: data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const CHARSET = '<meta charset="UTF-8" />';

/** The policies go right after the charset, which must come first, and before any script. */
export function contentSecurityPolicy(): Plugin {
  const policies = [
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
    '<meta name="referrer" content="no-referrer" />',
  ];
  return {
    name: 'tesel-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      if (!html.includes(CHARSET)) throw new Error(`index.html has no ${CHARSET}`);
      return html.replace(CHARSET, [CHARSET, ...policies].join('\n    '));
    },
  };
}
