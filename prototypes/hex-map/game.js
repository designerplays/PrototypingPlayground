// Hex Map Explorer Game - Mobile-First Rebuild
// Complete rewrite for pixel-perfect visual and tap alignment
// VERSION: 0.3 (increment by 0.1 for each change unless specified otherwise)

class HexMapGame {
    constructor() {
        // DOM elements
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSelectionDiv = document.getElementById('tile-selection');
        this.tileOptionsDiv = document.getElementById('tile-options');
        this.gameOverDiv = document.getElementById('game-over');
        this.restartBtn = document.getElementById('restart-btn');
        this.remainingCountSpan = document.getElementById('remaining-count');
        this.foodCountSpan = document.getElementById('food-count');
        this.materialsCountSpan = document.getElementById('materials-count');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugOverlay = document.getElementById('debug-overlay');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.forceRestartBtn = document.getElementById('force-restart-btn');
        this.hexRadiusSlider = document.getElementById('hex-radius-slider');
        this.hexRadiusValue = document.getElementById('hex-radius-value');
        this.versionDisplay = document.getElementById('version-display');
        this.securePopup = document.getElementById('secure-popup');
        this.secureBtn = document.getElementById('secure-btn');
        this.secureCancelBtn = document.getElementById('secure-cancel-btn');
        this.secureMessage = document.getElementById('secure-message');

        // Version info
        this.version = '0.3';

        // Hex geometry - using pointy-top orientation
        // Mobile-first: larger hex size for better touch targets
        this.hexRadius = 60; // Increased from 50 for better mobile touch

        // Camera/viewport
        this.camera = { x: 0, y: 0 };
        this.viewportWidth = 0;
        this.viewportHeight = 0;

        // Interaction state
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragLastPos = { x: 0, y: 0 };
        this.tapStartHex = null; // Track which hex was tapped initially
        this.TAP_WIGGLE_THRESHOLD = 10; // pixels - max movement to still count as a tap

        // Game state
        this.tiles = new Map(); // key: "q,r" -> value: { type, secured }
        this.tilePool = [];
        this.tileConfig = {}; // Store tile configuration with resources
        this.pendingHex = null; // Hex awaiting tile selection
        this.pendingSecureHex = null; // Hex awaiting secure action

        // Resources
        this.food = 10;
        this.materials = 10;
        this.secureCost = { materials: 5, food: 1 }; // Cost to secure a tile

        // Debug
        this.showDebugOverlay = false;
        this.debugTapRadius = 60; // For visualization only

        this.init();
    }

    async init() {
        await this.loadTileConfig();
        this.setupCanvas();
        this.setupEventListeners();
        this.placeCenterTile();
        this.render();

        // Update version display
        if (this.versionDisplay) {
            this.versionDisplay.textContent = this.version;
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });
    }

    async loadTileConfig() {
        const response = await fetch('TileConfig.json');
        const config = await response.json();

        // Store tile configuration
        this.tileConfig = {};
        config.tiles.forEach(tile => {
            this.tileConfig[tile.type] = {
                food: tile.food,
                materials: tile.materials
            };
        });

        // Build tile pool
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
        this.updateResourceCounters();
    }

    setupCanvas() {
        // Get actual display size
        const rect = this.canvas.getBoundingClientRect();
        this.viewportWidth = rect.width;
        this.viewportHeight = rect.height;

        // Set internal canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.viewportWidth * dpr;
        this.canvas.height = this.viewportHeight * dpr;

        // Scale context to match DPR, but work in logical pixels
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    placeCenterTile() {
        this.tiles.set('0,0', { type: 'Home Base', secured: true });
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) this.handlePointerMove(e.clientX, e.clientY);
        });
        this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseleave', () => this.handlePointerUp());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handlePointerDown(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handlePointerMove(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            // Get the last touch position from changedTouches
            if (e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                this.handlePointerUp(touch.clientX, touch.clientY);
            } else {
                this.handlePointerUp();
            }
        }, { passive: false });

        // UI buttons
        this.restartBtn.addEventListener('click', () => this.restart());
        this.debugBtn.addEventListener('click', () => this.openDebugPanel());
        this.debugCloseBtn.addEventListener('click', () => this.closeDebugPanel());
        this.forceRestartBtn.addEventListener('click', () => {
            this.closeDebugPanel();
            this.restart();
        });
        this.hexRadiusSlider.addEventListener('input', (e) => {
            this.debugTapRadius = parseInt(e.target.value);
            this.hexRadiusValue.textContent = this.debugTapRadius;
            this.render();
        });

        // Secure popup buttons
        this.secureBtn.addEventListener('click', () => this.secureTile());
        this.secureCancelBtn.addEventListener('click', () => this.closeSecurePopup());
    }

    // Convert client coordinates to canvas logical coordinates
    clientToCanvas(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handlePointerDown(clientX, clientY) {
        const canvasPos = this.clientToCanvas(clientX, clientY);

        // Store the tap start position and hex
        this.dragStartPos = canvasPos;
        this.dragLastPos = canvasPos;
        this.tapStartHex = this.findHexAtPosition(canvasPos.x, canvasPos.y);

        // Always start in dragging mode - we'll determine on pointer up if it was a tap or pan
        this.isDragging = true;
        this.canvas.classList.add('dragging');
    }

    handlePointerMove(clientX, clientY) {
        if (!this.isDragging) return;

        const canvasPos = this.clientToCanvas(clientX, clientY);
        const dx = canvasPos.x - this.dragLastPos.x;
        const dy = canvasPos.y - this.dragLastPos.y;

        this.camera.x += dx;
        this.camera.y += dy;
        this.dragLastPos = canvasPos;

        this.render();
    }

    handlePointerUp(clientX, clientY) {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.canvas.classList.remove('dragging');

        // Check if this was a tap (minimal movement) rather than a pan
        if (clientX !== undefined && clientY !== undefined) {
            const canvasPos = this.clientToCanvas(clientX, clientY);
            const distanceMoved = Math.sqrt(
                Math.pow(canvasPos.x - this.dragStartPos.x, 2) +
                Math.pow(canvasPos.y - this.dragStartPos.y, 2)
            );

            // If movement was within wiggle threshold, treat as a tap
            if (distanceMoved <= this.TAP_WIGGLE_THRESHOLD) {
                // If secure popup is open, close it and don't process hex taps
                if (!this.securePopup.classList.contains('hidden')) {
                    this.closeSecurePopup();
                } else {
                    const endHex = this.findHexAtPosition(canvasPos.x, canvasPos.y);

                    if (endHex) {
                        const key = `${endHex.q},${endHex.r}`;
                        const tile = this.tiles.get(key);

                        // Check if we tapped on a discovered (placed) tile that's not secured
                        if (tile && !tile.secured) {
                            this.showSecurePopup(endHex);
                        }
                        // Check if we tapped on an adjacent empty hex (for exploration)
                        else if (this.isAdjacentToSecured(endHex.q, endHex.r) && !tile) {
                            // Show tile selection for this hex
                            this.showTileSelection(endHex);
                        }
                    }
                }
            }
        }

        // Clear tap state
        this.tapStartHex = null;
    }

    // =============================================================================
    // HEX COORDINATE SYSTEM - POINTY-TOP ORIENTATION
    // Reference: https://www.redblobgames.com/grids/hexagons/
    // =============================================================================

    // Convert hex axial coordinates (q, r) to pixel position (x, y)
    // CRITICAL: No rounding here - return exact floating point position
    hexToPixel(q, r) {
        const x = this.hexRadius * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
        const y = this.hexRadius * (3 / 2 * r);

        // Apply camera offset and center in viewport
        return {
            x: x + this.viewportWidth / 2 + this.camera.x,
            y: y + this.viewportHeight / 2 + this.camera.y
        };
    }

    // Convert pixel position (x, y) to hex axial coordinates (q, r)
    // CRITICAL: Uses exact inverse of hexToPixel - no rounding
    pixelToHex(x, y) {
        // Remove camera offset and viewport centering
        const relX = x - this.viewportWidth / 2 - this.camera.x;
        const relY = y - this.viewportHeight / 2 - this.camera.y;

        // Convert to fractional hex coordinates
        const q = (Math.sqrt(3) / 3 * relX - 1 / 3 * relY) / this.hexRadius;
        const r = (2 / 3 * relY) / this.hexRadius;

        // Round to nearest integer hex coordinates
        return this.roundHex(q, r);
    }

    // Round fractional hex coordinates to nearest integer hex
    roundHex(q, r) {
        const s = -q - r;

        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        // Reset the component with the largest rounding error
        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    }

    // Find which hex (if any) contains the given pixel position
    findHexAtPosition(x, y) {
        const hex = this.pixelToHex(x, y);
        const hexCenter = this.hexToPixel(hex.q, hex.r);

        // Check if point is actually inside this hex (not just in its bounding box)
        const distance = Math.sqrt(
            Math.pow(x - hexCenter.x, 2) +
            Math.pow(y - hexCenter.y, 2)
        );

        // Use hex radius as the hit test boundary
        if (distance <= this.hexRadius) {
            return hex;
        }

        return null;
    }

    // Get the six adjacent hex coordinates
    getAdjacentHexes(q, r) {
        return [
            { q: q + 1, r: r },     // right
            { q: q + 1, r: r - 1 }, // top-right
            { q: q, r: r - 1 },     // top-left
            { q: q - 1, r: r },     // left
            { q: q - 1, r: r + 1 }, // bottom-left
            { q: q, r: r + 1 }      // bottom-right
        ];
    }

    // Check if a hex is adjacent to any placed tile and is empty
    isAdjacentEmpty(q, r) {
        const key = `${q},${r}`;

        // Must be empty
        if (this.tiles.has(key)) return false;

        // Must be adjacent to at least one placed tile
        const adjacent = this.getAdjacentHexes(q, r);
        return adjacent.some(hex => this.tiles.has(`${hex.q},${hex.r}`));
    }

    // Check if a hex is adjacent to a secured tile
    isAdjacentToSecured(q, r) {
        const key = `${q},${r}`;

        // Must be empty
        if (this.tiles.has(key)) return false;

        // Must be adjacent to at least one secured tile
        const adjacent = this.getAdjacentHexes(q, r);
        return adjacent.some(hex => {
            const tile = this.tiles.get(`${hex.q},${hex.r}`);
            return tile && tile.secured;
        });
    }

    // Check if a tile can be secured (must be adjacent to another secured tile)
    canSecureTile(q, r) {
        const adjacent = this.getAdjacentHexes(q, r);
        return adjacent.some(hex => {
            const tile = this.tiles.get(`${hex.q},${hex.r}`);
            return tile && tile.secured;
        });
    }

    // Get all hexes that are adjacent to secured tiles and empty
    getAllAdjacentEmptyHexes() {
        const emptyHexes = new Set();

        this.tiles.forEach((tile, key) => {
            // Only consider secured tiles
            if (!tile.secured) return;

            const [q, r] = key.split(',').map(Number);
            const adjacent = this.getAdjacentHexes(q, r);

            adjacent.forEach(hex => {
                const hexKey = `${hex.q},${hex.r}`;
                if (!this.tiles.has(hexKey)) {
                    emptyHexes.add(hexKey);
                }
            });
        });

        return Array.from(emptyHexes).map(key => {
            const [q, r] = key.split(',').map(Number);
            return { q, r };
        });
    }

    // =============================================================================
    // RENDERING
    // =============================================================================

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

        // Draw all placed tiles
        this.tiles.forEach((tile, key) => {
            const [q, r] = key.split(',').map(Number);
            const pos = this.hexToPixel(q, r);
            const color = tile.type === 'Home Base' ? '#FFD700' : this.getTileColor(tile.type);
            this.drawHexagon(pos.x, pos.y, color, '#333', tile.type, tile.secured);
        });

        // Draw adjacent empty hexes (exploration targets)
        const adjacentEmpty = this.getAllAdjacentEmptyHexes();
        adjacentEmpty.forEach(hex => {
            const pos = this.hexToPixel(hex.q, hex.r);
            this.drawHexagon(pos.x, pos.y, 'rgba(200, 200, 200, 0.5)', '#999', '?');
        });

        // Debug visualization
        if (this.showDebugOverlay) {
            this.drawDebugOverlay(adjacentEmpty);
        }
    }

    drawHexagon(centerX, centerY, fillColor, strokeColor, text, secured = false) {
        this.ctx.beginPath();

        // Draw pointy-top hexagon
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i - 30;
            const angleRad = Math.PI / 180 * angleDeg;
            const x = centerX + this.hexRadius * Math.cos(angleRad);
            const y = centerY + this.hexRadius * Math.sin(angleRad);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.closePath();

        // Fill
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        // Stroke
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw double inset outline for secured tiles
        if (secured) {
            const insetRadius1 = this.hexRadius - 8;
            const insetRadius2 = this.hexRadius - 12;
            const secureColor = '#1e7e34'; // Dark green

            // First inset outline
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angleDeg = 60 * i - 30;
                const angleRad = Math.PI / 180 * angleDeg;
                const x = centerX + insetRadius1 * Math.cos(angleRad);
                const y = centerY + insetRadius1 * Math.sin(angleRad);

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.strokeStyle = secureColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Second inset outline
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angleDeg = 60 * i - 30;
                const angleRad = Math.PI / 180 * angleDeg;
                const x = centerX + insetRadius2 * Math.cos(angleRad);
                const y = centerY + insetRadius2 * Math.sin(angleRad);

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.strokeStyle = secureColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Text
        if (text) {
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, centerX, centerY);
        }
    }

    drawDebugOverlay(adjacentEmpty) {
        // Draw hit test circles for adjacent hexes
        adjacentEmpty.forEach(hex => {
            const pos = this.hexToPixel(hex.q, hex.r);

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, this.debugTapRadius, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw crosshair at center
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x - 10, pos.y);
            this.ctx.lineTo(pos.x + 10, pos.y);
            this.ctx.moveTo(pos.x, pos.y - 10);
            this.ctx.lineTo(pos.x, pos.y + 10);
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
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

    // =============================================================================
    // GAME LOGIC
    // =============================================================================

    showTileSelection(hex) {
        if (this.tilePool.length === 0) {
            this.gameOver();
            return;
        }

        // Check if there's enough food to explore
        if (this.food < 1) {
            // Not enough food to explore - could show a message here
            return;
        }

        // Deduct 1 food for exploring
        this.food -= 1;
        this.updateResourceCounters();

        this.pendingHex = hex;

        // Get up to 3 unique random tile options
        const uniqueTileTypes = [...new Set(this.tilePool)];
        const numOptions = Math.min(3, uniqueTileTypes.length);
        const options = [];

        // Shuffle unique tile types and pick the first numOptions
        const shuffled = [...uniqueTileTypes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numOptions; i++) {
            options.push(shuffled[i]);
        }

        // Clear and populate tile options
        this.tileOptionsDiv.innerHTML = '';
        options.forEach(tileType => {
            const button = document.createElement('button');
            button.className = 'tile-option';
            button.textContent = tileType;
            button.addEventListener('click', () => this.selectTile(tileType));
            this.tileOptionsDiv.appendChild(button);
        });

        this.tileSelectionDiv.classList.remove('hidden');
    }

    showSecurePopup(hex) {
        this.pendingSecureHex = hex;
        const key = `${hex.q},${hex.r}`;
        const tile = this.tiles.get(key);

        if (!tile || tile.secured) {
            return;
        }

        // Check if tile can be secured (adjacent to secured tiles)
        const canSecure = this.canSecureTile(hex.q, hex.r);

        // Check if player has enough resources
        const hasEnoughResources = this.materials >= this.secureCost.materials &&
                                    this.food >= this.secureCost.food;

        // Update button state and message
        if (!canSecure) {
            this.secureBtn.disabled = true;
            this.secureMessage.textContent = 'You can only secure tiles next to other secured tiles';
            this.secureMessage.style.display = 'block';
        } else if (!hasEnoughResources) {
            this.secureBtn.disabled = true;
            this.secureMessage.textContent = "You don't have enough resources";
            this.secureMessage.style.display = 'block';
        } else {
            this.secureBtn.disabled = false;
            this.secureMessage.textContent = '';
            this.secureMessage.style.display = 'none';
        }

        this.securePopup.classList.remove('hidden');
    }

    closeSecurePopup() {
        this.securePopup.classList.add('hidden');
        this.pendingSecureHex = null;
    }

    secureTile() {
        if (!this.pendingSecureHex) return;

        const key = `${this.pendingSecureHex.q},${this.pendingSecureHex.r}`;
        const tile = this.tiles.get(key);

        if (!tile || tile.secured) {
            this.closeSecurePopup();
            return;
        }

        // Check if can secure and has resources
        if (!this.canSecureTile(this.pendingSecureHex.q, this.pendingSecureHex.r)) {
            this.closeSecurePopup();
            return;
        }

        if (this.materials < this.secureCost.materials || this.food < this.secureCost.food) {
            this.closeSecurePopup();
            return;
        }

        // Deduct resources
        this.materials -= this.secureCost.materials;
        this.food -= this.secureCost.food;

        // Mark tile as secured
        tile.secured = true;
        this.tiles.set(key, tile);

        // Update UI
        this.updateResourceCounters();
        this.render();
        this.closeSecurePopup();
    }

    selectTile(tileType) {
        // Remove tile from pool
        const index = this.tilePool.indexOf(tileType);
        if (index > -1) {
            this.tilePool.splice(index, 1);
        }

        // Place tile (not secured by default)
        const key = `${this.pendingHex.q},${this.pendingHex.r}`;
        this.tiles.set(key, { type: tileType, secured: false });

        // Add resources from the placed tile
        if (this.tileConfig[tileType]) {
            this.food += this.tileConfig[tileType].food;
            this.materials += this.tileConfig[tileType].materials;
        }

        // Clear selection
        this.tileSelectionDiv.classList.add('hidden');
        this.pendingHex = null;

        // Update UI
        this.updateTileCounter();
        this.updateResourceCounters();
        this.render();

        // Check game over
        if (this.tilePool.length === 0) {
            this.gameOver();
        }
    }

    updateTileCounter() {
        this.remainingCountSpan.textContent = this.tilePool.length;
    }

    updateResourceCounters() {
        this.foodCountSpan.textContent = this.food;
        this.materialsCountSpan.textContent = this.materials;
    }

    gameOver() {
        this.gameOverDiv.classList.remove('hidden');
    }

    openDebugPanel() {
        this.debugOverlay.classList.remove('hidden');
        this.showDebugOverlay = true;
        this.render();
    }

    closeDebugPanel() {
        this.debugOverlay.classList.add('hidden');
        this.showDebugOverlay = false;
        this.render();
    }

    restart() {
        // Reset all state
        this.tiles.clear();
        this.tilePool = [];
        this.pendingHex = null;
        this.pendingSecureHex = null;
        this.camera = { x: 0, y: 0 };
        this.food = 10;
        this.materials = 10;

        // Hide overlays
        this.gameOverDiv.classList.add('hidden');
        this.tileSelectionDiv.classList.add('hidden');
        this.securePopup.classList.add('hidden');

        // Reinitialize game
        this.loadTileConfig().then(() => {
            this.placeCenterTile();
            this.render();
        });
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new HexMapGame();
});
