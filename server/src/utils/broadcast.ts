import type { WebSocket } from 'ws';
import type { Game } from '../types.js';
import { userStore } from '../models/userStore.js';

export function sendToClient(ws: WebSocket, type: string, data: any): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data, id: 0 }));
  }
}

export function broadcastToGame(game: Game, type: string, data: any): void {
  // Send to all players
  for (const player of game.players) {
    if (player.ws && player.ws.readyState === player.ws.OPEN) {
      sendToClient(player.ws, type, data);
    }
  }
  // Send to host
  const host = userStore.getUserByIndex(game.hostId);
  if (host?.ws && host.ws.readyState === host.ws.OPEN) {
    sendToClient(host.ws, type, data);
  }
}

export function broadcastToPlayers(game: Game, type: string, data: any): void {
  for (const player of game.players) {
    if (player.ws && player.ws.readyState === player.ws.OPEN) {
      sendToClient(player.ws, type, data);
    }
  }
}
