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

        // Hex settings
        this.hexSize = 50;
        this.hexWidth = Math.sqrt(3) * this.hexSize;
        this.hexHeight = 2 * this.hexSize;

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
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
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

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        this.restartBtn.addEventListener('click', () => this.restart());
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const hex = this.pixelToHex(mouseX, mouseY);
        const adjacentHexes = this.getAdjacentEmptyHexes();

        // Check if clicking on an adjacent empty hex
        const isAdjacent = adjacentHexes.some(h => h.q === hex.q && h.r === hex.r);

        if (isAdjacent) {
            this.showTileSelection(hex);
        } else {
            // Start dragging
            this.isDragging = true;
            this.dragStart = { x: mouseX, y: mouseY };
            this.lastMousePos = { x: mouseX, y: mouseY };
            this.canvas.classList.add('dragging');
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

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
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            const hex = this.pixelToHex(touchX, touchY);
            const adjacentHexes = this.getAdjacentEmptyHexes();
            const isAdjacent = adjacentHexes.some(h => h.q === hex.q && h.r === hex.r);

            if (isAdjacent) {
                this.showTileSelection(hex);
                e.preventDefault();
            } else {
                this.isDragging = true;
                this.dragStart = { x: touchX, y: touchY };
                this.lastMousePos = { x: touchX, y: touchY };
            }
        }
    }

    onTouchMove(e) {
        if (this.isDragging && e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

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
        return {
            x: x + this.canvas.width / 2 + this.camera.x,
            y: y + this.canvas.height / 2 + this.camera.y
        };
    }

    pixelToHex(x, y) {
        // Adjust for camera
        const adjX = x - this.canvas.width / 2 - this.camera.x;
        const adjY = y - this.canvas.height / 2 - this.camera.y;

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

    drawHex(x, y, fillStyle, strokeStyle = '#333', text = '') {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
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
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
