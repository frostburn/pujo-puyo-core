import {expect, test} from 'bun:test';
import {
  DEFAULT_TARGET_POINTS,
  MOVES,
  MultiplayerGame,
  MultiplayerParams,
  ReplayParams,
  SimpleGame,
  SinglePlayerGame,
  defaultRules,
  randomMultiplayer,
  randomSinglePlayer,
  seededMultiplayer,
} from '../game';
import {JKISS32, randomSeed} from '../jkiss';
import {
  BLUE,
  GARBAGE,
  GREEN,
  HEIGHT,
  PURPLE,
  RED,
  WIDTH,
  YELLOW,
  puyoCount,
  puyosEqual,
} from '..';
import {screenFromLines, simpleFromLines} from './utils';

test('Pending commit time', () => {
  const game = new MultiplayerGame(randomMultiplayer());
  game.games[0].bag[0] = RED;
  game.games[0].screen = screenFromLines([
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
  const game = new MultiplayerGame(randomMultiplayer());
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
  const params = seededMultiplayer(0);
  const game = new MultiplayerGame(params);
  // Create a deterministic player that is somewhat successful.
  const jkiss = new JKISS32(1);
  // Create a dummy opponent.
  const dummy = new JKISS32(420);

  for (let i = 0; i < 1500; ++i) {
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

  expect(puyoCount(game.games[1].screen.grid[GARBAGE])).toBe(8);
});

test('Garbage offset in a fixed symmetric game', () => {
  // Create a random game.
  const params = randomMultiplayer();
  params.bagSeeds = [592624221, 592624221];
  params.garbageSeeds = [592624221, 592624221];
  const game = new MultiplayerGame(params);
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
  const params = randomMultiplayer();
  params.bagSeeds[1] = params.bagSeeds[0];
  const game = new MultiplayerGame(params);
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
  const screen = simpleFromLines(['YRGB  ', 'YYRG B', 'RRGGBB']);
  screen.tick();

  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    1000,
    1000,
    [RED, GREEN, YELLOW, BLUE],
    [YELLOW, YELLOW],
    defaultRules()
  );

  game.playAndTick(0);

  expect(game.lateGarbage).toBeLessThan(1000);
});

test('Simple game pending garbage offsetting', () => {
  const screen = simpleFromLines(['YRGB  ', 'YYRG B', 'RRGGBB']);
  screen.tick();

  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    1000,
    0,
    0,
    [RED, GREEN, YELLOW, BLUE],
    [YELLOW, YELLOW],
    defaultRules()
  );

  game.playAndTick(0);

  expect(game.lateGarbage).toBeLessThan(1000 - 30);
});

test('Roof play', () => {
  const game = new SinglePlayerGame(randomSinglePlayer());
  // Not recommended to play on the garbage insert line but kicks should still apply.
  game.play(0, 1, 0);
  expect(puyoCount(game.screen.mask)).toBe(2);
});

test('Mirror driving', () => {
  const params = randomMultiplayer();
  params.rules.marginFrames = 5000;
  const main = new MultiplayerGame(params);

  const mirrorParams: MultiplayerParams = {
    ...params,
    bagSeeds: null,
    initialBags: [[], []],
  };
  const mirror = new MultiplayerGame(mirrorParams);

  // No independent moves.
  expect(() => mirror.play(0, 0, 2, 0)).toThrow();

  mirror.games[0].bag = main.games[0].initialBag;
  mirror.games[1].bag = main.games[1].initialBag;

  // Send data to prompt moves
  for (let i = 0; i < main.games.length; ++i) {
    main.games[i].nextPiece.forEach(color => mirror.games[i].bag.push(color));
  }

  for (let i = 0; i < 50; ++i) {
    const player = Math.floor(Math.random() * 2);
    const x = Math.floor(Math.random() * WIDTH);
    main.play(player, x, 2, 0);
    mirror.play(player, x, 2, 0);
    // Run individually
    while (main.games.some(game => game.busy)) {
      main.tick();
      mirror.tick();
    }
    // Send data to prompt the next move
    main.games[player].nextPiece.forEach(color =>
      mirror.games[player].bag.push(color)
    );
  }

  for (let i = 0; i < mirror.games.length; ++i) {
    expect(mirror.games[i].bag.length).not.toBeGreaterThan(6);
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
  const game = new MultiplayerGame(randomMultiplayer());
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
  const game = new SinglePlayerGame(randomSinglePlayer());
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
  const game = new MultiplayerGame(randomMultiplayer());
  game.play(0, 1, 2, 3, true);
  game.play(1, 2, 3, 0, true);
  while (game.tick()[0].busy);
  const simple = game.toSimpleGame(0);
  const serialized = JSON.stringify(simple);
  const revived = SimpleGame.fromJSON(JSON.parse(serialized));
  expect(revived.screen.grid).toEqual(game.games[0].screen.grid);
  expect(revived.screen.jkiss.state).toEqual(game.games[0].screen.jkiss.state);
});

test('Default move count', () => {
  const screen = simpleFromLines([]);
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    0,
    0,
    [RED, GREEN, YELLOW, BLUE],
    [RED, GREEN],
    defaultRules()
  );
  expect(game.availableMoves.length).toBe(22);
});

test('Move count with pass', () => {
  const screen = simpleFromLines([]);
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    1,
    1,
    [RED, GREEN, YELLOW, BLUE],
    [RED, GREEN],
    defaultRules()
  );
  expect(game.availableMoves.length).toBe(23);
});

test('Move count reduction (symmetry)', () => {
  const screen = simpleFromLines([]);
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    0,
    0,
    [RED, GREEN, YELLOW, BLUE],
    [RED, RED],
    defaultRules()
  );
  expect(game.availableMoves.length).toBe(11);
});

test('Move count reduction (rerolls)', () => {
  const screen = simpleFromLines([
    'RR',
    'GG',
    'RR',
    'GG',
    'RR',
    'GG',
    'RR',
    'GG',
    'RR',
    'GG',
    'RR',
    'GG',
    'RR',
  ]);
  screen.tick();
  const game = new SimpleGame(
    screen,
    DEFAULT_TARGET_POINTS,
    0,
    false,
    0,
    0,
    0,
    [RED, GREEN, YELLOW, BLUE],
    [RED, GREEN],
    defaultRules()
  );
  expect(game.availableMoves.length).toBe(22 - 4 - 2 + 1);
});

test('Null end', () => {
  const game = new MultiplayerGame(seededMultiplayer(0));

  while (true) {
    if (!game.games[0].busy) {
      game.play(0, 0, 0, 0);
      game.play(1, 0, 0, 0);
    }
    if (game.tick()[0].lockedOut) {
      break;
    }
  }
  expect(game.age).toBe(12510);
  // It's up to the game server to decide how much is too much.
  expect(
    game.games[0].consecutiveRerolls + game.games[1].consecutiveRerolls
  ).toBe(1362);
});

test('AFK end', () => {
  const game = new MultiplayerGame(seededMultiplayer(1));

  while (!game.tick()[0].lockedOut);
  expect(game.age).toBe(12502);
});

test('Handicap', () => {
  const colorSelection = [RED, GREEN, YELLOW, BLUE];
  const colorSelections = [colorSelection, colorSelection];
  const params = randomMultiplayer();
  params.colorSelections = colorSelections;
  const initialBag = [GREEN, RED, RED, RED, RED, RED];
  params.initialBags = [initialBag, initialBag];
  params.rules.targetPoints = [1, 70];
  const game = new MultiplayerGame(params);
  game.play(0, 0, 0, 0, true);
  while (game.tick()[0].busy);
  game.play(0, 1, 0, 0, true);
  while (game.tick()[0].busy);
  game.play(0, 1, 0, 0, true);
  while (game.tick()[0].busy);

  expect(game.pendingGarbage[1]).toBe(100);
  game.games.forEach(g => expect(g.consecutiveRerolls).toBe(0));
});

test('Soft drops make sound', () => {
  const game = new SinglePlayerGame(randomSinglePlayer());
  game.play(0, 1, 0, false);
  let numLandings = 0;
  for (let i = 0; i < 100; ++i) {
    if (game.tick().coloredLanded) {
      numLandings++;
    }
  }
  expect(numLandings).toBe(1);
});

test('Hard drops make sound', () => {
  const game = new SinglePlayerGame(randomSinglePlayer());
  game.play(0, 1, 0, true);
  let numLandings = 0;
  for (let i = 0; i < 100; ++i) {
    if (game.tick().coloredLanded) {
      numLandings++;
    }
  }
  expect(numLandings).toBe(1);
});

test('Garbage forced on a passive opponent', () => {
  const game = new MultiplayerGame(randomMultiplayer());
  game.pendingGarbage[0] = 9001;
  for (let i = 0; i < 2000; ++i) {
    game.tick();
  }
  expect(game.games[0].lockedOut).toBeTrue();
});

test('No mercy flashes', () => {
  const game = new MultiplayerGame(randomMultiplayer());
  for (let i = 0; i < 1000; ++i) {
    expect(game.games[0].busy).toBeFalse();
    expect(game.games[1].busy).toBeFalse();
    game.tick();
  }
});

test('No mirror cheese', () => {
  // Create a deterministic game with anti-cheese seeds.
  const params = seededMultiplayer(0);
  params.bagSeeds = [0, 1];
  const game = new MultiplayerGame(params);
  // Create a deterministic player that is somewhat successful.
  const jkiss = new JKISS32(7);

  let move: (typeof MOVES)[number] | null = null;

  for (let i = 0; i < 1950; ++i) {
    // Play using cheesy mirror strategy.
    if (move !== null) {
      expect(!game.games[1].busy);
      game.play(1, move.x1, move.y1, move.orientation);
      move = null;
    }
    if (!game.games[0].busy) {
      // The cheese works but only up to a limit.
      if (game.age < 384) {
        for (let i = 0; i < game.games[0].screen.grid.length; ++i) {
          expect(
            puyosEqual(
              game.games[0].screen.grid[i],
              game.games[1].screen.grid[i]
            )
          ).toBeTrue();
        }
      }
      move = MOVES[jkiss.step() % MOVES.length];
      game.play(0, move.x1, move.y1, move.orientation);
    }
    game.tick();
  }

  expect(game.games[0].score).not.toBe(game.games[1].score);
});

test('Custom rules', () => {
  const params: ReplayParams = {
    bagSeeds: [1, 2],
    garbageSeeds: [3, 4],
    colorSelections: [
      [RED, GREEN, BLUE],
      [RED, GREEN, YELLOW, BLUE, PURPLE],
    ],
    initialBags: [
      [RED, RED, RED, RED, GREEN, GREEN],
      [RED, RED, RED, RED, RED, PURPLE],
    ],
    rules: {
      clearThreshold: 5,
      jiggleFrames: 20,
      sparkFrames: 30,
      targetPoints: [90, 50],
      marginFrames: Infinity,
      mercyFrames: Infinity,
    },
  };
  const game = new MultiplayerGame(params);
  game.play(0, 0, 0, 0, true);
  game.play(1, 0, 0, 0, true);
  while (game.games.some(g => g.busy)) game.tick();
  expect(game.age).toBe(23);
  game.play(0, 0, 0, 0, true);
  game.play(1, 0, 0, 0, true);
  while (game.games.some(g => g.busy)) game.tick();
  expect(game.games[0].score).toBe(0);
  expect(game.games[1].score).toBe(0);
  game.play(0, 0, 0, 0, true);
  game.play(1, 0, 0, 0, true);
  while (game.games.some(g => g.busy)) game.tick();
  expect(game.games[0].score).toBe(0);
  expect(game.games[1].score).toBe(50);
  expect(game.pendingGarbage[0]).toBe(1);

  const clone = game.clone();
  expect(clone.games[0].colorSelection).toHaveLength(3);
  expect(clone.games[1].colorSelection).toHaveLength(5);
  expect(clone.targetPoints[0]).toBe(90);
  expect(clone.targetPoints[1]).toBe(50);

  for (const g of clone.games) {
    expect(g.rules.clearThreshold).toBe(5);
    expect(g.rules.jiggleFrames).toBe(20);
    expect(g.rules.sparkFrames).toBe(30);
    expect(g.rules.marginFrames).toBe(Infinity);
    expect(g.rules.mercyFrames).toBe(Infinity);
  }
});
