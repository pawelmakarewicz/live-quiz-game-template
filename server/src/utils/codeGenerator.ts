import { gameStore } from '../models/gameStore.js';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }
  } while (gameStore.getGameByCode(code) !== undefined);

  return code;
}
