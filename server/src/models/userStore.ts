import type { WebSocket } from 'ws';
import type { User } from '../types.js';

class UserStore {
  private users: Map<string, User> = new Map();
  private nextIndex = 1;

  register(
    name: string,
    password: string,
    ws: WebSocket
  ): { user: User; error: boolean; errorText: string } {
    // Check if user with this name already exists
    for (const [, user] of this.users) {
      if (user.name === name) {
        if (user.password === password) {
          // Login — update ws reference
          user.ws = ws;
          return { user, error: false, errorText: '' };
        } else {
          return {
            user: { name, password: '', index: '' } as User,
            error: true,
            errorText: 'Wrong password',
          };
        }
      }
    }

    // New user
    const index = String(this.nextIndex++);
    const newUser: User = { name, password, index, ws };
    this.users.set(index, newUser);
    return { user: newUser, error: false, errorText: '' };
  }

  getUserByWs(ws: WebSocket): User | undefined {
    for (const [, user] of this.users) {
      if (user.ws === ws) return user;
    }
    return undefined;
  }

  getUserByIndex(index: string): User | undefined {
    return this.users.get(index);
  }

  removeWs(ws: WebSocket): void {
    for (const [, user] of this.users) {
      if (user.ws === ws) {
        user.ws = undefined;
        return;
      }
    }
  }
}

export const userStore = new UserStore();
