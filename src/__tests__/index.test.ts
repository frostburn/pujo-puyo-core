import {expect, test} from 'bun:test';
import {WIDTH, combinedGarbageDisplay} from '..';

test('Combined display', () => {
  const {pending, late} = combinedGarbageDisplay(9, 9);
  expect(pending[0]).toBe('large');
  expect(pending[1]).toBe('small');
  expect(pending[2]).toBe('small');
  expect(pending[3]).toBe('small');
  expect(late[0]).toBe('large');
  expect(late[1]).toBe('small');
  expect(pending.length + late.length).not.toBeGreaterThan(WIDTH);
});

test('Random amounts display amounts', () => {
  for (let i = 0; i < 100; ++i) {
    const {pending, late} = combinedGarbageDisplay(
      Math.floor(Math.random() * 1000),
      Math.floor(Math.random() * 1000)
    );
    expect(pending.length + late.length).not.toBeGreaterThan(WIDTH);
  }
});

test('Pending only', () => {
  const late = combinedGarbageDisplay(1337, 0).late;
  expect(late.length).toBe(0);
});

test('Late only', () => {
  const pending = combinedGarbageDisplay(0, 1337).pending;
  expect(pending.length).toBe(0);
});
