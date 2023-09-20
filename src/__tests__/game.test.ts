import {expect, test} from 'bun:test';
import {MOVES, MultiplayerGame} from '../game';
import {JKISS32} from '../jkiss';
import {GARBAGE, puyoCount} from '..';

test('Garbage schedule', () => {
  // Create a deterministic game.
  const game = new MultiplayerGame(0);
  // Create a deterministic player that is somewhat successful.
  const jkiss = new JKISS32(2);
  // Create a dummy opponent.
  const dummy = new JKISS32(420);

  for (let i = 0; i < 845; ++i) {
    if (!game.games[0].busy) {
      const {x1, y1, orientation} = MOVES[jkiss.step() % MOVES.length];
      game.play(0, x1, y1, orientation);
    }
    if (game.pendingGarbage[1]) {
      // Make sure that garbage is only sent when the chain is over.
      expect(game.games[0].screen.chainNumber).toBe(0);
      const {x1, y1, orientation} = MOVES[dummy.step() % MOVES.length];
      // Play a move to release it.
      game.play(1, x1, y1, orientation);
    }
    game.tick();
  }

  for (let i = 0; i < 130; ++i) {
    if (game.pendingGarbage[1]) {
      const {x1, y1, orientation} =
        MOVES[Math.floor(Math.random() * MOVES.length)];
      game.play(1, x1, y1, orientation);
    }
    game.tick();
    // game.log();
  }

  expect(puyoCount(game.games[1].screen.grid[GARBAGE])).toBe(29);
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
