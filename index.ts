import { sleep } from "bun";
import { randomPuyos, logPuyos, fallOne, WIDTH} from "./bitboard";
import { NUM_PUYO_COLORS, insertPuyo, logScreen, randomScreen, tick } from "./screen";

console.log("Hello via Bun!");

const puyos = randomPuyos();

logPuyos(puyos);

while(fallOne([puyos])){
  await sleep(50);
  logPuyos(puyos);
}

await sleep(500);

const screen = randomScreen();

logScreen(screen);

while (tick(screen)) {
  await sleep(100);
  logScreen(screen);
}

await sleep(500);
logScreen(screen);

while (true) {
  const x = Math.floor(Math.random() * WIDTH);
  const y = 2;
  const color = Math.floor(Math.random() * NUM_PUYO_COLORS);
  if (insertPuyo(screen, x, y, color)) {
    break;
  }
  const x2 = Math.max(0, Math.min(WIDTH - 1, x + Math.floor(3*Math.random() - 1)));
  const y2 = (x2 == x) ? 3 : 2;
  const color2 = Math.floor(Math.random() * NUM_PUYO_COLORS);
  if (insertPuyo(screen, x2, y2, color2)) {
    break;
  }

  while (tick(screen)) {
    await sleep(100);
    logScreen(screen);
  }
}
