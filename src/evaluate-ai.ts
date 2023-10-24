import {flexDropletStrategy3, flexDropletStrategy2} from '.';
import {MOVES, MultiplayerGame, PASS} from './game';

const MAX_CONSECUTIVE_REROLLS = 20;

function duel(
  strategyA: typeof flexDropletStrategy2,
  strategyB: typeof flexDropletStrategy2
) {
  const strategies = [strategyA, strategyB];
  const passing = [false, false];
  const game = new MultiplayerGame();
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
          game.play(i, x1, y1, orientation, true);
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
      } else if (game.consecutiveRerolls >= MAX_CONSECUTIVE_REROLLS) {
        return 0.5;
      }
    }
  }
}

const eloRandom = 1000;
const scoreFlex1 = 100037;
const gamesFlex1 = 100176;
const eloFlex1 =
  eloRandom + Math.log10(scoreFlex1 / (gamesFlex1 - scoreFlex1)) * 400;

const scoreFlex2 = 10027;
const gamesFlex2 = 10690;
const eloFlex2 =
  eloFlex1 + Math.log10(scoreFlex2 / (gamesFlex2 - scoreFlex2)) * 400;

let scoreFlex3 = 619.5;
let gamesFlex3 = 791;

function collect(result: number) {
  scoreFlex3 += result;
  gamesFlex3++;
  const eloFlex3 =
    eloFlex2 + Math.log10(scoreFlex3 / (gamesFlex3 - scoreFlex3)) * 400;
  console.log(scoreFlex3, '/', gamesFlex3, '->', eloFlex3);
}

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
    const result = duel(flexDropletStrategy3, flexDropletStrategy2);
    if ((process as any).send !== undefined) {
      (process as any).send(result.toString());
    } else {
      collect(result);
    }
  }
}
