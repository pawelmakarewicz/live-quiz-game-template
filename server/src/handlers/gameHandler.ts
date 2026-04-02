import type { WebSocket } from 'ws';
import type {
  CreateGameData,
  JoinGameData,
  StartGameData,
  Game,
  Question,
} from '../types.js';
import { userStore } from '../models/userStore.js';
import { gameStore } from '../models/gameStore.js';
import { sendToClient, broadcastToGame } from '../utils/broadcast.js';
import { calculateScore } from '../utils/scoring.js';
import {
  startQuestionTimer,
  clearQuestionTimer,
} from '../timer/questionTimer.js';

const OPTIONS_COUNT = 4;
const MIN_TIME_LIMIT_SEC = 1;

function isValidQuestion(q: Question): boolean {
  return (
    typeof q.text === 'string' &&
    q.text.trim().length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === OPTIONS_COUNT &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < OPTIONS_COUNT &&
    Number.isInteger(q.timeLimitSec) &&
    q.timeLimitSec >= MIN_TIME_LIMIT_SEC
  );
}

// ── Create Game ──────────────────────────────────────────────

export function handleCreateGame(ws: WebSocket, data: CreateGameData): void {
  const user = userStore.getUserByWs(ws);
  if (!user) {
    sendToClient(ws, 'error', { message: 'Not authenticated' });
    return;
  }

  const { questions } = data;

  // Validate questions
  if (!Array.isArray(questions) || questions.length === 0) {
    sendToClient(ws, 'error', { message: 'Questions array is required and must not be empty' });
    return;
  }

  for (const q of questions) {
    if (!isValidQuestion(q)) {
      sendToClient(ws, 'error', { message: 'Invalid question format' });
      return;
    }
  }

  const game = gameStore.createGame(user.index, questions);

  sendToClient(ws, 'game_created', {
    gameId: game.id,
    code: game.code,
  });
}

// ── Join Game ────────────────────────────────────────────────

export function handleJoinGame(ws: WebSocket, data: JoinGameData): void {
  const user = userStore.getUserByWs(ws);
  if (!user) {
    sendToClient(ws, 'error', { message: 'Not authenticated' });
    return;
  }

  const { code } = data;
  const game = gameStore.getGameByCode(code);

  if (!game) {
    sendToClient(ws, 'error', { message: 'Game not found' });
    return;
  }

  if (game.status !== 'waiting') {
    sendToClient(ws, 'error', { message: 'Game already started' });
    return;
  }

  // Check if player is already in the game
  if (game.players.some((p) => p.index === user.index)) {
    sendToClient(ws, 'error', { message: 'Already in this game' });
    return;
  }

  // Add player to game
  game.players.push({
    name: user.name,
    index: user.index,
    score: 0,
    ws,
    hasAnswered: false,
  });

  // Notify the player who just joined
  sendToClient(ws, 'game_joined', { gameId: game.id });

  // Broadcast player_joined to everyone in the game (players + host)
  broadcastToGame(game, 'player_joined', {
    playerName: user.name,
    playerCount: game.players.length,
  });

  // Broadcast update_players to everyone in the game
  broadcastToGame(game, 'update_players', 
    game.players.map((p) => ({
      name: p.name,
      index: p.index,
      score: p.score,
    }))
  );
}

// ── Start Game ───────────────────────────────────────────────

export function handleStartGame(ws: WebSocket, data: StartGameData): void {
  const user = userStore.getUserByWs(ws);
  if (!user) {
    sendToClient(ws, 'error', { message: 'Not authenticated' });
    return;
  }

  const { gameId } = data;
  const game = gameStore.getGameById(gameId);

  if (!game) {
    sendToClient(ws, 'error', { message: 'Game not found' });
    return;
  }

  if (game.hostId !== user.index) {
    sendToClient(ws, 'error', { message: 'Only the host can start the game' });
    return;
  }

  if (game.status !== 'waiting') {
    sendToClient(ws, 'error', { message: 'Game already started' });
    return;
  }

  game.status = 'in_progress';
  game.currentQuestion = 0;

  sendQuestion(game);
}

// ── Send Question ────────────────────────────────────────────

export function sendQuestion(game: Game): void {
  const question = game.questions[game.currentQuestion];
  if (!question) return;

  // Reset state for new question
  game.playerAnswers = new Map();
  for (const player of game.players) {
    player.hasAnswered = false;
  }
  game.questionStartTime = Date.now();

  // Broadcast question to all (players + host) — WITHOUT correctIndex!
  broadcastToGame(game, 'question', {
    questionNumber: game.currentQuestion + 1,
    totalQuestions: game.questions.length,
    text: question.text,
    options: question.options,
    timeLimitSec: question.timeLimitSec,
  });

  // Start server-side timer
  startQuestionTimer(game, finishQuestion);
}

// ── Finish Question ──────────────────────────────────────────

export function finishQuestion(game: Game): void {
  clearQuestionTimer(game);

  const question = game.questions[game.currentQuestion];
  if (!question) return;

  const playerResults: Array<{
    name: string;
    answered: boolean;
    correct: boolean;
    pointsEarned: number;
    totalScore: number;
  }> = [];

  for (const player of game.players) {
    const answer = game.playerAnswers.get(player.index);
    const answered = answer !== undefined;
    const correct = answered && answer.answerIndex === question.correctIndex;

    let pointsEarned = 0;
    if (correct) {
      const timeElapsed =
        (answer!.timestamp - (game.questionStartTime || 0)) / 1000;
      const timeRemaining = Math.max(
        0,
        question.timeLimitSec - timeElapsed
      );
      pointsEarned = calculateScore(timeRemaining, question.timeLimitSec);
    }

    player.score += pointsEarned;

    playerResults.push({
      name: player.name,
      answered,
      correct,
      pointsEarned,
      totalScore: player.score,
    });
  }

  // Broadcast question_result
  broadcastToGame(game, 'question_result', {
    questionIndex: game.currentQuestion,
    correctIndex: question.correctIndex,
    playerResults,
  });

  // After a pause, either send next question or finish game
  const isLastQuestion =
    game.currentQuestion >= game.questions.length - 1;

  setTimeout(() => {
    if (isLastQuestion) {
      finishGame(game);
    } else {
      game.currentQuestion++;
      sendQuestion(game);
    }
  }, 5000); // 5 second pause between questions
}

// ── Finish Game ──────────────────────────────────────────────

export function finishGame(game: Game): void {
  game.status = 'finished';

  // Sort players by score descending
  const sorted = [...game.players].sort((a, b) => b.score - a.score);

  // Assign ranks (same score = same rank)
  const scoreboard: Array<{ name: string; score: number; rank: number }> = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      currentRank = i + 1;
    }
    scoreboard.push({
      name: sorted[i].name,
      score: sorted[i].score,
      rank: currentRank,
    });
  }

  broadcastToGame(game, 'game_finished', { scoreboard });
}
