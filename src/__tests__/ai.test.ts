import {expect, test} from 'bun:test';
import {RED, SimplePuyoScreen} from '../screen';
import {SimpleGame} from '../game';
import {effectiveLockout} from '../ai';

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
  const game = new SimpleGame(screen, 0, false, 0, 0, 0, [0, 1, 2, 3], []);
  const heuristic = effectiveLockout(game);
  expect(heuristic).toBe(0);
});
