const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const cookie = require("cookie");
const config = require("./config.json");
const { OAuth2Client } = require("google-auth-library");

const PORT = process.env.PORT || 3000;
const client = new OAuth2Client(config.client_id);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const players = {};
let round = null;

app.use(express.static(__dirname + "/client"));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", async function (socket) {
  try {
    const token = cookie.parse(socket.handshake.headers.cookie).token;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.client_id,
    });
    const payload = ticket.getPayload();

    const alreadyExistingID = Object.keys(players).find(
      (id) => players[id].email === payload.email
    );
    if (alreadyExistingID) delete players[alreadyExistingID];

    players[socket.id] = {
      email: payload.email,
      name: payload.name,
      imageURL: payload.picture,
      answer: Math.random() < 0.5 ? "O" : "X",
    };

    if (config.game_masters.includes(payload.email)) {
      players[socket.id].answer = "";
      socket.emit("promoteToGameMaster");
    }

    socket.emit("self", players[socket.id]);
    io.emit("players", Object.values(players));

    socket.on("changeAnswer", (answer) => {
      const player = players[socket.id];
      const isPlayerIsnpector = player.answer === "";
      if (isPlayerIsnpector) return;

      player.answer = answer;
      io.emit("players", Object.values(players));
    });

    socket.on("newRound", ({ answer }) => {
      const player = players[socket.id];
      if (round || config.game_masters.includes(player.email)) return;
      round = { answer, duration: config.round_duration_sec * 1000 };

      io.emit("roundStart", round.duration);

      setTimeout(() => {
        round = null;
        Object.values(players).forEach((player) => {
          if (player.answer !== answer) player.answer = "";
        });
        io.emit("roundFinish", { answer, players: Object.values(players) });
      }, round.duration);
    });

    socket.on("reset", () => {
      const player = players[socket.id];
      if (config.game_masters.includes(player.email)) {
        Object.values(players).forEach((player) => {
          if (!config.game_masters.includes(player.email))
            player.answer = Math.random() < 0.5 ? "O" : "X";
        });
        io.emit("players", Object.values(players));
      }
    });

    socket.on("disconnect", function () {
      delete players[socket.id];
    });
  } catch (error) {
    socket.emit("error", error.message);
  }
});

server.listen(PORT, function () {
  console.log(`Listening on ${PORT}`);
});
