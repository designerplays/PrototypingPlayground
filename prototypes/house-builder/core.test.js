const {
  getDoorPosition,
  computeOriginFromDoor,
  canPlaceRoom,
  placeRoom
} = require("./core.js");

const GRID_WIDTH = 40;
const GRID_HEIGHT = 30;
const offset = { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) };

const grid = Array.from({ length: GRID_HEIGHT }, () =>
  Array.from({ length: GRID_WIDTH }, () => ({ type: "empty" }))
);

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

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const room = {
  id: "TestRoom",
  width: 4,
  height: 3,
  color: "#000000",
  doorSockets: [
    { edge: "N", offset: 1 },
    { edge: "S", offset: 1 },
    { edge: "E", offset: 1 },
    { edge: "W", offset: 1 }
  ]
};

const rootOrigin = { x: 0, y: 0 };
assert(
  canPlaceRoom(room, rootOrigin, null, isInside, getCell),
  "Root room should be placeable."
);
placeRoom(room, rootOrigin, null, setCell, "#f59e0b");

const eastDoor = getDoorPosition(room, rootOrigin, room.doorSockets[2]);
const eastOrigin = computeOriginFromDoor(room, room.doorSockets[3], eastDoor);
assert(
  canPlaceRoom(room, eastOrigin, eastDoor, isInside, getCell),
  "East room should be placeable."
);
placeRoom(room, eastOrigin, eastDoor, setCell, "#f59e0b");

const northDoor = getDoorPosition(room, rootOrigin, room.doorSockets[0]);
const northOrigin = computeOriginFromDoor(room, room.doorSockets[1], northDoor);
assert(
  canPlaceRoom(room, northOrigin, northDoor, isInside, getCell),
  "North room should be placeable."
);
placeRoom(room, northOrigin, northDoor, setCell, "#f59e0b");

const interiorCount = grid.flat().filter((cell) => cell.type === "interior").length;
assert(interiorCount === room.width * room.height * 3, "Expected three interiors to be placed.");

console.log("Placement smoke test passed.");
