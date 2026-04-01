export function calculateScore(timeRemaining: number, timeLimit: number): number {
  if (timeRemaining <= 0) return 0;
  return Math.round(1000 * (timeRemaining / timeLimit));
}
