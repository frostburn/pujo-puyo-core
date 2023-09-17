import {sleep} from 'bun';
import {WIDTH} from './bitboard';
import {colorOf} from './screen';
import {stdin, stdout} from 'process';
import {MOVES, MultiplayerGame, SinglePlayerGame} from './game';
import {maxDropletStrategy1, maxDropletStrategy2} from './ai';

// TODO: Target the browser, no bun dependencies.

console.log();
console.log(
  'Welcome to \x1b[3mPujo Puyo\x1b[0m, powered by \x1b[4mBun\x1b[0m!'
);

// Play a demo game.
if (process.argv.length >= 3) {
  const game = new MultiplayerGame();
  const strategies = [maxDropletStrategy1, maxDropletStrategy2];
  const heuristics = [0, 0];
  let lastTime = process.hrtime();
  for (let j = 0; j < 1000; ++j) {
    for (let i = 0; i < 2; ++i) {
      if (!game.games[i].active) {
        const simpleGame = game.toSimpleGame(i);
        const {move, score} = strategies[i](simpleGame);
        heuristics[i] = score;
        const {x1, y1, orientation} = MOVES[move];
        game.play(i, x1, y1, orientation);
      }
    }
    game.tick();
    const diff = process.hrtime(lastTime);
    const millis = diff[0] * 1000 + diff[1] / 1000 / 1000;
    await sleep(Math.max(0, 70 - millis));
    lastTime = process.hrtime();
    game.log();
    let line = `H0: ${heuristics[0].toFixed(1)}`;
    while (line.length < 19) {
      line += ' ';
    }
    console.log(line + `H1: ${heuristics[1].toFixed(1)}`);
  }
  // eslint-disable-next-line
  process.exit();
}

const UP = '\u001b[A';
const DOWN = '\u001b[B';
const RIGHT = '\u001b[C';
const LEFT = '\u001b[D';

stdin.setRawMode(true);
stdin.resume();

stdin.setEncoding('utf8');

const game = new SinglePlayerGame();
let busy = false;
let needsRedraw = false;

function drawScreen(initial = false) {
  if (!initial) {
    if (!busy) {
      stdout.write('\r');
      for (let i = 0; i < 2; ++i) {
        stdout.write(UP);
      }
    } else {
      for (let i = 0; i < 19; ++i) {
        stdout.write(UP);
      }
    }
  }
  const lines = game.displayLines();
  // Break open the roof to make space for the cursor.
  lines[0] = '║            ║' + lines[0].slice(14);
  // Work around +10x chain taking more display space than 1x chain.
  lines[lines.length - 2] += ' ';
  lines.forEach(line => console.log(line));
  needsRedraw = false;
}

drawScreen(true);

for (let i = 0; i < 19; ++i) {
  stdout.write(UP);
}
stdout.write(RIGHT + RIGHT + RIGHT + RIGHT + RIGHT);
stdout.write(
  colorOf(game.color2) + '●' + LEFT + DOWN + colorOf(game.color1) + '●' + LEFT
);

let x = 2;
let orientation = 0;

function clearPrimary() {
  stdout.write(' ' + LEFT);
}

function writePrimary() {
  stdout.write(colorOf(game.color1) + '●' + LEFT);
}

function clearSecondary() {
  if (orientation === 0) {
    stdout.write(UP + ' ' + LEFT + DOWN);
  }
  if (orientation === 1) {
    stdout.write(LEFT + LEFT + ' ' + RIGHT);
  }
  if (orientation === 2) {
    stdout.write(DOWN + ' ' + LEFT + UP);
  }
  if (orientation === 3) {
    stdout.write(RIGHT + RIGHT + ' ' + LEFT + LEFT + LEFT);
  }
}

function writeSecondary() {
  if (orientation === 0) {
    stdout.write(UP + colorOf(game.color2) + '●' + LEFT + DOWN);
  }
  if (orientation === 1) {
    stdout.write(LEFT + LEFT + colorOf(game.color2) + '●' + RIGHT);
  }
  if (orientation === 2) {
    stdout.write(DOWN + colorOf(game.color2) + '●' + LEFT + UP);
  }
  if (orientation === 3) {
    stdout.write(
      RIGHT + RIGHT + colorOf(game.color2) + '●' + LEFT + LEFT + LEFT
    );
  }
}

stdin.on('data', (key: string) => {
  // ctrl-c ( end of text )
  if (key === '\u0003') {
    console.log('\x1b[0m');
    for (let i = 0; i < 18; ++i) {
      console.log('');
    }
    console.log('Thank you for playing!');
    // eslint-disable-next-line
    process.exit();
  }

  if (busy) {
    return;
  }

  if (key === UP) {
    clearSecondary();
    orientation = (orientation + 1) % 4;
    if (orientation === 1 && x === 0) {
      clearPrimary();
      x++;
      stdout.write(RIGHT + RIGHT);
      writePrimary();
    }
    if (orientation === 3 && x === WIDTH - 1) {
      clearPrimary();
      x--;
      stdout.write(LEFT + LEFT);
      writePrimary();
    }
    writeSecondary();
  }
  if (key === LEFT && x > 0 && (x > 1 || orientation !== 1)) {
    clearPrimary();
    clearSecondary();
    x--;
    stdout.write(LEFT + LEFT);
    writePrimary();
    writeSecondary();
  }
  if (key === RIGHT && x < WIDTH - 1 && (x < WIDTH - 2 || orientation !== 3)) {
    clearPrimary();
    clearSecondary();
    x++;
    stdout.write(RIGHT + RIGHT);
    writePrimary();
    writeSecondary();
  }
  if (key === DOWN) {
    clearPrimary();
    clearSecondary();
    console.log('\x1b[0m');
    game.play(x, 2, orientation);
    orientation = 0;
    if (Math.random() < 0.1) {
      game.screen.bufferedGarbage = Math.floor(Math.random() * 3 + 1);
    }
    if (Math.random() < 0.005) {
      game.screen.bufferedGarbage = 30;
    }
    needsRedraw = true;
  }
});

function drawCursor() {
  for (let i = 0; i < 18; ++i) {
    stdout.write(UP);
  }
  stdout.write(RIGHT);
  for (let i = 0; i < x; ++i) {
    stdout.write(RIGHT + RIGHT);
  }
  writePrimary();
  writeSecondary();
}

while (true) {
  const tickResult = game.tick();
  if (tickResult.busy) {
    drawScreen();
    busy = true;
  } else if (busy) {
    drawScreen();
    drawCursor();
    busy = false;
  }

  if (needsRedraw) {
    drawScreen();
    drawCursor();
  }
  await sleep(60);
}
