import { sleep } from "bun";
import {emptyPuyos, randomPuyos, logPuyos, flood, NUM_SLICES, fallOne} from "./bitboard";
import { logScreen, randomScreen, tick } from "./screen";

console.log("Hello via Bun!");

const puyos = randomPuyos();

logPuyos(puyos);

while(fallOne([puyos])){
  await sleep(100);
  logPuyos(puyos);
}

await sleep(500);

const screen = randomScreen();

logScreen(screen);

while (tick(screen)) {
  await sleep(200);
  logScreen(screen);
}

await sleep(500);
logScreen(screen);
