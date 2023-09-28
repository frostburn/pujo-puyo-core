import {
  MOVES,
  SimpleGame,
  flexDropletStrategy2,
  nullStrategy,
  randomStrategy,
} from '../src';

let bot = flexDropletStrategy2;
if (process.argv.length === 3) {
  console.log('Using random strategy');
  bot = randomStrategy;
} else if (process.argv.length === 4) {
  console.log('Using null strategy with confirmation');
  bot = nullStrategy;
}

const socket = new WebSocket('ws://localhost:3003');

let wins = 0;
let draws = 0;
let losses = 0;

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  // console.log('Message received', data);
  if (data.type === 'move request') {
    socket.send(
      JSON.stringify({
        type: 'simple state request',
      })
    );
  } else if (data.type === 'simple state') {
    const game = SimpleGame.fromJSON(data.state);
    if (bot === nullStrategy) {
      prompt('Press enter to play the next move...');
    }
    const strategy = bot(game);
    game.log();
    console.log('Heuristic score:', strategy.score);
    console.log(`Wins / Draws / Losses: ${wins} / ${draws} / ${losses}`);

    const response = JSON.parse(JSON.stringify(MOVES[strategy.move]));
    response.type = 'move';
    socket.send(JSON.stringify(response));
  } else if (data.type === 'game result') {
    if (data.result === 'win') {
      wins++;
    } else if (data.result === 'draw') {
      draws++;
    } else {
      losses++;
    }
    console.log(`Game Over: ${data.result}, ${data.reason}`);
    socket.send(JSON.stringify({type: 'game request'}));
  }
});

socket.addEventListener('open', () => {
  console.log('Connection established.');
  socket.send(JSON.stringify({type: 'game request'}));
});

socket.addEventListener('close', event => {
  console.log('Closing client.', event.code, event.reason);
});
