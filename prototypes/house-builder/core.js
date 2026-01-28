(() => {
  const getDoorPosition = (room, origin, socket) => {
    switch (socket.edge) {
      case "N":
        return { x: origin.x + socket.offset, y: origin.y + room.height };
      case "S":
        return { x: origin.x + socket.offset, y: origin.y - 1 };
      case "E":
        return { x: origin.x + room.width, y: origin.y + socket.offset };
      case "W":
        return { x: origin.x - 1, y: origin.y + socket.offset };
      default:
        return { x: origin.x, y: origin.y };
    }
  };

  const computeOriginFromDoor = (room, socket, doorPosition) => {
    switch (socket.edge) {
      case "N":
        return { x: doorPosition.x - socket.offset, y: doorPosition.y - room.height };
      case "S":
        return { x: doorPosition.x - socket.offset, y: doorPosition.y + 1 };
      case "E":
        return { x: doorPosition.x - room.width, y: doorPosition.y - socket.offset };
      case "W":
        return { x: doorPosition.x + 1, y: doorPosition.y - socket.offset };
      default:
        return { x: doorPosition.x, y: doorPosition.y };
    }
  };

  const getInteriorCells = (room, origin) => {
    const interior = [];
    for (let x = origin.x; x < origin.x + room.width; x += 1) {
      for (let y = origin.y; y < origin.y + room.height; y += 1) {
        interior.push({ x, y });
      }
    }
    return interior;
  };

  const canPlaceRoom = (room, origin, doorPosition, isInside, getCell) => {
    const interior = getInteriorCells(room, origin);
    const minX = origin.x - 1;
    const maxX = origin.x + room.width;
    const minY = origin.y - 1;
    const maxY = origin.y + room.height;

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (!isInside(x, y)) {
          continue;
        }
        const existing = getCell(x, y);
        if (existing && existing.type === "interior") {
          return false;
        }
      }
    }

    for (const cell of interior) {
      if (!isInside(cell.x, cell.y)) {
        return false;
      }
      const existing = getCell(cell.x, cell.y);
      if (existing && existing.type !== "empty") {
        return false;
      }
    }

    if (doorPosition) {
      if (!isInside(doorPosition.x, doorPosition.y)) {
        return false;
      }
      const doorCell = getCell(doorPosition.x, doorPosition.y);
      if (doorCell && doorCell.type === "interior") {
        return false;
      }
    }

    return true;
  };

  const placeRoom = (room, origin, doorPosition, setCell, doorColor) => {
    const interior = getInteriorCells(room, origin);

    interior.forEach((cell) => {
      setCell(cell.x, cell.y, { type: "interior", color: room.color });
    });

    if (doorPosition) {
      setCell(doorPosition.x, doorPosition.y, { type: "door", color: doorColor });
    }
  };

  const bakeWalls = (placedRooms, isInside, getCell, setCell, wallColor) => {
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    placedRooms.forEach(({ room, origin }) => {
      const interior = getInteriorCells(room, origin);
      interior.forEach((cell) => {
        directions.forEach((dir) => {
          const neighborX = cell.x + dir.x;
          const neighborY = cell.y + dir.y;
          if (!isInside(neighborX, neighborY)) {
            return;
          }
          const existing = getCell(neighborX, neighborY);
          if (!existing || existing.type === "empty") {
            setCell(neighborX, neighborY, { type: "wall", color: wallColor });
          }
        });
      });
    });
  };

  const api = {
    getDoorPosition,
    computeOriginFromDoor,
    canPlaceRoom,
    placeRoom,
    bakeWalls
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (typeof window !== "undefined") {
    window.HouseBuilderCore = api;
  }
})();
