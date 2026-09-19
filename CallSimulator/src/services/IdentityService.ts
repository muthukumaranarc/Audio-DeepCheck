import { UserProfile } from '../types';

export const PRESET_USERS: Record<'A' | 'B', UserProfile> = {
  A: {
    userId: 'USER-A',
    phoneNumber: '+91 90000 00001',
    displayName: 'Muthu',
  },
  B: {
    userId: 'USER-B',
    phoneNumber: '+91 90000 00002',
    displayName: 'Friend',
  },
};

const STORAGE_KEY = 'audio_deepcheck_sim_user';

export class IdentityService {
  private static currentUser: UserProfile = IdentityService.detectInitialUser();

  public static detectInitialUser(): UserProfile {
    if (typeof window !== 'undefined' && window.location) {
      // 1. Check URL query params: ?user=A or ?user=B
      const params = new URLSearchParams(window.location.search);
      const userParam = params.get('user')?.toUpperCase();
      if (userParam === 'B') {
        return PRESET_USERS.B;
      }
      if (userParam === 'A') {
        return PRESET_USERS.A;
      }

      // 2. Check URL path routing: /b, /user-b, /user/b vs /a, /user-a, /user/a
      const path = (window.location.pathname || '').toLowerCase();
      if (path.endsWith('/b') || path.includes('/user-b') || path.includes('/user/b')) {
        return PRESET_USERS.B;
      }
      if (path.endsWith('/a') || path.includes('/user-a') || path.includes('/user/a')) {
        return PRESET_USERS.A;
      }

      // 3. Check sessionStorage (isolated per tab)
      try {
        const sessionUser = sessionStorage.getItem(STORAGE_KEY);
        if (sessionUser === 'USER-B') return PRESET_USERS.B;
        if (sessionUser === 'USER-A') return PRESET_USERS.A;
      } catch {}

      // 4. Check localStorage fallback
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'USER-B') {
          return PRESET_USERS.B;
        }
      } catch {}
    }
    return PRESET_USERS.A;
  }

  public static getActiveUser(): UserProfile {
    return this.currentUser;
  }

  public static setActiveUser(user: UserProfile): void {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY, user.userId);
        localStorage.setItem(STORAGE_KEY, user.userId);
      } catch {}

      // Keep browser URL synchronized with identity so tabs remain isolated
      try {
        const url = new URL(window.location.href);
        const code = user.userId === PRESET_USERS.B.userId ? 'B' : 'A';
        url.searchParams.set('user', code);
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
  }

  public static getPeerUser(): UserProfile {
    return this.currentUser.userId === PRESET_USERS.A.userId
      ? PRESET_USERS.B
      : PRESET_USERS.A;
  }

  public static switchUser(): UserProfile {
    const next = this.getPeerUser();
    this.setActiveUser(next);
    return next;
  }
}
