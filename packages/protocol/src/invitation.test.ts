import { describe, expect, it } from 'vitest';

import { fromBase64url, toBase64url } from './base64url.ts';
import { encodeUtf8 } from './bytes.ts';
import {
  buildInvitationUrl,
  decodeInvitationToken,
  encodeInvitationToken,
  parseInvitationUrl,
  type Invitation,
} from './invitation.ts';
import { ALICE } from './test-helpers.ts';

const invitation: Invitation = {
  role: 'member',
  secret: Uint8Array.from({ length: 16 }, (_, i) => 255 - i),
  issuer: ALICE,
  groupName: 'Agrupación Voluntarios',
  server: 'https://teselia.example.eu',
};

describe('base64url', () => {
  it.each([
    ['', ''],
    ['f', 'Zg'],
    ['fo', 'Zm8'],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg'],
    ['fooba', 'Zm9vYmE'],
    ['foobar', 'Zm9vYmFy'],
  ])('encodes the RFC 4648 vector %j as %j', (plain, encoded) => {
    expect(toBase64url(encodeUtf8(plain))).toBe(encoded);
    expect(fromBase64url(encoded)).toEqual(encodeUtf8(plain));
  });

  it('uses the URL-safe alphabet', () => {
    expect(toBase64url(Uint8Array.of(0xfb, 0xff))).toBe('-_8');
  });

  it('rejects non-canonical and invalid input', () => {
    expect(fromBase64url('Zh')).toBeNull(); // leftover bits set
    expect(fromBase64url('Z')).toBeNull();
    expect(fromBase64url('Zm9v+')).toBeNull();
  });
});

describe('invitations', () => {
  it('round-trips through a token', () => {
    const token = encodeInvitationToken(invitation);
    expect(token.ok && decodeInvitationToken(token.value)).toEqual({ ok: true, value: invitation });
  });

  it('round-trips a group without a server', () => {
    const local = { ...invitation, role: 'coordinator', server: null } as const;
    const token = encodeInvitationToken(local);
    expect(token.ok && decodeInvitationToken(token.value)).toEqual({ ok: true, value: local });
  });

  it('puts the secret in the URL fragment, which browsers never send to servers', () => {
    const url = buildInvitationUrl('https://app.teselia.eu/', invitation);
    expect(url.ok).toBe(true);
    if (!url.ok) return;
    const parsed = new URL(url.value);
    expect(parsed.pathname).toBe('/join');
    expect(parsed.search).toBe('');
    expect(parseInvitationUrl(url.value)).toEqual({ ok: true, value: invitation });
  });

  it('builds the link under the base path of an app served from a sub-path', () => {
    const url = buildInvitationUrl('https://example.github.io/teselia/', invitation);
    expect(url.ok && new URL(url.value).pathname).toBe('/teselia/join');
    expect(url.ok && parseInvitationUrl(url.value)).toEqual({ ok: true, value: invitation });
  });

  it('refuses an app base URL that is not https or does not end in a slash', () => {
    expect(buildInvitationUrl('http://app.teselia.eu/', invitation).ok).toBe(false);
    expect(buildInvitationUrl('https://example.github.io/teselia', invitation).ok).toBe(false);
  });

  it('refuses a server that is not https', () => {
    expect(encodeInvitationToken({ ...invitation, server: 'http://insecure.example' }).ok).toBe(
      false,
    );
  });

  it('refuses an empty group name', () => {
    expect(encodeInvitationToken({ ...invitation, groupName: '' }).ok).toBe(false);
  });

  it('rejects links that are not invitations', () => {
    expect(parseInvitationUrl('https://app.teselia.eu/').ok).toBe(false);
    expect(parseInvitationUrl('not a url').ok).toBe(false);
    expect(decodeInvitationToken('AAAA').ok).toBe(false);
  });
});
