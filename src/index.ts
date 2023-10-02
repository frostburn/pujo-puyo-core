import {WIDTH} from './bitboard';

export * from './ai';
export * from './bitboard';
export * from './game';
export * from './jkiss';
export * from './screen';

type GarbageSymbols = {
  pending: string[];
  late: string[];
};

const SMALL = 1;
const LARGE = 6;
const ROCK = 30;
const STAR = 180;
const MOON = 360;
const CROWN = 720;
const COMET = 1440;

export function garbageDisplay(amount: number): number[] {
  const result: number[] = [];
  while (amount >= COMET) {
    amount -= COMET;
    result.push(COMET);
  }
  while (amount >= CROWN) {
    amount -= CROWN;
    result.push(CROWN);
  }
  while (amount >= MOON) {
    amount -= MOON;
    result.push(MOON);
  }
  while (amount >= STAR) {
    amount -= STAR;
    result.push(STAR);
  }
  while (amount >= ROCK) {
    amount -= ROCK;
    result.push(ROCK);
  }
  while (amount >= LARGE) {
    amount -= LARGE;
    result.push(LARGE);
  }
  while (amount >= SMALL) {
    amount -= SMALL;
    result.push(SMALL);
  }
  return result;
}

export function garbageSymbol(amount: number): string {
  if (amount === COMET) {
    return 'comet';
  } else if (amount === CROWN) {
    return 'crown';
  } else if (amount === MOON) {
    return 'moon';
  } else if (amount === STAR) {
    return 'star';
  } else if (amount === ROCK) {
    return 'rock';
  } else if (amount === LARGE) {
    return 'large';
  } else if (amount === SMALL) {
    return 'small';
  }
  throw new Error(`Unrecognized garbage amount (${amount})`);
}

export function combinedGarbageDisplay(
  pendingGarbage: number,
  lateGarbage: number
): GarbageSymbols {
  const pending = garbageDisplay(pendingGarbage);
  const late = garbageDisplay(lateGarbage);

  while (pending.length + late.length > WIDTH) {
    if (!pending.length) {
      late.pop();
    } else if (!late.length) {
      pending.pop();
    } else if (late[late.length - 1] <= pending[pending.length - 1]) {
      late.pop();
    } else {
      pending.pop();
    }
  }

  return {
    pending: pending.map(garbageSymbol),
    late: late.map(garbageSymbol),
  };
}
