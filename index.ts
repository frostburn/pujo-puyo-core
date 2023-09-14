import {emptyPuyos, randomPuyos, logPuyos, flood, NUM_SLICES, fallOne} from "./bitboard";
import { logScreen, randomScreen } from "./screen";

console.log("Hello via Bun!");

const puyos = randomPuyos();

logPuyos(puyos);

for (let i = 0; i < 9; ++i) {
  fallOne([puyos]);
  logPuyos(puyos);
}

const screen = randomScreen();

logScreen(screen);

for (let i = 0; i < 9; ++i) {
  fallOne(screen.grid);
  logScreen(screen);
}
