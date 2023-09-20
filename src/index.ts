import {maxDropletStrategy2} from './ai';
import {WIDTH} from './bitboard';
import {SimpleGame} from './game';
import {SimplePuyoScreen} from './screen';

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

export function benchmark() {
  const screen = new SimplePuyoScreen();
  const game = new SimpleGame(
    screen,
    0,
    0,
    0,
    [0, 1, 2, 3],
    [0, 1, 2, 3, 0, 1]
  );
  const start = Date.now();
  const numMoves = 50;
  for (let i = 0; i < numMoves; ++i) {
    const strategy = maxDropletStrategy2(game);
    game.playAndTick(strategy.move);
    game.bag.push(
      game.colorSelection[
        Math.floor(Math.random() * game.colorSelection.length)
      ]
    );
    game.bag.push(
      game.colorSelection[
        Math.floor(Math.random() * game.colorSelection.length)
      ]
    );
    game.screen.log();
    console.log(strategy.score.toString());
  }
  const end = Date.now();
  console.log(`Playing ${numMoves} moves took ${end - start} ms`);
}
