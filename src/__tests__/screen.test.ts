import {expect, test} from 'bun:test';
import {
  BLUE,
  GARBAGE,
  GREEN,
  PURPLE,
  PuyoScreen,
  RED,
  SimplePuyoScreen,
  YELLOW,
} from '../screen';
import {HEIGHT, isEmpty, isNonEmpty, puyoAt, puyoCount} from '../bitboard';

test('Gravity', () => {
  const screen = new PuyoScreen();
  screen.insertPuyo(0, 0, PURPLE);
  while (screen.tick().busy);
  expect(isEmpty(screen.grid[RED])).toBeTruthy();
  expect(isEmpty(screen.grid[GREEN])).toBeTruthy();
  expect(isEmpty(screen.grid[YELLOW])).toBeTruthy();
  expect(isEmpty(screen.grid[BLUE])).toBeTruthy();
  expect(isNonEmpty(screen.grid[PURPLE])).toBeTruthy();
  expect(isEmpty(screen.grid[GARBAGE])).toBeTruthy();
  expect(puyoAt(screen.grid[PURPLE], 0, HEIGHT - 1)).toBeTruthy();
});

test('Landing signal', () => {
  const screen = new PuyoScreen();
  screen.insertPuyo(3, HEIGHT - 3, YELLOW);
  expect(screen.tick().didLand).toBeFalse();
  expect(screen.tick().didLand).toBeTrue();
  expect(screen.tick().didLand).toBeFalse();
});

test('Garbage clearing', () => {
  const screen = new PuyoScreen();
  screen.insertPuyo(0, HEIGHT - 1, GARBAGE);
  screen.insertPuyo(0, HEIGHT - 2, GARBAGE);
  screen.insertPuyo(1, HEIGHT - 2, GARBAGE);
  screen.insertPuyo(2, HEIGHT - 2, GARBAGE);
  screen.insertPuyo(1, HEIGHT - 1, RED);
  screen.insertPuyo(2, HEIGHT - 1, RED);
  screen.insertPuyo(3, HEIGHT - 1, RED);
  screen.insertPuyo(4, HEIGHT - 1, RED);

  while (screen.tick().busy);

  expect(isEmpty(screen.grid[RED])).toBeTruthy();
  expect(puyoAt(screen.grid[GARBAGE], 0, HEIGHT - 1)).toBeTruthy();
});

test('Garbage clearing across the old seam 1', () => {
  const screen = PuyoScreen.fromLines([
    ' PPPP ',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
  ]);
  while (screen.tick().busy);
  expect(puyoCount(screen.grid[GARBAGE])).toBe(26);
});

test('Garbage clearing across the old seam 2', () => {
  const screen = PuyoScreen.fromLines([
    'NNNNNN',
    'NRRRRN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
    'NNNNNN',
  ]);
  while (screen.tick().busy);
  expect(puyoCount(screen.grid[GARBAGE])).toBe(22);
});

test('Garbage clearing across the old seam 3', () => {
  const screen = PuyoScreen.fromLines([
    ' GGGG',
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
  while (screen.tick().busy);
  expect(puyoCount(screen.grid[GARBAGE])).toBe(56);
});

test('Garbage clearing across the old seam 4', () => {
  const screen = PuyoScreen.fromLines([
    'NNNNNN',
    'NBBBBN',
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
  while (screen.tick().busy);
  expect(puyoCount(screen.grid[GARBAGE])).toBe(52);
});

test('Ghost garbage preservation', () => {
  const screen = new PuyoScreen();
  for (let j = 0; j < 4; ++j) {
    for (let i = 0; i < 3; ++i) {
      screen.insertPuyo(5, 3 + i + 3 * j, j);
    }
  }
  screen.insertPuyo(5, 2, GARBAGE);
  screen.insertPuyo(4, 14, BLUE);
  while (screen.tick().busy);
  expect(puyoAt(screen.grid[GARBAGE], 5, 6)).toBeTruthy();
});

test('Ghost garbage elimination', () => {
  const lines = [
    '',
    '',
    'N',
    'R',
    'R',
    'R',
    'R',
    'G',
    'G',
    'G',
    'Y',
    'Y',
    'Y',
    'B',
    'B',
  ];

  const screen = PuyoScreen.fromLines(lines);
  expect(isNonEmpty(screen.grid[GARBAGE])).toBeTruthy();
  while (screen.tick().busy);
  expect(isEmpty(screen.grid[GARBAGE])).toBeTruthy();
});

test('Stones of garbage', () => {
  const screen = new PuyoScreen();
  screen.insertPuyo(0, 1, RED);
  screen.insertPuyo(1, 1, GREEN);
  screen.bufferedGarbage = 30;
  while (screen.tick().busy);
  screen.insertPuyo(1, 1, BLUE);
  screen.insertPuyo(1, 2, YELLOW);
  screen.bufferedGarbage = 30;
  while (screen.tick().busy);
  screen.insertPuyo(5, 1, PURPLE);
  screen.insertPuyo(5, 2, PURPLE);
  screen.bufferedGarbage = 6;
  while (screen.tick().busy);

  expect(puyoAt(screen.grid[RED], 0, HEIGHT - 1)).toBeTruthy();
  expect(puyoAt(screen.grid[GREEN], 1, HEIGHT - 1)).toBeTruthy();
  expect(puyoAt(screen.grid[BLUE], 1, 8)).toBeTruthy();
  expect(puyoAt(screen.grid[YELLOW], 1, 9)).toBeTruthy();
  expect(puyoAt(screen.grid[PURPLE], 5, 5)).toBeTruthy();
  expect(puyoAt(screen.grid[PURPLE], 5, 4)).toBeTruthy();
  // Two stones and a line of garbage with one garbage puyo vanishing beyond the ghost line.
  expect(puyoCount(screen.grid[GARBAGE])).toBe(30 + 30 + 6 - 1);
});

test('Simple screen gravity resolution', () => {
  const screen = new SimplePuyoScreen();
  screen.insertPuyo(0, 0, RED);
  screen.tick();
  expect(puyoAt(screen.grid[RED], 0, HEIGHT - 1)).toBeTruthy();
});

test('Simple screen chain resolution', () => {
  const lines = [
    '  RR P',
    ' YYGRR',
    'BGYGGR',
    'GRRBBG',
    'GGRYRB',
    'BRGYRB',
    'BBRGYR',
    'RRGGYR',
  ];
  const screen = SimplePuyoScreen.fromLines(lines);
  const zero = screen.tick().score;
  expect(zero).toBe(0);

  screen.insertPuyo(0, 0, YELLOW);
  const score = screen.tick().score;
  expect(score).toBe(
    40 * (1 + 8 + 16 + 32 + 64 + 96 + 128 + 160 + 192 + 224 + 256)
  );
  expect(puyoAt(screen.grid[PURPLE], 5, HEIGHT - 1)).toBeTruthy();
});

test('Ghost group preservation', () => {
  const lines = [
    '',
    '',
    'GGGG',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
  ];
  const screen = SimplePuyoScreen.fromLines(lines);
  const zero = screen.tick().score;
  expect(zero).toBe(0);
});

test('Top group elimination', () => {
  const lines = [
    '',
    '',
    '',
    'PPPP',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
    'NNNN',
  ];
  const screen = SimplePuyoScreen.fromLines(lines);
  const score = screen.tick().score;
  expect(score).toBe(40);
});

test('Simple screen partial garbage line', () => {
  const screen = new SimplePuyoScreen();
  screen.bufferedGarbage = 2;
  screen.tick();
  expect(puyoCount(screen.grid[GARBAGE])).toBe(2);
});

test('Screen partial garbage line', () => {
  const screen = new PuyoScreen();
  screen.bufferedGarbage = 2;
  screen.tick();
  expect(puyoCount(screen.grid[GARBAGE])).toBe(2);
});
