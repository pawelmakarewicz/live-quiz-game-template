import type { Game } from '../types.js';

export function startQuestionTimer(
  game: Game,
  onTimeUp: (game: Game) => void
): void {
  const question = game.questions[game.currentQuestion];
  if (!question) return;

  game.questionTimer = setTimeout(() => {
    onTimeUp(game);
  }, question.timeLimitSec * 1000);
}

export function clearQuestionTimer(game: Game): void {
  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = undefined;
  }
}
