import type { NodeId } from '@teselia/protocol';
import { describe, expect, it } from 'vitest';

import { createGroup, invitationFor } from './group.ts';
import { appBaseUrl, invitationInAddress, invitationLink } from './join-link.ts';

const ISSUER = 'a1b2c3d4' as NodeId;

const invitation = invitationFor(createGroup('Grupo', null, 0), 'member', ISSUER);

describe('join links', () => {
  it('builds the link under the base path the app is served from', () => {
    expect(appBaseUrl('https://example.github.io', '/Teselia/')).toBe(
      'https://example.github.io/Teselia/',
    );
    const link = invitationLink('https://example.github.io', '/Teselia/', invitation);
    expect(link.ok && new URL(link.value).pathname).toBe('/Teselia/join');
  });

  it('reads the invitation of a join link the app was opened with', () => {
    const link = invitationLink('http://localhost:5173', '/', invitation);
    if (!link.ok) throw new Error('link not built');
    const url = new URL(link.value);
    expect(invitationInAddress(url.pathname, url.hash)).toEqual({ ok: true, value: invitation });
  });

  it('ignores addresses that are not join links', () => {
    expect(invitationInAddress('/', '#map=12/39.47/-0.37')).toBeNull();
    expect(invitationInAddress('/join', '')).toBeNull();
  });

  it('reports a damaged token instead of ignoring it', () => {
    expect(invitationInAddress('/join', '#AAAA')?.ok).toBe(false);
  });
});
