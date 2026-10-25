import { toBase64url, type Invitation, type NodeId } from '@malla/protocol';
import { describe, expect, it } from 'vitest';

import {
  applyInvitation,
  canInvite,
  createGroup,
  invitationFor,
  normalizeGroupName,
} from './group.ts';

const ISSUER = 'a1b2c3d4' as NodeId;

const fixedRandom = (length: number) => new Uint8Array(length).fill(7);
const NOW = 1_761_350_400_000;

describe('groups', () => {
  it('makes the creator of a group its coordinator', () => {
    const group = createGroup('Protección Civil', NOW, fixedRandom);
    expect(group.role).toBe('coordinator');
    expect(group.invitedBy).toBeNull();
    expect(canInvite(group)).toBe(true);
  });

  it('identifies a group by an ID derived from its secret, never the secret itself', () => {
    const group = createGroup('A', NOW, fixedRandom);
    expect(createGroup('B', NOW, fixedRandom).id).toBe(group.id);
    expect(group.id).not.toBe(toBase64url(group.secret));
  });

  it('joins a new group with the role the invitation grants', () => {
    const invitation = invitationFor(createGroup('A', NOW, fixedRandom), 'member', ISSUER);
    const { group, outcome } = applyInvitation(undefined, invitation, NOW);
    expect(outcome).toBe('joined');
    expect(group.role).toBe('member');
    expect(group.invitedBy).toBe(ISSUER);
    expect(canInvite(group)).toBe(false);
  });

  it('promotes a member who receives a coordinator invitation', () => {
    const coordinatorGroup = createGroup('A', NOW, fixedRandom);
    const asMember = applyInvitation(
      undefined,
      invitationFor(coordinatorGroup, 'member', ISSUER),
      NOW,
    ).group;
    const again = applyInvitation(
      asMember,
      invitationFor(coordinatorGroup, 'coordinator', ISSUER),
      NOW + 1,
    );
    expect(again.outcome).toBe('promoted');
    expect(again.group.role).toBe('coordinator');
    expect(again.group.joinedAt).toBe(NOW);
  });

  it('never demotes a coordinator who opens a member invitation', () => {
    const group = createGroup('A', NOW, fixedRandom);
    const result = applyInvitation(group, invitationFor(group, 'member', ISSUER), NOW);
    expect(result.outcome).toBe('already-member');
    expect(result.group.role).toBe('coordinator');
  });

  it('learns a server from an invitation but does not replace a known one', () => {
    const group = createGroup('A', NOW, fixedRandom);
    const withServer: Invitation = {
      ...invitationFor(group, 'member', ISSUER),
      server: 'https://one.example',
    };
    const learned = applyInvitation(group, withServer, NOW).group;
    expect(learned.server).toBe('https://one.example');
    const other = { ...withServer, server: 'https://two.example' };
    expect(applyInvitation(learned, other, NOW).group.server).toBe('https://one.example');
  });

  it('accepts group names of 1 to 32 bytes after trimming', () => {
    expect(normalizeGroupName('  Rescate  ')).toBe('Rescate');
    expect(normalizeGroupName('   ')).toBeNull();
    expect(normalizeGroupName('ñ'.repeat(16))).toBe('ñ'.repeat(16));
    expect(normalizeGroupName('ñ'.repeat(17))).toBeNull();
  });
});
