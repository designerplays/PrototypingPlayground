# Hex Map Explorer

A tile-placement exploration game inspired by Dorf Romantik.

## How to Play

1. **Start**: You begin with a golden "Home Base" hex in the center
2. **Explore**: Click on adjacent hexagons (marked with "?") to explore them
3. **Choose**: When you explore, you'll be presented with 3 random tile options
4. **Place**: Select one tile to place it in that position
5. **Expand**: Continue exploring and placing tiles until you run out
6. **Pan**: Click and drag on empty space to pan around the map

## Tile Types

The game includes a finite pool of tiles:
- **Forest** (10 tiles) - Green nature tiles
- **Plain** (10 tiles) - Light green grassland
- **Road** (5 tiles) - Gray pathways
- **River** (5 tiles) - Blue water tiles
- **House** (4 tiles) - Brown residential buildings
- **Warehouse** (2 tiles) - Dark brown industrial buildings

Total: 36 tiles

## Game Features

- **Hexagonal Grid**: Uses axial coordinate system for proper hex positioning
- **Tile Pool**: Finite number of tiles creates strategic choices
- **Exploration Mechanic**: Tap adjacent hexes to reveal tile options
- **Random Selection**: Get 3 random choices from remaining tiles
- **Pan & Zoom**: Drag to move around your growing map
- **Game Over Screen**: Restart when all tiles are placed

## Technical Details

- Pure vanilla JavaScript (no frameworks)
- HTML5 Canvas for rendering
- Touch and mouse support
- Responsive design

## Files

- `index.html` - Main game page
- `style.css` - Styling and UI
- `game.js` - Game logic and rendering
- `TileConfig.json` - Tile pool configuration
