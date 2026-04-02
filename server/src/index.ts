import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { WSMessage } from './types.js';
import { handleReg } from './handlers/authHandler.js';
import {
  handleCreateGame,
  handleJoinGame,
  handleStartGame,
} from './handlers/gameHandler.js';
import { handleAnswer } from './handlers/answerHandler.js';
import { userStore } from './models/userStore.js';
import { gameStore } from './models/gameStore.js';
import { broadcastToGame } from './utils/broadcast.js';
import { finishQuestion } from './handlers/gameHandler.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

interface HeartbeatWebSocket extends WebSocket {
  isAlive: boolean;
}

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server started on ws://localhost:${PORT}`);

// Heartbeat: terminate connections that stopped responding
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const ws = client as HeartbeatWebSocket;

    if (!ws.isAlive) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

wss.on('close', () => clearInterval(heartbeatInterval));

wss.on('connection', (client) => {
  const ws = client as HeartbeatWebSocket;

  console.log('Client connected');

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const message: WSMessage = JSON.parse(raw.toString());
      console.log('Received:', message.type);

      switch (message.type) {
        case 'reg':
          handleReg(ws, message.data);
          break;
        case 'create_game':
          handleCreateGame(ws, message.data);
          break;
        case 'join_game':
          handleJoinGame(ws, message.data);
          break;
        case 'start_game':
          handleStartGame(ws, message.data);
          break;
        case 'answer':
          handleAnswer(ws, message.data);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');

    const user = userStore.getUserByWs(ws);
    if (!user) {
      return;
    }

    // Clear ws reference
    userStore.removeWs(ws);

    // Find game the player was in
    const game = gameStore.getGameByPlayerId(user.index);
    if (!game) return;

    // Check if this was a player (not the host)
    const playerIdx = game.players.findIndex((p) => p.index === user.index);
    if (playerIdx !== -1) {
      // Remove player from game
      game.players.splice(playerIdx, 1);

      // Broadcast updated player list
      broadcastToGame(game, 'update_players',
        game.players.map((p) => ({
          name: p.name,
          index: p.index,
          score: p.score,
        }))
      );

      // If game is in progress and all remaining players answered, finish question
      if (
        game.status === 'in_progress' &&
        game.players.length > 0 &&
        game.playerAnswers.size >= game.players.length
      ) {
        finishQuestion(game);
      }

      // If no players left and game is in progress, finish the game
      if (game.players.length === 0 && game.status === 'in_progress') {
        game.status = 'finished';
      }
    }
  });
});