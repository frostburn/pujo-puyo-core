import {expect, test} from 'bun:test';
import {FischerTimer} from '../timer';

test('String conversion (no maximum)', () => {
  const timer = new FischerTimer(77000, Infinity, 11000);
  const str = timer.toString();
  expect(str).toBe('77+11');
  const parsed = FischerTimer.fromString(str);
  expect(parsed.remaining).toBe(77000);
  expect(parsed.maximum).toBe(Infinity);
  expect(parsed.increment).toBe(11000);
  expect(parsed.display()).toBe('1:17');
});

test('String conversion (defaul)', () => {
  const timer = new FischerTimer();
  const str = timer.toString();
  expect(str).toBe('60+10(max:120)');
  const parsed = FischerTimer.fromString(str);
  expect(parsed.remaining).toBe(60000);
  expect(parsed.maximum).toBe(120000);
  expect(parsed.increment).toBe(10000);
  expect(parsed.display()).toBe('1:00');
  for (let i = 0; i < 10; ++i) {
    parsed.begin();
    parsed.end();
  }
  expect(parsed.remaining).toBe(parsed.maximum);
  expect(parsed.display()).toBe('2:00');
});

test('Negative time zeroed', () => {
  const timer = new FischerTimer();
  timer.remaining = -10000;
  expect(timer.display()).toBe('0:00');
  expect(timer.flagged()).toBeTrue();
});
