import {expect, test} from "bun:test";
import { JKISS32 } from "./jkiss";


test("Determinancy", () => {
  const jkiss = new JKISS32(0);
  expect(jkiss.step()).toBe(3438387863);
  expect(jkiss.step()).toBe(2572090371);
  expect(jkiss.step()).toBe(828972288);
});

test("Full 32-bit range", () => {
  const jkiss = new JKISS32();
  let min = Infinity;
  let max = -Infinity;
  let numSteps = 0;
  while (min >= 100000000 || max <= 4000000000) {
    const result = jkiss.step();
    min = Math.min(min, result);
    max = Math.max(max, result);
    numSteps++;
  }
  expect(min).toBeLessThan(100000000);
  expect(max).toBeGreaterThan(4000000000);
});

test("Large sub-period", () => {
  const jkiss = new JKISS32();
  const originalState = new Uint32Array(jkiss.state);
  // I'd like to run this longer, but jkiss.state[1] seems to have a very small sub-period...
  for (let i = 0; i < 100000; ++i) {
    jkiss.step();
    if (originalState[0] == jkiss.state[0] || originalState[1] == jkiss.state[1] || originalState[2] == jkiss.state[2] || originalState[3] == jkiss.state[3]) {
      break;
    }
  }
  expect(jkiss.state[0]).not.toBe(originalState[0]);
  expect(jkiss.state[1]).not.toBe(originalState[1]);
  expect(jkiss.state[2]).not.toBe(originalState[2]);
  expect(jkiss.state[3]).not.toBe(originalState[3]);
});

test("Low bias", () => {
  const jkiss = new JKISS32(777);
  let heads = 0;
  for (let i = 0; i < 1000000; ++i) {
    heads += jkiss.step() & 1;
  }
  expect(heads).toBeLessThan(500500);
  expect(heads).toBeGreaterThan(499500);
});

test("Natural run length", () => {
  const jkiss = new JKISS32(123456789);
  let last = -1;
  let run = 0;
  let longest = -1;
  for (let i = 0; i < 1000000; ++i) {
    const coinFlip = jkiss.step() & 1;
    if (coinFlip == last) {
      run++;
    } else {
      longest = Math.max(longest, run);
      run = 0;
      last = coinFlip;
    }
  }
  expect(longest).toBeGreaterThan(20);
});

test("Shuffle", () => {
  const jkiss = new JKISS32(1);
  const array = [1, "two", null, {}, NaN];
  jkiss.shuffle(array);
  expect(array[0]).toBe(1);
  expect(array[1]).toBe("two");
  expect(array[2]).toBeNaN();
  expect(array[3]).toBeNull();
  expect(array[4]).toMatchObject({});

  // This tests that only one step was used.
  expect(jkiss.step()).toBe(1114502333);
});

test("Big shuffle", () => {
  const jkiss = new JKISS32(1);

  const array = [...Array(14).keys()];
  jkiss.shuffle(array);

  // This tests that now two steps were required to generate enough pseudo-entropy.
  expect(jkiss.step()).toBe(3867156467);
});
