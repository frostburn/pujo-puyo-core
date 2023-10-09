import {expect, test} from 'bun:test';
import {
  MOVES,
  MultiplayerGame,
  OnePlayerGame,
  SimpleGame,
  SinglePlayerGame,
  randomColorSelection,
} from '../game';
import {JKISS32, randomSeed} from '../jkiss';
import {
  BLUE,
  GARBAGE,
  GREEN,
  HEIGHT,
  PuyoScreen,
  RED,
  SimplePuyoScreen,
  WIDTH,
  YELLOW,
  puyoCount,
  puyosEqual,
} from '..';

test('Pending commit time', () => {
  const game = new MultiplayerGame();
  game.games[0].bag[0] = RED;
  game.games[0].screen = PuyoScreen.fromLines([
    'R     ',
    'RNNNNN',
    'RNNNNN',
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
  game.pendingGarbage[0] = 30;
  game.games[0].active = true;

  for (let i = 0; i < 100; ++i) {
    game.tick();
  }

  game.play(0, 1, 2, 0);

  for (let i = 0; i < 100; ++i) {
    game.tick();
  }

  expect(puyoCount(game.games[0].screen.grid[GARBAGE])).toBe(77);
});

test('No pending flash', () => {
  const game = new MultiplayerGame();
  game.pendingGarbage[0] = 30;
  const tickResults = game.tick();
  expect(tickResults[0].busy).toBeFalse();
  expect(tickResults[1].busy).toBeFalse();

  game.play(0, 0, 13, 0);

  for (let i = 0; i < 20; ++i) {
    expect(game.tick()[0].busy).toBeTrue();
  }
});

test('Garbage schedule', () => {
  // Create a deterministic game.
  const game = new MultiplayerGame(0);
  // Create a deterministic player that is somewhat successful.
  const jkiss = new JKISS32(7);
  // Create a dummy opponent.
  const dummy = new JKISS32(420);

  for (let i = 0; i < 1950; ++i) {
    if (!game.games[0].busy) {
      const {x1, y1, orientation} = MOVES[jkiss.step() % MOVES.length];
      game.play(0, x1, y1, orientation);
    }
    if (game.pendingGarbage[1] && !game.games[1].busy) {
      // Make sure that garbage is only sent when the chain is over.
      expect(game.games[0].screen.chainNumber).toBe(0);
      const {x1, y1, orientation} = MOVES[dummy.step() % MOVES.length];
      // Play a move to release it.
      game.play(1, x1, y1, orientation);
    }
    game.tick();
  }

  for (let i = 0; i < 110; ++i) {
    if (game.pendingGarbage[1]) {
      const {x1, y1, orientation} =
        MOVES[Math.floor(Math.random() * MOVES.length)];
      game.play(1, x1, y1, orientation);
    }
    game.tick();
  }

  expect(puyoCount(game.games[1].screen.grid[GARBAGE])).toBe(3);
});

test('Garbage offset in a fixed symmetric game', () => {
  // Create a random game.
  const game = new MultiplayerGame(592624221);
  // Create players with identical strategies.
  const players = [new JKISS32(3848740175), new JKISS32(3848740175)];

  for (let j = 0; j < 1337; ++j) {
    for (let i = 0; i < players.length; ++i) {
      expect(game.pendingGarbage[i]).toBe(0);
      if (!game.games[i].busy) {
        const {x1, y1, orientation} = MOVES[players[i].step() % MOVES.length];
        game.play(i, x1, y1, orientation);
      }
    }
    game.tick();
  }
});

test('Garbage offset in a random symmetric game', () => {
  // Create a random game.
  const gameSeed = randomSeed();
  const game = new MultiplayerGame(gameSeed);
  // Create players with identical strategies.
  const playerSeed = randomSeed();
  const players = [new JKISS32(playerSeed), new JKISS32(playerSeed)];

  for (let j = 0; j < 1337; ++j) {
    for (let i = 0; i < players.length; ++i) {
      expect(game.pendingGarbage[i]).toBe(0);
      if (!game.games[i].busy) {
        const {x1, y1, orientation} = MOVES[players[i].step() % MOVES.length];
        game.play(i, x1, y1, orientation);
      }
    }
    game.tick();
  }
});

test('Simple game late garbage offsetting', () => {
  const screen = SimplePuyoScreen.fromLines(['YRGB  ', 'YYRG B', 'RRGGBB']);
  screen.tick();

  const game = new SimpleGame(
    screen,
    0,
    false,
    0,
    1000,
    1000,
    [RED, GREEN, YELLOW, BLUE],
    [YELLOW, YELLOW]
  );

  game.playAndTick(0);

  expect(game.lateGarbage).toBeLessThan(1000);
});

test('Simple game pending garbage offsetting', () => {
  const screen = SimplePuyoScreen.fromLines(['YRGB  ', 'YYRG B', 'RRGGBB']);
  screen.tick();

  const game = new SimpleGame(
    screen,
    0,
    false,
    1000,
    0,
    0,
    [RED, GREEN, YELLOW, BLUE],
    [YELLOW, YELLOW]
  );

  game.playAndTick(0);

  expect(game.lateGarbage).toBeLessThan(1000 - 30);
});

test('Roof play', () => {
  const game = new OnePlayerGame();
  // Not recommended to play on the garbage insert line but kicks should still apply.
  game.play(0, 1, 0);
  expect(puyoCount(game.screen.mask)).toBe(2);
});

test('Mirror driving', () => {
  const mainSeed = randomSeed();
  const colorSelection = randomColorSelection();
  const screenSeed = randomSeed();
  const main = new MultiplayerGame(mainSeed, colorSelection, screenSeed);

  const mirror = new MultiplayerGame(null, colorSelection, screenSeed);

  // No independent moves.
  expect(() => mirror.play(0, 0, 2, 0)).toThrow();

  for (let j = 0; j < 50; ++j) {
    // Send data
    for (let i = 0; i < main.games.length; ++i) {
      mirror.games[i].bag = main.games[i].visibleBag;
    }
    const player = Math.floor(Math.random() * 2);
    const x = Math.floor(Math.random() * WIDTH);
    main.play(player, x, 2, 0);
    mirror.play(player, x, 2, 0);
    // Run individually
    while (main.games.some(game => game.active)) {
      main.tick();
      mirror.tick();
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

test('No 1-frame cheese', () => {
  const game = new MultiplayerGame();
  game.pendingGarbage[1] = 44;

  game.play(1, 0, HEIGHT - 1, 0);

  for (let i = 0; i < 20; ++i) {
    game.tick();
    if (!game.games[1].busy) {
      game.play(1, 1, HEIGHT - 1, 0);
    }
  }
  expect(puyoCount(game.games[1].screen.coloredMask)).toBe(2);
});

test('Permanent lockout', () => {
  const game = new SinglePlayerGame();
  while (!game.lockedOut) {
    game.play(Math.floor(Math.random() * WIDTH), 2, 0, Math.random() < 0.5);
    while (game.tick().busy);
  }
  for (let i = 0; i < 100; ++i) {
    const tickResult = game.tick();
    expect(tickResult.lockedOut).toBeTrue();
    expect(game.state.lockedOut).toBeTrue();
    if (!tickResult.busy) {
      game.play(Math.floor(Math.random() * WIDTH), 2, 0, Math.random() < 0.5);
    }
  }
});

test('To simple game JSON', () => {
  const game = new MultiplayerGame(0);
  game.play(0, 1, 2, 3, true);
  game.play(1, 2, 3, 0, true);
  while (game.tick()[0].busy);
  const simple = game.toSimpleGame(0);
  const serialized = JSON.stringify(simple);
  const revived = SimpleGame.fromJSON(JSON.parse(serialized));
  expect(revived.screen.grid).toEqual(game.games[0].screen.grid);
  expect(revived.screen.jkiss.state).toEqual(game.games[0].screen.jkiss.state);
});
