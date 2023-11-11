/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  randomStrategy,
  flexDropletStrategy1,
  flexDropletStrategy3,
  flexDropletStrategy2,
} from '.';
import {MOVES, MultiplayerGame, PASS, randomMultiplayer} from './game';

const MAX_CONSECUTIVE_REROLLS = 10;

function duel(
  strategyA: typeof flexDropletStrategy2,
  strategyB: typeof flexDropletStrategy2,
  hardDropA = true,
  hardDropB = true
) {
  const strategies = [strategyA, strategyB];
  const hardDrops = [hardDropA, hardDropB];
  const passing = [false, false];
  const game = new MultiplayerGame(randomMultiplayer());
  while (true) {
    for (let i = 0; i < 2; ++i) {
      if (passing[i]) {
        if (game.games.some(g => g.busy)) {
          continue;
        } else {
          passing[i] = false;
        }
      }
      if (!game.games[i].busy) {
        const strategy = strategies[i](game.toSimpleGame(i));
        if (strategy.move === PASS) {
          passing[i] = true;
        } else {
          const {x1, y1, orientation} = MOVES[strategy.move];
          game.play(i, x1, y1, orientation, hardDrops[i]);
        }
      }
      const tickResults = game.tick();
      if (tickResults[0].lockedOut) {
        if (tickResults[1].lockedOut) {
          return 0.5;
        }
        return 0;
      } else if (tickResults[1].lockedOut) {
        return 1;
      } else if (
        game.games[0].consecutiveRerolls >= MAX_CONSECUTIVE_REROLLS &&
        game.games[1].consecutiveRerolls >= MAX_CONSECUTIVE_REROLLS
      ) {
        return 0.5;
      }
    }
  }
}

function elo(baseLine: number, score: number, numGames: number) {
  return baseLine + Math.log10(score / (numGames - score)) * 400;
}

const eloRandom = 1000;

/*
let scoreSoftFlex1 = 99075;
let gamesSoftFlex1 = 100026;
const eloSoftFlex1 = elo(eloRandom, scoreSoftFlex1, gamesSoftFlex1); // 1807.1134256275252
*/

const scoreFlex1 = 104194;
const gamesFlex1 = 104330;
const eloFlex1 = elo(eloRandom, scoreFlex1, gamesFlex1); // 2153.721521005391

/*
// Some discrepancy here, but that's to be expected from a simple model like Elo.
let scoreSoftVsHard1 = 1465.5;
let gamesSoftVsHard1 = 10006;
const eloSoftVsHard1 = elo(eloFlex1, scoreSoftVsHard1, gamesSoftVsHard1); // 1847.522531306342
*/

/*
let scoreFlex2 = 9933.5;
let gamesFlex2 = 10606;
// const eloFlex2 = elo(eloFlex1, scoreFlex2, gamesFlex2); // 2621.4855239818644
*/

let scoreSoftRandom = 100569.5;
let gamesSoftRandom = 194877;

function collect(result: number) {
  scoreSoftRandom += result;
  gamesSoftRandom++;
  const eloSoftRandom = elo(eloRandom, scoreSoftRandom, gamesSoftRandom);
  console.log(scoreSoftRandom, '/', gamesSoftRandom, '->', eloSoftRandom);
}

const strategyA = randomStrategy;
const hardDropA = false;
const strategyB = randomStrategy;
const hardDropB = true;

if (process.argv.length === 3) {
  const numChildren = parseInt(process.argv[2], 10);
  console.log('Spawning', numChildren, 'child processes...');
  for (let i = 0; i < numChildren; ++i) {
    Bun.spawn([process.argv[0], process.argv[1]], {
      ipc(message) {
        collect(parseFloat(message));
      },
    });
  }
} else {
  while (true) {
    const result = duel(strategyA, strategyB, hardDropA, hardDropB);
    if ((process as any).send !== undefined) {
      (process as any).send(result.toString());
    } else {
      collect(result);
    }
  }
}
