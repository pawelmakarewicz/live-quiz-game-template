import type { WebSocket } from 'ws';
import type { RegData } from '../types.js';
import { userStore } from '../models/userStore.js';
import { sendToClient } from '../utils/broadcast.js';

export function handleReg(ws: WebSocket, data: RegData): void {
  const { name, password } = data;

  if (!name || !password) {
    sendToClient(ws, 'reg', {
      name: name || '',
      index: '',
      error: true,
      errorText: 'Name and password are required',
    });
    return;
  }

  const result = userStore.register(name, password, ws);

  if (result.error) {
    sendToClient(ws, 'reg', {
      name,
      index: '',
      error: true,
      errorText: result.errorText,
    });
  } else {
    sendToClient(ws, 'reg', {
      name: result.user.name,
      index: result.user.index,
      error: false,
      errorText: '',
    });
  }
}
