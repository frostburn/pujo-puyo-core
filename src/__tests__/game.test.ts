import {expect, test} from 'bun:test';
import {MOVES, MultiplayerGame} from '../game';
import {JKISS32} from '../jkiss';
import {GARBAGE, PuyoScreen, RED, puyoCount} from '..';

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

  expect(puyoCount(game.games[1].screen.grid[GARBAGE])).toBe(8);
});

test('Garbage offset in a symmetric game', () => {
  // Create a random game.
  const game = new MultiplayerGame();
  // Create players with identical strategies.
  const players = [new JKISS32(777), new JKISS32(777)];

  for (let j = 0; j < 1337; ++j) {
    for (let i = 0; i < players.length; ++i) {
      expect(game.pendingGarbage[i]).toBe(0);
      if (!game.games[i].busy) {
        const {x1, y1, orientation} = MOVES[players[i].step() % MOVES.length];
        game.play(i, x1, y1, orientation);
      }
    }
    game.tick();
    // game.log();
  }
});
