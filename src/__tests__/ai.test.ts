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
import {TimeWarpingGame, TimeWarpingMirror} from '../realtime';

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

// Skipped due to simulating a whole game with non-trivial AI being a bit heavy
// At least it's not running in wall clock time...
test.skip('Server/client realtime game simulation', () => {
  const maxConsecutiveRerolls = 20;
  const gameSeed = randomSeed();
  const screenSeed = randomSeed();
  const colorSelection = randomColorSelection();
  const origin = new MultiplayerGame(gameSeed, colorSelection, screenSeed);

  // Server
  const main = new TimeWarpingGame(origin);

  const mirrorOrigin = new MultiplayerGame(null, colorSelection, screenSeed);
  const initialBags = origin.initialBags;
  // Two dueling clients
  const mirrors = [
    new TimeWarpingMirror(mirrorOrigin, initialBags),
    new TimeWarpingMirror(mirrorOrigin, initialBags),
  ];

  // Client-side
  const didPlay = [false, false];
  let botTime: number | null = 0;
  let humanTime = 0;

  const pieces = main.revealPieces(0);
  expect(pieces).toHaveLength(2);
  for (const piece of pieces) {
    for (const mirror of mirrors) {
      mirror.addPiece(piece);
    }
  }

  // Simulate network lag
  let serverTime = 1 + Math.floor(Math.random() * 5);

  // Simulate human imperfection
  let reactionTime = 2 + Math.floor(Math.random() * 7);

  // Simulate network desync
  const clientTimes = [0, 1];

  simulation: while (true) {
    // Player 0 simulates a bot that plays with perfect reaction time, abusing lag compensation to the fullest.
    if (botTime !== null && clientTimes[0] >= botTime && !didPlay[0]) {
      const game = mirrors[0].warp(botTime)[0];
      if (game) {
        const strategy = flexDropletStrategy1(game.toSimpleGame(0));
        if (strategy.move === PASS) {
          botTime = null;
        } else {
          const {x1, y1, orientation} = MOVES[strategy.move];
          const move = game.play(0, x1, y1, orientation, true);
          console.log('Adding', move);
          const rejectedMoves = main.addMove(move);
          mirrors[0].addMove(move);
          mirrors[1].addMove(move);
          mirrors[0].deleteMoves(rejectedMoves);
          mirrors[1].deleteMoves(rejectedMoves);
          didPlay[0] = true;
        }
      } else {
        botTime++;
      }
    }
    clientTimes[0]++;
    // Player 1 simulates a human with finite reaction time, while still being lag compensated.
    if (clientTimes[1] >= humanTime + reactionTime && !didPlay[1]) {
      const game = mirrors[1].warp(clientTimes[1])[0];
      if (game) {
        const strategy = flexDropletStrategy1(game.toSimpleGame(1));
        if (strategy.move === PASS) {
          reactionTime += 10;
        } else {
          const {x1, y1, orientation} = MOVES[strategy.move];
          const move = game.play(1, x1, y1, orientation, Math.random() > 0.2);
          console.log('Adding', move);
          const rejectedMoves = main.addMove(move);
          mirrors[0].addMove(move);
          mirrors[1].addMove(move);
          mirrors[0].deleteMoves(rejectedMoves);
          mirrors[1].deleteMoves(rejectedMoves);
          didPlay[1] = true;
          reactionTime = 2 + Math.floor(Math.random() * 7);
          if (botTime === null) {
            botTime = move.time;
          }
        }
      } else {
        reactionTime++;
      }
    }
    clientTimes[1]++;
    // Player 1's browser is running ahead a bit...
    if (Math.random() < 0.05) {
      clientTimes[1]++;
    }

    serverTime++;
    const pieces = main.revealPieces(serverTime);
    for (const piece of pieces) {
      console.log('Revealing', piece);
      if (piece.player === 0) {
        botTime = piece.time;
      } else {
        humanTime = piece.time;
      }
      didPlay[piece.player] = false;
      for (const mirror of mirrors) {
        mirror.addPiece(piece);
      }
    }

    const game = main.warp(serverTime);

    // Game over: End simulation
    if (game.games.some(g => g.lockedOut)) {
      break simulation;
    }
    // Impasse: End simulation
    if (game.consecutiveRerolls >= maxConsecutiveRerolls) {
      break simulation;
    }
  }

  const game = main.warp(serverTime);
  game.log();
  const mirrorGames = mirrors.map(m => m.warp(serverTime)[0]);

  for (const mirrorGame of mirrorGames) {
    expect(mirrorGame).not.toBeNull();
    mirrorGame!.log();
  }

  for (let i = 0; i < game.games.length; ++i) {
    for (let j = 0; j < game.games[i].screen.grid.length; ++j) {
      for (let k = 0; k < mirrorGames.length; ++k) {
        expect(
          puyosEqual(
            game.games[i].screen.grid[j],
            mirrorGames[k]!.games[i].screen.grid[j]
          )
        ).toBeTrue();
      }
    }
  }
});
