import {sleep} from 'bun';
import {WIDTH} from './bitboard';
import {GARBAGE, GREEN, PuyoScreen, RED, colorOf} from './screen';
import {stdin, stdout} from 'process';

// TODO: Target the browser, no bun dependencies.

console.log(
  'Welcome to \x1b[3mPujo Puyo\x1b[0m, powered by \x1b[4mBun\x1b[0m!'
);

const UP = '\u001b[A';
const DOWN = '\u001b[B';
const RIGHT = '\u001b[C';
const LEFT = '\u001b[D';

stdin.setRawMode(true);
stdin.resume();

stdin.setEncoding('utf8');

const screen = new PuyoScreen();
let score = 0;
let busy = false;
let needsRedraw = false;
let pendingGarbage = 0;

// Line the bottom with garbage to debug clearing.
if (process.argv.length >= 3) {
  screen.grid[GARBAGE][2] = 1056964608;
}

function drawScreen(initial = false) {
  if (!initial) {
    if (!busy) {
      stdout.write('\r');
      for (let i = 0; i < 3; ++i) {
        stdout.write(UP);
      }
    } else {
      for (let i = 0; i < 19; ++i) {
        stdout.write(UP);
      }
    }
  }
  const lines = screen.displayLines();
  // Insert an extra line to make space for the cursor.
  lines.splice(1, 0, '║            ║');
  lines.forEach(line => console.log(line));
  stdout.write(`Score: ${score}\r`);
  needsRedraw = false;
}

drawScreen(true);

for (let i = 0; i < 18; ++i) {
  stdout.write(UP);
}
stdout.write(RIGHT + RIGHT + RIGHT + RIGHT + RIGHT);
stdout.write(colorOf(RED) + '●' + LEFT + DOWN + colorOf(GREEN) + '●' + LEFT);

let color1 = GREEN;
let color2 = RED;
let x = 2;
let rot = 0;

function clearPrimary() {
  stdout.write(' ' + LEFT);
}

function writePrimary() {
  stdout.write(colorOf(color1) + '●' + LEFT);
}

function clearSecondary() {
  if (rot === 0) {
    stdout.write(UP + ' ' + LEFT + DOWN);
  }
  if (rot === 1) {
    stdout.write(LEFT + LEFT + ' ' + RIGHT);
  }
  if (rot === 2) {
    stdout.write(DOWN + ' ' + LEFT + UP);
  }
  if (rot === 3) {
    stdout.write(RIGHT + RIGHT + ' ' + LEFT + LEFT + LEFT);
  }
}

function writeSecondary() {
  if (rot === 0) {
    stdout.write(UP + colorOf(color2) + '●' + LEFT + DOWN);
  }
  if (rot === 1) {
    stdout.write(LEFT + LEFT + colorOf(color2) + '●' + RIGHT);
  }
  if (rot === 2) {
    stdout.write(DOWN + colorOf(color2) + '●' + LEFT + UP);
  }
  if (rot === 3) {
    stdout.write(RIGHT + RIGHT + colorOf(color2) + '●' + LEFT + LEFT + LEFT);
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
    rot = (rot + 1) % 4;
    if (rot === 1 && x === 0) {
      clearPrimary();
      x++;
      stdout.write(RIGHT + RIGHT);
      writePrimary();
    }
    if (rot === 3 && x === WIDTH - 1) {
      clearPrimary();
      x--;
      stdout.write(LEFT + LEFT);
      writePrimary();
    }
    writeSecondary();
  }
  if (key === LEFT && x > 0 && (x > 1 || rot !== 1)) {
    clearPrimary();
    clearSecondary();
    x--;
    stdout.write(LEFT + LEFT);
    writePrimary();
    writeSecondary();
  }
  if (key === RIGHT && x < WIDTH - 1 && (x < WIDTH - 2 || rot !== 3)) {
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
    // Potentially inserts at the ghost line.
    // The top line is reserved for garbage generation.
    if (rot === 2) {
      screen.insertPuyo(x, 1, color1);
    } else {
      screen.insertPuyo(x, 2, color1);
    }
    if (rot === 0) {
      screen.insertPuyo(x, 1, color2);
    }
    if (rot === 1) {
      screen.insertPuyo(x - 1, 2, color2);
    }
    if (rot === 2) {
      screen.insertPuyo(x, 2, color2);
    }
    if (rot === 3) {
      screen.insertPuyo(x + 1, 2, color2);
    }
    color1 = Math.floor(Math.random() * 4);
    color2 = Math.floor(Math.random() * 4);
    if (Math.random() < 0.1) {
      pendingGarbage = Math.floor(Math.random() * 3 + 1);
    }
    if (Math.random() < 0.01) {
      pendingGarbage = 30;
    }
    needsRedraw = true;
  }
});

function drawCursor() {
  for (let i = 0; i < 17; ++i) {
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
  const tickResult = screen.tick(pendingGarbage);
  pendingGarbage = 0;
  score += tickResult.score;
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
