import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityService, PRESET_USERS } from '../services/IdentityService';

describe('IdentityService', () => {
  beforeEach(() => {
    localStorage.clear();
    IdentityService.setActiveUser(PRESET_USERS.A);
  });

  it('should default to User A (Muthu)', () => {
    const user = IdentityService.getActiveUser();
    expect(user.userId).toBe('USER-A');
    expect(user.displayName).toBe('Muthu');
    expect(user.phoneNumber).toBe('+91 90000 00001');
  });

  it('should identify peer as User B when active is User A', () => {
    IdentityService.setActiveUser(PRESET_USERS.A);
    const peer = IdentityService.getPeerUser();
    expect(peer.userId).toBe('USER-B');
    expect(peer.displayName).toBe('Friend');
  });

  it('should switch user identity back and forth', () => {
    IdentityService.setActiveUser(PRESET_USERS.A);

    const switched = IdentityService.switchUser();
    expect(switched.userId).toBe('USER-B');
    expect(IdentityService.getActiveUser().userId).toBe('USER-B');

    const switchedBack = IdentityService.switchUser();
    expect(switchedBack.userId).toBe('USER-A');
    expect(IdentityService.getActiveUser().userId).toBe('USER-A');
  });
});
