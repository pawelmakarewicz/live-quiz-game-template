import type { WebSocket } from 'ws';

export interface Player {
  name: string;
  index: string;
  score: number;
  ws?: WebSocket;
  hasAnswered?: boolean;
  answerTime?: number;
  answeredCorrectly?: boolean;
}

export interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
}

export interface Game {
  id: string;
  code: string;
  hostId: string;
  questions: Question[];
  players: Player[];
  currentQuestion: number;
  status: 'waiting' | 'in_progress' | 'finished';
  questionStartTime?: number;
  questionTimer?: NodeJS.Timeout;
  playerAnswers: Map<string, { answerIndex: number; timestamp: number }>;
}

export interface User {
  name: string;
  password: string;
  index: string;
  ws?: WebSocket;
}

export interface WSMessage {
  type: string;
  data: any;
  id: number;
}

export interface RegData {
  name: string;
  password: string;
}

export interface CreateGameData {
  questions: Question[];
}

export interface JoinGameData {
  code: string;
}

export interface StartGameData {
  gameId: string;
}

export interface AnswerData {
  gameId: string;
  questionIndex: number;
  answerIndex: number;
}

// ── Server → Client message map ─────────────────────────────

export interface ServerMessageMap {
  reg: {
    name: string;
    index: string;
    error: boolean;
    errorText: string;
  };
  error: {
    message: string;
  };
  game_created: {
    gameId: string;
    code: string;
  };
  game_joined: {
    gameId: string;
  };
  player_joined: {
    playerName: string;
    playerCount: number;
  };
  update_players: Array<{
    name: string;
    index: string;
    score: number;
  }>;
  question: {
    questionNumber: number;
    totalQuestions: number;
    text: string;
    options: string[];
    timeLimitSec: number;
  };
  answer_accepted: {
    questionIndex: number;
  };
  question_result: {
    questionIndex: number;
    correctIndex: number;
    playerResults: Array<{
      name: string;
      answered: boolean;
      correct: boolean;
      pointsEarned: number;
      totalScore: number;
    }>;
  };
  game_finished: {
    scoreboard: Array<{
      name: string;
      score: number;
      rank: number;
    }>;
  };
}
