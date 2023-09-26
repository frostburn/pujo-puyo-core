import {expect, test} from 'bun:test';
import {puyoCount} from '../bitboard';

test('Puyo counter', () => {
  const puyos = new Uint16Array([1 | 2 | 4, 256, 1024]);
  expect(puyoCount(puyos)).toBe(5);
});
