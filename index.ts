import {emptyPuyos, randomPuyos, logPuyos, flood, NUM_SLICES, fallOne} from "./bitboard";

console.log("Hello via Bun!");

const puyos = randomPuyos();

logPuyos(puyos);

for (let i = 0; i < 9; ++i) {
  fallOne([puyos]);
  logPuyos(puyos);
}
