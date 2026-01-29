const GRID_WIDTH = 80;
const GRID_HEIGHT = 60;
const STEP_DELAY_MS = 450;

const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");
const inputsContainer = document.getElementById("typeInputs");
const legend = document.getElementById("legend");
const logContainer = document.getElementById("log");
const generateButton = document.getElementById("generateButton");
const statusLabel = document.getElementById("status");

let roomTypes = [];
let roomPool = [];
let grid = [];
let roomTypeLookup = new Map();

const offset = {
  x: Math.floor(GRID_WIDTH / 2),
  y: Math.floor(GRID_HEIGHT / 2)
};

const doorColor = "#f59e0b";
const wallColor = "#4b5563";

const {
  getDoorPosition,
  computeOriginFromDoor,
  canPlaceRoom,
  placeRoom,
  bakeWalls
} = window.HouseBuilderCore;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toGridCoords = (worldX, worldY) => ({
  x: worldX + offset.x,
  y: worldY + offset.y
});

const isInside = (worldX, worldY) => {
  const { x, y } = toGridCoords(worldX, worldY);
  return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
};

const getCell = (worldX, worldY) => {
  if (!isInside(worldX, worldY)) {
    return null;
  }
  const { x, y } = toGridCoords(worldX, worldY);
  return grid[y][x];
};

const setCell = (worldX, worldY, cellData) => {
  if (!isInside(worldX, worldY)) {
    return;
  }
  const { x, y } = toGridCoords(worldX, worldY);
  grid[y][x] = cellData;
};

const resetGrid = () => {
  grid = Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => ({ type: "empty", color: "#ffffff" }))
  );
  drawGrid();
};

const drawGrid = () => {
  const cellSize = Math.floor(
    Math.min(canvas.width / GRID_WIDTH, canvas.height / GRID_HEIGHT)
  );

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const cell = grid[y][x];
      if (cell.type !== "empty") {
        ctx.fillStyle = cell.color;
        ctx.fillRect(x * cellSize, (GRID_HEIGHT - 1 - y) * cellSize, cellSize, cellSize);
      }
    }
  }

  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= GRID_WIDTH; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, GRID_HEIGHT * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_HEIGHT; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(GRID_WIDTH * cellSize, y * cellSize);
    ctx.stroke();
  }
};

const logMessage = (message, prefix = "") => {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `${prefix ? `<strong>${prefix}</strong> ` : ""}${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
};

const clearLog = () => {
  logContainer.innerHTML = "";
};

const createLegend = () => {
  legend.innerHTML = "";
  roomTypes.forEach((type) => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = type.color;

    const label = document.createElement("span");
    label.textContent = type.typeID;

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });

  const wall = document.createElement("div");
  wall.className = "legend-item";
  wall.innerHTML = `<span class="legend-swatch" style="background:${wallColor}"></span>Wall`;
  legend.appendChild(wall);

  const door = document.createElement("div");
  door.className = "legend-item";
  door.innerHTML = `<span class="legend-swatch" style="background:${doorColor}"></span>Door`;
  legend.appendChild(door);
};

const createInputs = () => {
  inputsContainer.innerHTML = "";
  roomTypes.forEach((type) => {
    const card = document.createElement("div");
    card.className = "input-card";
    card.dataset.typeId = type.typeID;

    const title = document.createElement("h3");
    title.textContent = type.typeID;

    const minRow = document.createElement("div");
    minRow.className = "input-row";
    const minLabel = document.createElement("label");
    minLabel.textContent = "Min";
    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.min = "0";
    minInput.value = "1";

    const maxRow = document.createElement("div");
    maxRow.className = "input-row";
    const maxLabel = document.createElement("label");
    maxLabel.textContent = "Max";
    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.min = "0";
    maxInput.value = "2";

    minRow.appendChild(minLabel);
    minRow.appendChild(minInput);

    maxRow.appendChild(maxLabel);
    maxRow.appendChild(maxInput);

    card.appendChild(title);
    card.appendChild(minRow);
    card.appendChild(maxRow);
    inputsContainer.appendChild(card);
  });
};

const getCountsFromInputs = () => {
  const counts = {};
  document.querySelectorAll(".input-card").forEach((card) => {
    const typeId = card.dataset.typeId;
    const inputs = card.querySelectorAll("input");
    const min = Number(inputs[0].value);
    const max = Number(inputs[1].value);
    counts[typeId] = { min, max };
  });
  return counts;
};

const validateFeasibility = (counts) => {
  logMessage("Validating room types and neighbor rules...", "Step 1");
  let valid = true;

  roomTypes.forEach((type) => {
    if (!Array.isArray(type.allowedNeighborTypeIDs)) {
      valid = false;
      logMessage(`${type.typeID} has no neighbor definitions.`, "Error");
    }
  });

  Object.entries(counts).forEach(([typeId, range]) => {
    if (range.min > range.max) {
      valid = false;
      logMessage(`${typeId} has min > max.`, "Error");
    }
  });

  if (valid) {
    logMessage("Feasibility check passed.", "OK");
  }

  return valid;
};

const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

const selectRooms = (counts) => {
  logMessage("Selecting concrete room prefabs...", "Step 2");
  const selections = [];
  let idCounter = 1;

  roomTypes.forEach((type) => {
    const range = counts[type.typeID];
    const count = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
    const pool = roomPool.filter((room) => room.typeID === type.typeID);

    for (let i = 0; i < count; i += 1) {
      const prefab = randomFromArray(pool);
      selections.push({
        id: `${type.typeID}-${idCounter}`,
        typeID: type.typeID,
        width: prefab.width,
        height: prefab.height,
        doorSockets: prefab.doorSockets,
        color: type.color
      });
      idCounter += 1;
    }
  });

  logMessage(`Selected ${selections.length} room prefabs.`, "OK");
  return selections;
};

const buildConnectionPlan = (rooms) => {
  logMessage("Building connection plan (socket-aware)...", "Step 3");
  const plan = [];
  const placed = [rooms[0]];

  for (let i = 1; i < rooms.length; i += 1) {
    const target = rooms[i];
    const candidate = placed.find((room) =>
      roomTypeLookup.get(room.typeID).allowedNeighborTypeIDs.includes(target.typeID)
    );

    if (candidate) {
      plan.push({ sourceId: candidate.id, targetId: target.id });
      placed.push(target);
    }
  }

  logMessage(`Prepared ${plan.length} planned connections.`, "OK");
  return plan;
};

const canPlaceRoomOnGrid = (room, origin, doorPosition) =>
  canPlaceRoom(room, origin, doorPosition, isInside, getCell);

const placeRoomOnGrid = (room, origin, doorPosition) =>
  placeRoom(room, origin, doorPosition, setCell, doorColor);

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getOppositeEdge = (edge) => {
  switch (edge) {
    case "N":
      return "S";
    case "S":
      return "N";
    case "E":
      return "W";
    case "W":
      return "E";
    default:
      return null;
  }
};

const MAX_GENERATION_ATTEMPTS = 10;

const findPlacementForRoom = (room, placedRooms) => {
  const candidates = Array.from(placedRooms.values());
  const shuffled = shuffle(candidates);

  for (const placed of shuffled) {
    const allowedNeighbors = roomTypeLookup.get(placed.room.typeID).allowedNeighborTypeIDs;
    const allowedReverse = roomTypeLookup.get(room.typeID).allowedNeighborTypeIDs;
    if (!allowedNeighbors.includes(room.typeID) || !allowedReverse.includes(placed.room.typeID)) {
      continue;
    }

    const sourceSockets = shuffle(placed.room.doorSockets.map((socket, index) => ({ socket, index })));
    const targetSockets = shuffle(room.doorSockets.map((socket, index) => ({ socket, index })));

    for (const source of sourceSockets) {
      if (placed.usedSockets.has(source.index)) {
        continue;
      }
      const sourceDoor = getDoorPosition(placed.room, placed.origin, source.socket);
      const requiredEdge = getOppositeEdge(source.socket.edge);

      for (const target of targetSockets) {
        if (requiredEdge && target.socket.edge !== requiredEdge) {
          continue;
        }
        if (placedRooms.get(room.id)?.usedSockets?.has(target.index)) {
          continue;
        }
        const targetOrigin = computeOriginFromDoor(room, target.socket, sourceDoor);
        if (canPlaceRoomOnGrid(room, targetOrigin, sourceDoor)) {
          return {
            sourceId: placed.room.id,
            sourceSocketIndex: source.index,
            targetSocketIndex: target.index,
            origin: targetOrigin,
            door: sourceDoor
          };
        }
      }
    }
  }

  return null;
};

const attemptRoomPlacement = async (rooms, attempt) => {
  resetGrid();
  const placedRooms = new Map();
  const unplacedRooms = shuffle(rooms);

  const root = unplacedRooms.shift();
  const rootOrigin = { x: 0, y: 0 };
  if (!canPlaceRoomOnGrid(root, rootOrigin, null)) {
    logMessage(`Attempt ${attempt}: root room does not fit inside grid.`, "Warning");
    return { success: false };
  }

  placedRooms.set(root.id, {
    room: root,
    origin: rootOrigin,
    usedSockets: new Set()
  });
  placeRoomOnGrid(root, rootOrigin, null);
  drawGrid();
  logMessage(`Attempt ${attempt}: placed root room ${root.id} at (0,0).`, "OK");
  await sleep(STEP_DELAY_MS);

  while (unplacedRooms.length > 0) {
    let progress = false;
    const shuffledRemaining = shuffle(unplacedRooms);

    for (const room of shuffledRemaining) {
      const placement = findPlacementForRoom(room, placedRooms);

      if (placement) {
        const source = placedRooms.get(placement.sourceId);
        source.usedSockets.add(placement.sourceSocketIndex);
        placedRooms.set(room.id, {
          room,
          origin: placement.origin,
          usedSockets: new Set([placement.targetSocketIndex])
        });
        placeRoomOnGrid(room, placement.origin, placement.door);
        drawGrid();
        logMessage(
          `Connected ${room.id} to ${placement.sourceId} using sockets ${placement.sourceSocketIndex}→${placement.targetSocketIndex}.`,
          "OK"
        );
        await sleep(STEP_DELAY_MS);
        const roomIndex = unplacedRooms.findIndex((entry) => entry.id === room.id);
        if (roomIndex !== -1) {
          unplacedRooms.splice(roomIndex, 1);
        }
        progress = true;
      }
    }

    if (!progress) {
      logMessage(`Attempt ${attempt}: no valid placements this pass.`, "Warning");
      return { success: false };
    }
  }

  return { success: true, placedRooms };
};

const generateHouse = async () => {
  generateButton.disabled = true;
  statusLabel.textContent = "Generating...";
  clearLog();
  resetGrid();

  const counts = getCountsFromInputs();
  if (!validateFeasibility(counts)) {
    statusLabel.textContent = "Validation failed";
    generateButton.disabled = false;
    return;
  }

  await sleep(STEP_DELAY_MS);

  const rooms = selectRooms(counts);
  if (rooms.length === 0) {
    logMessage("No rooms selected. Adjust minimum counts.", "Error");
    statusLabel.textContent = "Idle";
    generateButton.disabled = false;
    return;
  }

  await sleep(STEP_DELAY_MS);
  buildConnectionPlan(rooms);
  await sleep(STEP_DELAY_MS);

  logMessage("Placing rooms incrementally...", "Step 4");

  let finalPlacedRooms = null;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    logMessage(`Generation attempt ${attempt} of ${MAX_GENERATION_ATTEMPTS}.`, "Step 4");
    const result = await attemptRoomPlacement(rooms, attempt);
    if (result.success) {
      finalPlacedRooms = result.placedRooms;
      break;
    }
    await sleep(STEP_DELAY_MS);
  }

  if (!finalPlacedRooms) {
    logMessage("No valid layout found after all attempts.", "Error");
    statusLabel.textContent = "Failed";
    generateButton.disabled = false;
    return;
  }

  bakeWalls(
    Array.from(finalPlacedRooms.values()).map((entry) => ({
      room: entry.room,
      origin: entry.origin
    })),
    isInside,
    getCell,
    setCell,
    wallColor
  );
  drawGrid();

  logMessage("Generation complete. All rooms connected.", "Step 5");
  statusLabel.textContent = "Complete";

  generateButton.disabled = false;
};

const init = async () => {
  const [roomTypesResponse, roomPoolResponse] = await Promise.all([
    fetch("RoomTypes.json"),
    fetch("RoomPool.json")
  ]);

  const roomTypesJson = await roomTypesResponse.json();
  const roomPoolJson = await roomPoolResponse.json();

  roomTypes = roomTypesJson.roomTypes;
  roomPool = roomPoolJson.rooms;
  roomTypeLookup = new Map(roomTypes.map((type) => [type.typeID, type]));

  createLegend();
  createInputs();
  resetGrid();

  generateButton.addEventListener("click", generateHouse);
};

init();
