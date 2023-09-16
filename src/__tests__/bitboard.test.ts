import {expect, test} from 'bun:test';
import {puyoCount} from '../bitboard';

test('Puyo counter', () => {
  const puyos = new Uint32Array([1 | 2 | 4, 256, 2147483648]);
  expect(puyoCount(puyos)).toBe(5);
});
