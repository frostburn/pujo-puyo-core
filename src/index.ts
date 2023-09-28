import {WIDTH} from './bitboard';

export * from './ai';
export * from './bitboard';
export * from './game';
export * from './jkiss';
export * from './screen';

const SMALL = 1;
const LARGE = 6;
const ROCK = 30;
const STAR = 180;
const MOON = 360;
const CROWN = 720;
const COMET = 1440;

export function garbageDisplay(amount: number): string[] {
  const result: string[] = [];
  while (amount >= COMET) {
    amount -= COMET;
    result.push('comet');
  }
  while (amount >= CROWN) {
    amount -= CROWN;
    result.push('crown');
  }
  while (amount >= MOON) {
    amount -= MOON;
    result.push('moon');
  }
  while (amount >= STAR) {
    amount -= STAR;
    result.push('star');
  }
  while (amount >= ROCK) {
    amount -= ROCK;
    result.push('rock');
  }
  while (amount >= LARGE) {
    amount -= LARGE;
    result.push('large');
  }
  while (amount >= SMALL) {
    amount -= SMALL;
    result.push('small');
  }
  return result;
}

export function combinedGarbageDisplay(
  pendingGarbage: number,
  lateGarbage: number
): string[] {
  const pending = garbageDisplay(pendingGarbage);
  const late = garbageDisplay(lateGarbage);
  const result = pending.concat(late);
  while (result.length > WIDTH && result.includes('small')) {
    result.splice(result.indexOf('small'), 1);
  }
  if (result.length <= WIDTH) {
    return result;
  }
  return garbageDisplay(pendingGarbage + lateGarbage).slice(0, WIDTH);
}
