const token = Cookies.get("token");
if (!token) window.location.replace("/login.html");
anime.suspendWhenDocumentHidden = false;
const DEFAULT_PROFILE_IMAGE =
  "https://www.gravatar.com/avatar/92988b53fc5b9e6136b23a99679bf996.jpg?s=512&d=mp&r=g";

const progress = document.querySelector(".progress-bar > .progress");
const xSide = document.querySelector(".x-side");
const oSide = document.querySelector(".o-side");
const inspectors = document.querySelector(".inspectors");
const masterPanel = document.querySelector(".master-panel");

const socket = io();
let self = {
  email: "",
  name: "",
  imageURL: "",
  answer: "",
};
let playerList = [];
let isGameMaster = false;

socket.on("self", (playerInfo) => {
  self = playerInfo;
});

socket.on("promoteToGameMaster", () => {
  isGameMaster = true;
  masterPanel.classList.add("visible");
});

socket.on("players", (players) => {
  self = players.find((player) => player.email === self.email);
  playerList = players;
  renderPlayers();
});

socket.on("roundStart", (duration) => {
  masterPanel.querySelector(".start").disabled = true;
  masterPanel.querySelector(".reset").disabled = true;
  if (!document.hasFocus()) {
    const startedAt = Date.now();
    const onReFocus = () => {
      window.removeEventListener("focus", onReFocus);
      const elapsedTime = Date.now() - startedAt;
      const remainingTime = duration - elapsedTime;
      if (remainingTime > 0) {
        anime({
          targets: ".progress-bar > .progress",
          width: [`${parseInt((remainingTime / duration) * 100)}%`, 0],
          duration: remainingTime,
          easing: "linear",
        });
      }
    };
    window.addEventListener("focus", onReFocus);
  } else {
    anime({
      targets: ".progress-bar > .progress",
      width: ["100%", 0],
      duration,
      easing: "linear",
    });
  }
});

socket.on("roundFinish", ({ answer, players }) => {
  masterPanel.querySelector(".start").disabled = false;
  masterPanel.querySelector(".reset").disabled = false;

  self = players.find((player) => player.email === self.email);

  playerList = players;
  renderPlayers();

  if (isGameMaster) {
    const remainingPlayers = players
      .filter((player) => player.answer)
      .map(({ email }) => email);
    console.log({ remainingPlayers });
  }
});

socket.on("error", (error) => {
  console.log(error);
  window.location.replace("/login.html");
});

masterPanel.querySelector(".reset").addEventListener("click", (event) => {
  event.preventDefault();
  socket.emit("reset");
});

masterPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(masterPanel);

  socket.emit("newRound", { answer: formData.get("answer") });
});

oSide.addEventListener("click", () => {
  if (self.answer === "X") socket.emit("changeAnswer", "O");
});

xSide.addEventListener("click", () => {
  if (self.answer === "O") socket.emit("changeAnswer", "X");
});

function renderPlayers() {
  oSide.innerHTML = "";
  xSide.innerHTML = "";
  inspectors.innerHTML = "";
  oSide.classList.remove("active");
  xSide.classList.remove("active");
  oSide.classList.remove("disabled");
  xSide.classList.remove("disabled");

  playerList.forEach((playerInfo) => {
    const player = createPlayer(playerInfo);
    const isInspector = !["X", "O"].includes(self.answer);
    if (isInspector) {
      xSide.classList.add("disabled");
      oSide.classList.add("disabled");
    }

    if (playerInfo.answer === "O") {
      oSide.appendChild(player);
      if (playerInfo.email === self.email) oSide.classList.add("active");
    } else if (playerInfo.answer === "X") {
      xSide.appendChild(player);
      if (playerInfo.email === self.email) xSide.classList.add("active");
    } else {
      inspectors.appendChild(player);
    }
  });
}

function createPlayer(playerInfo) {
  const player = document.createElement("div");
  player.classList.add("player");
  if (playerInfo.email === self.email) player.classList.add("self");
  player.ariaLabel = playerInfo.name;
  player.setAttribute("data-balloon-pos", "down");
  player.setAttribute("data-balloon-blunt", "true");

  const image = document.createElement("img");
  image.setAttribute("referrerpolicy", "no-referrer");
  image.src = playerInfo.imageURL || DEFAULT_PROFILE_IMAGE;

  player.appendChild(image);

  return player;
}
