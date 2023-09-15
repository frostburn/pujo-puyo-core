import {expect, test} from "bun:test";
import { BLUE, GARBAGE, GREEN, PURPLE, PuyoScreen, RED, YELLOW } from "./screen";
import { isEmpty, isNonEmpty, puyoAt } from "./bitboard";

test("Gravity", () => {
  const screen = new PuyoScreen();
  screen.insertPuyo(0, 0, PURPLE);
  while(screen.tick().busy);
  expect(isEmpty(screen.grid[RED])).toBeTruthy();
  expect(isEmpty(screen.grid[GREEN])).toBeTruthy();
  expect(isEmpty(screen.grid[YELLOW])).toBeTruthy();
  expect(isEmpty(screen.grid[BLUE])).toBeTruthy();
  expect(isNonEmpty(screen.grid[PURPLE])).toBeTruthy();
  expect(isEmpty(screen.grid[GARBAGE])).toBeTruthy();
  expect(puyoAt(screen.grid[PURPLE], 0, 14)).toBeTruthy();
});

test("Garbage clearing", () => {
  const screen = new PuyoScreen();
  screen.insertPuyo(0, 14, GARBAGE);
  screen.insertPuyo(0, 13, GARBAGE);
  screen.insertPuyo(1, 13, GARBAGE);
  screen.insertPuyo(2, 13, GARBAGE);
  screen.insertPuyo(1, 14, RED);
  screen.insertPuyo(2, 14, RED);
  screen.insertPuyo(3, 14, RED);
  screen.insertPuyo(4, 14, RED);

  screen.tick();
  expect(isEmpty(screen.grid[RED])).toBeTruthy();
  expect(puyoAt(screen.grid[GARBAGE], 0, 13)).toBeTruthy();
});

test("Ghost garbage preservation", () => {
  const screen = new PuyoScreen();
  for(let j = 0; j < 4; ++j) {
    for (let i = 0; i < 3; ++i) {
      screen.insertPuyo(5, 3 + i + 3*j, j);
    }
  }
  screen.insertPuyo(5, 2, GARBAGE);
  screen.insertPuyo(4, 14, BLUE);
  while(screen.tick().busy);
  expect(puyoAt(screen.grid[GARBAGE], 5, 5)).toBeTruthy();
});

test("Ghost garbage elimination", () => {
  const screen = new PuyoScreen();
  for(let j = 0; j < 4; ++j) {
    let min = 0;
    let max = 3;
    if (j == 0) {
      min = -1;
    }
    if (j == 3) {
      max = 2;
    }
    for (let i = min; i < max; ++i) {
      screen.insertPuyo(5, 4 + i + 3*j, j);
    }
  }
  screen.insertPuyo(5, 2, GARBAGE);
  while(screen.tick().busy);
  expect(isEmpty(screen.grid[GARBAGE])).toBeTruthy();
});
