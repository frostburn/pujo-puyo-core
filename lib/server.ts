import {ServerWebSocket} from 'bun';
import {MultiplayerGame} from '../src';

const LOG_GAMES = false;

const NOMINAL_FRAME_RATE = 30;
// Terminate games that last longer than 10 virtual minutes.
const MAX_GAME_AGE = NOMINAL_FRAME_RATE * 60 * 10;

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
  game: MultiplayerGame;
  players: Player[];
  waitingForMove: boolean[];
  done: boolean;

  constructor(player: Player) {
    this.age = 0;
    this.game = new MultiplayerGame();
    this.players = [player];
    // TODO: True multiplayer
    this.waitingForMove = [false, false];
    this.done = false;
  }

  start() {
    this.players.forEach((player, i) => {
      if (LOG_GAMES) {
        this.game.log();
        console.log(`Requesting move from ${i}`);
      }
      player.send({
        type: 'move request',
        bag: this.game.games[i].visibleBag,
      });
      this.waitingForMove[i] = true;
    });
  }

  complete() {
    if (this.done) {
      return;
    }
    this.done = true;
    this.players.forEach(player => {
      sessionByPlayer.delete(player);
    });
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
      this.game.play(
        index,
        content.x1,
        content.y1,
        content.orientation,
        content.kickDown
      );
      this.waitingForMove[index] = false;

      while (this.game.games.every(game => game.busy)) {
        const tickResults = this.game.tick();
        this.age++;

        if (tickResults[0].lockedOut && tickResults[1].lockedOut) {
          this.players.forEach(player => {
            player.send({
              type: 'game result',
              result: 'draw',
              reason: 'double lockout',
            });
          });
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
          this.players.forEach(player => {
            player.send({
              type: 'game result',
              result: 'draw',
              reason: 'time limit exceeded',
            });
          });
          this.complete();
        }
      }

      if (this.done) {
        return;
      }

      for (let i = 0; i < this.players.length; ++i) {
        if (!this.game.games[i].busy && !this.waitingForMove[i]) {
          if (LOG_GAMES) {
            this.game.log();
            console.log(`Requesting move from ${i}`);
          }
          this.players[i].send({
            type: 'move request',
            bag: this.game.games[i].visibleBag,
          });
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
