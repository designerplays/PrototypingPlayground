// Hex Map Explorer Game
class HexMapGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSelectionDiv = document.getElementById('tile-selection');
        this.tileOptionsDiv = document.getElementById('tile-options');
        this.gameOverDiv = document.getElementById('game-over');
        this.restartBtn = document.getElementById('restart-btn');
        this.remainingCountSpan = document.getElementById('remaining-count');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugOverlay = document.getElementById('debug-overlay');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.forceRestartBtn = document.getElementById('force-restart-btn');
        this.hexRadiusSlider = document.getElementById('hex-radius-slider');
        this.hexRadiusValue = document.getElementById('hex-radius-value');

        // Hex settings
        this.hexSize = 50;
        this.hexWidth = Math.sqrt(3) * this.hexSize;
        this.hexHeight = 2 * this.hexSize;
        this.tapRadius = 50; // Configurable tap detection radius

        // Camera/pan settings
        this.camera = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastMousePos = { x: 0, y: 0 };

        // Game state
        this.tiles = new Map(); // key: "q,r" -> value: tile type
        this.tilePool = [];
        this.pendingExploration = null; // Store hex coords when selecting tile

        this.init();
    }

    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        await this.loadTileConfig();
        this.setupEventListeners();
        this.placeCenterTile();
        this.render();
    }

    async loadTileConfig() {
        const response = await fetch('TileConfig.json');
        const config = await response.json();

        // Create tile pool
        this.tilePool = [];
        config.tiles.forEach(tile => {
            for (let i = 0; i < tile.count; i++) {
                this.tilePool.push(tile.type);
            }
        });

        // Shuffle tile pool
        for (let i = this.tilePool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tilePool[i], this.tilePool[j]] = [this.tilePool[j], this.tilePool[i]];
        }

        this.updateTileCounter();
    }

    resizeCanvas() {
        // Account for device pixel ratio for sharper rendering on high-DPI screens
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;

        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;

        // Reset transform and scale context to match device pixel ratio
        // Use setTransform instead of scale to avoid cumulative scaling
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.render();
    }

    // Get properly scaled coordinates from mouse/touch event
    getCanvasCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();

        // No need to scale by DPR here since we're already scaling the context
        // Just convert from client coordinates to canvas coordinates
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    placeCenterTile() {
        // Place home base at 0, 0
        this.tiles.set('0,0', 'Home Base');
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));

        // Touch events - passive: false allows preventDefault to work
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

        this.restartBtn.addEventListener('click', () => this.restart());

        // Debug controls
        this.debugBtn.addEventListener('click', () => this.openDebugOverlay());
        this.debugCloseBtn.addEventListener('click', () => this.closeDebugOverlay());
        this.forceRestartBtn.addEventListener('click', () => {
            this.closeDebugOverlay();
            this.restart();
        });
        this.hexRadiusSlider.addEventListener('input', (e) => {
            this.tapRadius = parseInt(e.target.value);
            this.hexRadiusValue.textContent = this.tapRadius;
        });
    }

    onMouseDown(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const mouseX = coords.x;
        const mouseY = coords.y;

        // Use radius-based detection to find the closest adjacent hex
        const adjacentHex = this.findClosestAdjacentHex(mouseX, mouseY);

        if (adjacentHex) {
            this.showTileSelection(adjacentHex);
        } else {
            // Start dragging
            this.isDragging = true;
            this.dragStart = { x: mouseX, y: mouseY };
            this.lastMousePos = { x: mouseX, y: mouseY };
            this.canvas.classList.add('dragging');
        }
    }

    onMouseMove(e) {
        const coords = this.getCanvasCoordinates(e.clientX, e.clientY);
        const mouseX = coords.x;
        const mouseY = coords.y;

        if (this.isDragging) {
            const dx = mouseX - this.lastMousePos.x;
            const dy = mouseY - this.lastMousePos.y;
            this.camera.x += dx;
            this.camera.y += dy;
            this.lastMousePos = { x: mouseX, y: mouseY };
            this.render();
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.canvas.classList.remove('dragging');
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const coords = this.getCanvasCoordinates(touch.clientX, touch.clientY);
            const touchX = coords.x;
            const touchY = coords.y;

            // Use radius-based detection to find the closest adjacent hex
            const adjacentHex = this.findClosestAdjacentHex(touchX, touchY);

            if (adjacentHex) {
                this.showTileSelection(adjacentHex);
                e.preventDefault();
            } else {
                this.isDragging = true;
                this.dragStart = { x: touchX, y: touchY };
                this.lastMousePos = { x: touchX, y: touchY };
                e.preventDefault(); // Prevent default touch behaviors
            }
        }
    }

    onTouchMove(e) {
        if (this.isDragging && e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const coords = this.getCanvasCoordinates(touch.clientX, touch.clientY);
            const touchX = coords.x;
            const touchY = coords.y;

            const dx = touchX - this.lastMousePos.x;
            const dy = touchY - this.lastMousePos.y;
            this.camera.x += dx;
            this.camera.y += dy;
            this.lastMousePos = { x: touchX, y: touchY };
            this.render();
        }
    }

    onTouchEnd(e) {
        this.isDragging = false;
    }

    // Axial coordinate system for hexagons
    hexToPixel(q, r) {
        const x = this.hexSize * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.hexSize * (3 / 2 * r);

        // Use display size (not internal canvas size) since we scale the context
        const displayWidth = this.canvas.getBoundingClientRect().width;
        const displayHeight = this.canvas.getBoundingClientRect().height;

        return {
            x: x + displayWidth / 2 + this.camera.x,
            y: y + displayHeight / 2 + this.camera.y
        };
    }

    pixelToHex(x, y) {
        // Use display size (not internal canvas size) since we scale the context
        const displayWidth = this.canvas.getBoundingClientRect().width;
        const displayHeight = this.canvas.getBoundingClientRect().height;

        // Adjust for camera
        const adjX = x - displayWidth / 2 - this.camera.x;
        const adjY = y - displayHeight / 2 - this.camera.y;

        const q = (Math.sqrt(3) / 3 * adjX - 1 / 3 * adjY) / this.hexSize;
        const r = (2 / 3 * adjY) / this.hexSize;

        return this.hexRound(q, r);
    }

    hexRound(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    }

    getAdjacentHexes(q, r) {
        // Six directions in axial coordinates
        const directions = [
            { q: 1, r: 0 },   // right
            { q: 1, r: -1 },  // top-right
            { q: 0, r: -1 },  // top-left
            { q: -1, r: 0 },  // left
            { q: -1, r: 1 },  // bottom-left
            { q: 0, r: 1 }    // bottom-right
        ];

        return directions.map(dir => ({
            q: q + dir.q,
            r: r + dir.r
        }));
    }

    getAdjacentEmptyHexes() {
        const emptyHexes = new Set();

        // For each placed tile, find adjacent empty hexes
        this.tiles.forEach((tileType, key) => {
            const [q, r] = key.split(',').map(Number);
            const adjacent = this.getAdjacentHexes(q, r);

            adjacent.forEach(hex => {
                const hexKey = `${hex.q},${hex.r}`;
                if (!this.tiles.has(hexKey)) {
                    emptyHexes.add(JSON.stringify(hex));
                }
            });
        });

        return Array.from(emptyHexes).map(str => JSON.parse(str));
    }

    // Find the closest adjacent hex to a tap point using radius-based detection
    findClosestAdjacentHex(tapX, tapY) {
        const adjacentHexes = this.getAdjacentEmptyHexes();
        let closestHex = null;
        let closestDistance = Infinity;

        adjacentHexes.forEach(hex => {
            const hexPos = this.hexToPixel(hex.q, hex.r);
            const distance = Math.sqrt(
                Math.pow(tapX - hexPos.x, 2) +
                Math.pow(tapY - hexPos.y, 2)
            );

            // Only consider hexes within the tap radius
            if (distance <= this.tapRadius && distance < closestDistance) {
                closestDistance = distance;
                closestHex = hex;
            }
        });

        return closestHex;
    }

    drawHex(x, y, fillStyle, strokeStyle = '#333', text = '') {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            // Draw flat-top hexagon to match coordinate system
            const angle = Math.PI / 3 * i;
            const hx = x + this.hexSize * Math.cos(angle);
            const hy = y + this.hexSize * Math.sin(angle);
            if (i === 0) {
                this.ctx.moveTo(hx, hy);
            } else {
                this.ctx.lineTo(hx, hy);
            }
        }
        this.ctx.closePath();

        this.ctx.fillStyle = fillStyle;
        this.ctx.fill();
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw text
        if (text) {
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, x, y);
        }
    }

    render() {
        // Clear canvas - use display size since we scale the context
        const displayWidth = this.canvas.getBoundingClientRect().width;
        const displayHeight = this.canvas.getBoundingClientRect().height;

        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Draw placed tiles
        this.tiles.forEach((tileType, key) => {
            const [q, r] = key.split(',').map(Number);
            const pos = this.hexToPixel(q, r);

            const color = tileType === 'Home Base' ? '#FFD700' : this.getTileColor(tileType);
            this.drawHex(pos.x, pos.y, color, '#333', tileType);
        });

        // Draw adjacent empty hexes
        const adjacentHexes = this.getAdjacentEmptyHexes();
        adjacentHexes.forEach(hex => {
            const pos = this.hexToPixel(hex.q, hex.r);
            this.drawHex(pos.x, pos.y, 'rgba(200, 200, 200, 0.5)', '#999', '?');
        });
    }

    getTileColor(tileType) {
        const colors = {
            'Forest': '#228B22',
            'Plain': '#90EE90',
            'Road': '#808080',
            'River': '#4682B4',
            'House': '#CD853F',
            'Warehouse': '#A0522D'
        };
        return colors[tileType] || '#CCCCCC';
    }

    showTileSelection(hex) {
        if (this.tilePool.length === 0) {
            this.gameOver();
            return;
        }

        this.pendingExploration = hex;

        // Get 3 random tiles (or less if pool is running out)
        const numOptions = Math.min(3, this.tilePool.length);
        const options = [];
        for (let i = 0; i < numOptions; i++) {
            const randomIndex = Math.floor(Math.random() * this.tilePool.length);
            options.push(this.tilePool[randomIndex]);
        }

        // Clear previous options
        this.tileOptionsDiv.innerHTML = '';

        // Create option buttons
        options.forEach(tileType => {
            const button = document.createElement('button');
            button.className = 'tile-option';
            button.textContent = tileType;
            button.addEventListener('click', () => this.selectTile(tileType));
            this.tileOptionsDiv.appendChild(button);
        });

        this.tileSelectionDiv.classList.remove('hidden');
    }

    selectTile(tileType) {
        // Remove selected tile from pool
        const index = this.tilePool.indexOf(tileType);
        if (index > -1) {
            this.tilePool.splice(index, 1);
        }

        // Place tile
        const hexKey = `${this.pendingExploration.q},${this.pendingExploration.r}`;
        this.tiles.set(hexKey, tileType);

        // Hide selection UI
        this.tileSelectionDiv.classList.add('hidden');
        this.pendingExploration = null;

        // Update counter
        this.updateTileCounter();

        // Re-render
        this.render();

        // Check if game over
        if (this.tilePool.length === 0) {
            this.gameOver();
        }
    }

    updateTileCounter() {
        this.remainingCountSpan.textContent = this.tilePool.length;
    }

    gameOver() {
        this.gameOverDiv.classList.remove('hidden');
    }

    openDebugOverlay() {
        this.debugOverlay.classList.remove('hidden');
    }

    closeDebugOverlay() {
        this.debugOverlay.classList.add('hidden');
    }

    restart() {
        // Reset game state
        this.tiles.clear();
        this.tilePool = [];
        this.pendingExploration = null;
        this.camera = { x: 0, y: 0 };

        // Hide UI
        this.gameOverDiv.classList.add('hidden');
        this.tileSelectionDiv.classList.add('hidden');

        // Reinitialize
        this.loadTileConfig().then(() => {
            this.placeCenterTile();
            this.render();
        });
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new HexMapGame();
});
