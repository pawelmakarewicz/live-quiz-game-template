import type { Game, Question } from '../types.js';
import { generateRoomCode } from '../utils/codeGenerator.js';

class GameStore {
  private games: Map<string, Game> = new Map();
  private idCounter = 1;

  createGame(hostId: string, questions: Question[]): Game {
    const id = String(this.idCounter++);
    const code = generateRoomCode();
    const game: Game = {
      id,
      code,
      hostId,
      questions,
      players: [],
      currentQuestion: -1,
      status: 'waiting',
      playerAnswers: new Map(),
    };
    this.games.set(id, game);
    return game;
  }

  getGameByCode(code: string): Game | undefined {
    for (const [, game] of this.games) {
      if (game.code === code) return game;
    }
    return undefined;
  }

  getGameById(id: string): Game | undefined {
    return this.games.get(id);
  }

  getGameByPlayerId(playerId: string): Game | undefined {
    for (const [, game] of this.games) {
      if (game.players.some((p) => p.index === playerId)) return game;
      if (game.hostId === playerId) return game;
    }
    return undefined;
  }

  removePlayerFromGame(playerId: string): Game | undefined {
    for (const [, game] of this.games) {
      const idx = game.players.findIndex((p) => p.index === playerId);
      if (idx !== -1) {
        game.players.splice(idx, 1);
        return game;
      }
    }
    return undefined;
  }

  deleteGame(id: string): void {
    this.games.delete(id);
  }
}

export const gameStore = new GameStore();
