import {ServerWebSocket} from 'bun';
import {
  HEIGHT,
  MultiplayerGame,
  WIDTH,
  randomColorSelection,
  randomSeed,
} from '../src';

let LOG = false;

if (process.argv.length >= 3) {
  LOG = true;
}

const NOMINAL_FRAME_RATE = 30;
// Terminate games that last longer than 10 virtual minutes.
const MAX_GAME_AGE = NOMINAL_FRAME_RATE * 60 * 10;

type Move = {
  type: 'move';
  player: number;
  x1: number;
  y1: number;
  orientation: number;
  hardDrop: boolean;
};

function sanitizeMove(player: number, content: any): Move {
  return {
    type: 'move',
    player,
    x1: Math.max(0, Math.min(WIDTH - 1, parseInt(content.x1, 10))),
    y1: Math.max(1, Math.min(HEIGHT - 1, parseInt(content.y1, 10))),
    orientation: parseInt(content.orientation, 10) & 3,
    hardDrop: !!content.hardDrop,
  };
}

class Player {
  socket: ServerWebSocket<{authToken: string}>;

  constructor(socket: ServerWebSocket<{authToken: string}>) {
    this.socket = socket;
  }

  send(message: any) {
    this.socket.send(JSON.stringify(message));
  }
}

class WebSocketGameSession {
  age: number;
  gameSeed: number;
  screenSeed: number;
  colorSelection: number[];
  game: MultiplayerGame;
  players: Player[];
  waitingForMove: boolean[];
  done: boolean;
  hiddenMove: Move | null;

  constructor(player: Player) {
    this.age = 0;
    this.gameSeed = randomSeed();
    this.screenSeed = randomSeed();
    this.colorSelection = randomColorSelection();
    this.game = new MultiplayerGame(
      this.gameSeed,
      this.colorSelection,
      this.screenSeed
    );
    this.players = [player];
    // TODO: True multiplayer
    this.waitingForMove = [false, false];
    this.done = false;
    this.hiddenMove = null;
  }

  start() {
    this.players.forEach((player, i) => {
      player.send({
        type: 'identity',
        player: i,
      });
      player.send({
        type: 'game params',
        colorSelection: this.colorSelection,
        screenSeed: this.screenSeed,
      });
      for (let j = 0; j < this.game.games.length; ++j) {
        player.send({
          type: 'bag',
          player: j,
          bag: this.game.games[j].visibleBag,
        });
      }
      this.waitingForMove[i] = true;
    });
    if (LOG) {
      this.game.log();
      console.log('Starting game');
    }
  }

  complete() {
    if (this.done) {
      return;
    }
    this.done = true;
    this.players.forEach(player => sessionByPlayer.delete(player));
  }

  disconnect(player: Player) {
    if (this.done) {
      return;
    }
    this.players.forEach(opponent => {
      if (opponent !== player) {
        opponent.send({
          type: 'game result',
          result: 'win',
          reason: 'opponent disconnected',
        });
      }
    });
    this.complete();
  }

  message(player: Player, content: any) {
    if (this.done) {
      return;
    }
    const index = this.players.indexOf(player);

    if (content.type === 'simple state request') {
      player.send({
        type: 'simple state',
        state: this.game.toSimpleGame(index),
      });
    } else if (content.type === 'move') {
      if (!this.waitingForMove[index]) {
        return;
      }
      const move = sanitizeMove(index, content);
      this.game.play(
        move.player,
        move.x1,
        move.y1,
        move.orientation,
        move.hardDrop
      );
      // Hide the first of simultaneous moves
      if (this.waitingForMove.every(w => w)) {
        if (LOG) {
          console.log('Hiding move by', move.player);
        }
        this.players[move.player].send(move);
        this.hiddenMove = move;
      } else if (this.hiddenMove !== null) {
        if (LOG) {
          console.log('Revealing move by', this.hiddenMove.player);
        }
        this.players[1 - this.hiddenMove.player].send(this.hiddenMove);
        this.hiddenMove = null;
        this.players.forEach(p => p.send(move));
      } else {
        this.players.forEach(p => p.send(move));
      }
      this.waitingForMove[index] = false;

      while (this.game.games.every(game => game.busy)) {
        const tickResults = this.game.tick();
        this.age++;

        if (tickResults[0].lockedOut && tickResults[1].lockedOut) {
          this.players.forEach(p =>
            p.send({
              type: 'game result',
              result: 'draw',
              reason: 'double lockout',
            })
          );
          this.complete();
        } else if (tickResults[0].lockedOut || tickResults[1].lockedOut) {
          const winner = tickResults[0].lockedOut ? 1 : 0;
          const loser = 1 - winner;
          this.players[winner].send({
            type: 'game result',
            result: 'win',
            reason: 'opponent lockout',
          });
          this.players[loser].send({
            type: 'game result',
            result: 'loss',
            reason: 'lockout',
          });
          this.complete();
        } else if (this.age > MAX_GAME_AGE) {
          this.players.forEach(p =>
            p.send({
              type: 'game result',
              result: 'draw',
              reason: 'time limit exceeded',
            })
          );
          this.complete();
        }
      }

      if (this.done) {
        return;
      }

      for (let i = 0; i < this.players.length; ++i) {
        if (!this.game.games[i].busy && !this.waitingForMove[i]) {
          this.players.forEach(p =>
            p.send({
              type: 'bag',
              player: i,
              bag: this.game.games[i].visibleBag,
            })
          );
          if (LOG) {
            this.game.log();
            console.log('Sent bag of', i, this.game.games[i].visibleBag);
          }
          this.waitingForMove[i] = true;
        }
      }
    }
  }
}

const playerBySocket: Map<
  ServerWebSocket<{authToken: string}>,
  Player
> = new Map();
const sessionByPlayer: Map<Player, WebSocketGameSession> = new Map();

const server = Bun.serve<{authToken: string}>({
  fetch(req, server) {
    const success = server.upgrade(req);
    if (success) {
      // Bun automatically returns a 101 Switching Protocols
      // if the upgrade succeeds
      return undefined;
    }

    // handle HTTP request normally
    return new Response(
      'This is a WebSocket server for Pujo Puyo. Please use a compatible client.'
    );
  },
  websocket: {
    async open(ws) {
      console.log('New connection opened.');
      playerBySocket.set(ws, new Player(ws));
    },
    async close(ws, code, reason) {
      console.log('Connection closed.', code, reason);

      const player = playerBySocket.get(ws)!;
      playerBySocket.delete(ws);
      const session = sessionByPlayer.get(player);
      if (session !== undefined) {
        session.disconnect(player);
      }
    },
    // this is called when a message is received
    async message(ws, message) {
      console.log(`Received ${message}`);

      let content;
      if (message instanceof Buffer) {
        content = message.toJSON();
      } else {
        content = JSON.parse(message);
      }

      const player = playerBySocket.get(ws)!;

      if (content.type === 'game request') {
        // TODO: Keep an array of open games.
        for (const session of sessionByPlayer.values()) {
          if (session.players.length < 2) {
            session.players.push(player);
            sessionByPlayer.set(player, session);
            session.start();
            return;
          }
        }
        sessionByPlayer.set(player, new WebSocketGameSession(player));
        return;
      }

      const session = sessionByPlayer.get(player);
      if (session !== undefined) {
        session.message(player, content);
      }
    },
  },
  port: 3003,
});

console.log(`Listening on ${server.hostname}:${server.port}`);
