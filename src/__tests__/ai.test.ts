import {expect, test} from 'bun:test';
import {RED, SimplePuyoScreen} from '../screen';
import {
  DEFAULT_TARGET_POINTS,
  MOVES,
  MultiplayerGame,
  PASS,
  SimpleGame,
  randomColorSelection,
} from '../game';
import {effectiveLockout, flexDropletStrategy1} from '../ai';
import {randomSeed} from '../jkiss';
import {puyosEqual} from '../bitboard';

test('Effective lockout', () => {
  const screen = SimplePuyoScreen.fromLines([
    '',
    '',
    '',
    '',
    ' RGGR ',
    'RBBPPR',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
  ]);
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    0,
    0,
    [0, 1, 2, 3],
    [RED, RED]
  );
  const heuristic = effectiveLockout(game);
  expect(heuristic).toBeLessThan(0);
});

test('Ineffective lockout', () => {
  const screen = SimplePuyoScreen.fromLines([
    '',
    '',
    '',
    '',
    '  RGGR',
    'RBPPPR',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
  ]);
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    0,
    0,
    [0, 1, 2, 3],
    [RED, RED]
  );
  const heuristic = effectiveLockout(game);
  expect(heuristic).toBe(0);
});

test('Ineffective lockout (no bag)', () => {
  const screen = SimplePuyoScreen.fromLines([
    '',
    '',
    '',
    '',
    '  RGGR',
    'RBPPPR',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
  ]);
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    0,
    0,
    [0, 1, 2, 3],
    []
  );
  const heuristic = effectiveLockout(game);
  expect(heuristic).toBe(0);
});

// Skipped due to simulating a whole game with non-trivial AI being a bit heavy
test.skip('Server/client pausing game simulation', () => {
  const maxConsecutiveRerolls = 20;
  const gameSeed = randomSeed();
  const screenSeed = randomSeed();
  const colorSelection = randomColorSelection();
  const main = new MultiplayerGame(gameSeed, colorSelection, screenSeed);

  // In practice this would be two mirrors for each client
  const mirror = new MultiplayerGame(null, colorSelection, screenSeed);
  for (let i = 0; i < mirror.games.length; ++i) {
    // Send initial bag and prompt moves with next pieces
    mirror.games[i].bag = main.games[i].initialBag.concat(
      main.games[i].nextPiece
    );
  }

  const waitingForMove = [true, true];
  const passed = [false, false];

  simulation: while (true) {
    for (let i = 0; i < mirror.games.length; ++i) {
      if (!mirror.games[i].busy) {
        const strategy = flexDropletStrategy1(mirror.toSimpleGame(i));
        if (strategy.move === PASS) {
          passed[i] = true;
          waitingForMove[i] = false;
        } else {
          const {x1, y1, orientation} = MOVES[strategy.move];
          // Receive move
          const move = main.play(i, x1, y1, orientation, true);
          waitingForMove[i] = false;
          // Send move
          const mirrored = mirror.play(
            i,
            move.x1,
            move.y1,
            move.orientation,
            true
          );
          expect(mirrored.time).toBe(move.time);
        }
        // Run on the server
        while (
          main.games.every(g => g.busy) ||
          (strategy.move === PASS && main.games.some(g => g.busy))
        ) {
          main.tick();
        }
        // Run on the client(s)
        while (
          mirror.games.every(g => g.busy) ||
          (strategy.move === PASS && mirror.games.some(g => g.busy))
        ) {
          mirror.tick();
        }
        // Game over: End simulation
        if (main.games.some(g => g.lockedOut)) {
          break simulation;
        }
        // Impasse: End simulation
        if (main.consecutiveRerolls >= maxConsecutiveRerolls) {
          break simulation;
        }
        // Request more moves
        for (let j = 0; j < main.games.length; ++j) {
          if (!main.games[j].busy && !waitingForMove[j]) {
            if (passed[j]) {
              passed[j] = false;
            } else {
              // Reveal next piece
              main.games[j].nextPiece.forEach(color =>
                mirror.games[j].bag.push(color)
              );
            }
            waitingForMove[j] = true;
          }
        }
      }
    }
  }
  for (let i = 0; i < main.games.length; ++i) {
    for (let j = 0; j < main.games[i].screen.grid.length; ++j) {
      expect(
        puyosEqual(main.games[i].screen.grid[j], mirror.games[i].screen.grid[j])
      ).toBeTrue();
    }
  }
});
