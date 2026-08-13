"use strict";

const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const cells = [...document.querySelectorAll(".cell")];
const scoreXElement = document.querySelector("#score-x");
const scoreOElement = document.querySelector("#score-o");
const playerXCard = document.querySelector("#player-x-card");
const playerOCard = document.querySelector("#player-o-card");
const playerOName = document.querySelector("#player-o-name");
const gameStatus = document.querySelector("#game-status");
const statusOrb = document.querySelector(".status-orb");
const roundMessage = document.querySelector("#round-message");
const playAgainButton = document.querySelector("#play-again");
const resetGameButton = document.querySelector("#reset-game");
const modeInputs = [...document.querySelectorAll('input[name="game-mode"]')];
const soundToggle = document.querySelector("#sound-toggle");
const soundLabel = document.querySelector("#sound-label");
const soundIcon = document.querySelector("#sound-icon");

let board = Array(9).fill("");
let currentPlayer = "X";
let gameActive = true;
let scoreX = 0;
let scoreO = 0;
let gameMode = "pvp";
let isComputerThinking = false;
let winningCells = [];
let roundResult = "";
let computerMoveTimer;
let soundEnabled = true;
let audioContext;

// --- Event bindings -------------------------------------------------------
cells.forEach((cell) => cell.addEventListener("click", handleCellClick));
playAgainButton.addEventListener("click", restartRound);
resetGameButton.addEventListener("click", resetGame);
soundToggle.addEventListener("click", toggleSound);

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    gameMode = input.value;
    restartRound();
    roundMessage.textContent = gameMode === "cpu"
      ? "You are X. The computer plays O."
      : "Two players, one board. X starts.";
  });
});

updateGameUI();

// --- Core game flow -------------------------------------------------------
function handleCellClick(event) {
  const cell = event.currentTarget;
  const cellIndex = Number(cell.dataset.index);

  if (
    !gameActive ||
    board[cellIndex] !== "" ||
    (gameMode === "cpu" && currentPlayer === "O")
  ) {
    return;
  }

  placeMark(cellIndex, currentPlayer);
}

function placeMark(cellIndex, player) {
  board[cellIndex] = player;
  playSound("move");
  updateBoard(cellIndex);

  const winner = checkWinner(player);
  if (winner) {
    endGame("win", player, winner);
    return;
  }

  if (checkDraw()) {
    endGame("draw");
    return;
  }

  switchPlayer();

  if (gameMode === "cpu" && currentPlayer === "O") {
    scheduleComputerMove();
  }
}

function checkWinner(player = currentPlayer) {
  return winningConditions.find((condition) =>
    condition.every((cellIndex) => board[cellIndex] === player)
  );
}

function checkDraw() {
  return board.every((cell) => cell !== "");
}

function switchPlayer() {
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  updateGameUI();
}

function endGame(type, winner = null, winningLine = []) {
  gameActive = false;
  isComputerThinking = false;
  winningCells = winningLine;

  if (type === "win") {
    if (winner === "X") scoreX += 1;
    if (winner === "O") scoreO += 1;

    const winnerName = getPlayerName(winner);
    roundResult = `🎉 ${winnerName} wins!`;
    roundMessage.textContent = winner === "X"
      ? "A brilliant line of three for X."
      : "A brilliant line of three for O.";
    playSound("win");
  } else {
    roundResult = "🤝 It’s a draw!";
    roundMessage.textContent = "Every square is filled. Start a fresh round?";
    playSound("draw");
  }

  updateGameUI();
}

function restartRound() {
  clearTimeout(computerMoveTimer);
  board = Array(9).fill("");
  currentPlayer = "X";
  gameActive = true;
  isComputerThinking = false;
  winningCells = [];
  roundResult = "";
  roundMessage.textContent = "";
  updateGameUI();
  cells[0].focus();
}

function resetGame() {
  const shouldReset = window.confirm("Are you sure you want to reset the entire game and both scores?");
  if (!shouldReset) return;

  scoreX = 0;
  scoreO = 0;
  restartRound();
}

// --- UI updates -----------------------------------------------------------
function updateGameUI() {
  updateBoard();
  updateScore();
  updatePlayerCards();
  updateTurnMessage();
}

function updateBoard(newMarkIndex = null) {
  const computerTurn = gameMode === "cpu" && currentPlayer === "O" && gameActive;

  cells.forEach((cell, index) => {
    const mark = board[index];
    cell.textContent = mark;
    cell.classList.toggle("x", mark === "X");
    cell.classList.toggle("o", mark === "O");
    cell.classList.toggle("winning", winningCells.includes(index));
    cell.disabled = !gameActive || mark !== "" || computerTurn;
    cell.setAttribute("aria-label", `Cell ${index + 1}, ${mark || "empty"}`);

    if (index === newMarkIndex) {
      cell.classList.remove("just-played");
      // Restarting the animation lets every newly placed mark feel responsive.
      void cell.offsetWidth;
      cell.classList.add("just-played");
    }
  });
}

function updateScore() {
  scoreXElement.textContent = scoreX;
  scoreOElement.textContent = scoreO;
}

function updatePlayerCards() {
  const xTurn = gameActive && currentPlayer === "X";
  const oTurn = gameActive && currentPlayer === "O";
  playerXCard.classList.toggle("active", xTurn);
  playerOCard.classList.toggle("active", oTurn);
  playerOName.textContent = gameMode === "cpu" ? "Computer O" : "Player O";
}

function updateTurnMessage() {
  if (!gameActive) {
    gameStatus.textContent = roundResult;
    statusOrb.className = "status-orb finished";
    return;
  }

  const computerTurn = gameMode === "cpu" && currentPlayer === "O";
  gameStatus.textContent = computerTurn ? "Computer is thinking…" : `${getPlayerName(currentPlayer)}'s turn`;
  statusOrb.className = `status-orb ${currentPlayer === "O" ? "o-turn" : ""}`;
}

function getPlayerName(player) {
  if (player === "O" && gameMode === "cpu") return "Computer O";
  return `Player ${player}`;
}

// --- Simple computer opponent --------------------------------------------
function scheduleComputerMove() {
  isComputerThinking = true;
  updateGameUI();

  computerMoveTimer = window.setTimeout(() => {
    if (!gameActive || gameMode !== "cpu" || currentPlayer !== "O") return;

    const selectedCell = chooseComputerMove();
    isComputerThinking = false;
    if (selectedCell !== undefined) placeMark(selectedCell, "O");
  }, 520);
}

function chooseComputerMove() {
  const availableCells = getAvailableCells();

  // First win, then block X, then favour the strategic positions.
  return (
    findCriticalMove("O") ??
    findCriticalMove("X") ??
    (board[4] === "" ? 4 : undefined) ??
    chooseRandom(availableCells.filter((index) => [0, 2, 6, 8].includes(index))) ??
    chooseRandom(availableCells)
  );
}

function findCriticalMove(player) {
  return getAvailableCells().find((index) => {
    board[index] = player;
    const wouldWin = Boolean(checkWinner(player));
    board[index] = "";
    return wouldWin;
  });
}

function getAvailableCells() {
  return board
    .map((cell, index) => (cell === "" ? index : null))
    .filter((index) => index !== null);
}

function chooseRandom(items) {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

// --- Optional generated sound feedback -----------------------------------
function toggleSound() {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundLabel.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundIcon.textContent = soundEnabled ? "♪" : "×";
  if (soundEnabled) playSound("move");
}

function playSound(type) {
  if (!soundEnabled || !(window.AudioContext || window.webkitAudioContext)) return;

  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();

  const tones = {
    move: [[currentPlayer === "X" ? 440 : 330, 0, 0.06]],
    win: [[523, 0, 0.1], [659, 0.11, 0.1], [784, 0.22, 0.18]],
    draw: [[300, 0, 0.12], [245, 0.14, 0.18]]
  };

  tones[type].forEach(([frequency, delay, duration]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startTime = audioContext.currentTime + delay;

    oscillator.type = type === "draw" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.055, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  });
}
