import type { WebSocket } from 'ws';
import type { AnswerData } from '../types.js';
import { userStore } from '../models/userStore.js';
import { gameStore } from '../models/gameStore.js';
import { sendToClient } from '../utils/broadcast.js';
import { clearQuestionTimer } from '../timer/questionTimer.js';
import { finishQuestion } from './gameHandler.js';

export function handleAnswer(ws: WebSocket, data: AnswerData): void {
  const user = userStore.getUserByWs(ws);
  if (!user) {
    sendToClient(ws, 'error', { message: 'Not authenticated' });
    return;
  }

  const { gameId, questionIndex, answerIndex } = data;
  const game = gameStore.getGameById(gameId);

  if (!game) {
    sendToClient(ws, 'error', { message: 'Game not found' });
    return;
  }

  if (game.status !== 'in_progress') {
    sendToClient(ws, 'error', { message: 'Game is not in progress' });
    return;
  }

  if (questionIndex !== game.currentQuestion) {
    sendToClient(ws, 'error', { message: 'Wrong question index' });
    return;
  }

  // Check if player already answered
  if (game.playerAnswers.has(user.index)) {
    sendToClient(ws, 'error', { message: 'Already answered' });
    return;
  }

  // Check if the user is actually a player in this game
  const player = game.players.find((p) => p.index === user.index);
  if (!player) {
    sendToClient(ws, 'error', { message: 'Not a player in this game' });
    return;
  }

  // Record answer
  game.playerAnswers.set(user.index, {
    answerIndex,
    timestamp: Date.now(),
  });
  player.hasAnswered = true;

  // Confirm answer
  sendToClient(ws, 'answer_accepted', { questionIndex });

  // Check if all players have answered → finish question early
  if (game.playerAnswers.size === game.players.length) {
    clearQuestionTimer(game);
    finishQuestion(game);
  }
}
