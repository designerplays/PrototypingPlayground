// Word Blocks Game - Mobile-First Word Puzzle
// VERSION: 0.6 (increment by 0.1 for each change unless specified otherwise)

class WordBlocksGame {
    constructor() {
        // DOM elements
        this.gridContainer = document.getElementById('grid-container');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugOverlay = document.getElementById('debug-overlay');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.forceRestartBtn = document.getElementById('force-restart-btn');
        this.versionDisplay = document.getElementById('version-display');

        // Config sliders
        this.disappearTimeSlider = document.getElementById('disappear-time-slider');
        this.disappearTimeValue = document.getElementById('disappear-time-value');
        this.fallTimeSlider = document.getElementById('fall-time-slider');
        this.fallTimeValue = document.getElementById('fall-time-value');
        this.blockSizeSlider = document.getElementById('block-size-slider');
        this.blockSizeValue = document.getElementById('block-size-value');

        // Version info
        this.version = '0.6';

        // Config values
        this.disappearTime = 300; // ms
        this.fallTime = 300; // ms
        this.blockSize = 2.5; // em

        // Grid settings
        this.gridSize = 5;
        this.grid = []; // 2D array of letters
        this.cellElements = []; // 2D array of DOM elements

        // Letter distribution
        this.letterDistribution = {};
        this.letterPool = []; // Flat array of letters based on weights

        // Selection state
        this.isSelecting = false;
        this.selectedCells = []; // Array of {row, col} objects
        this.currentWord = '';

        // Touch tracking
        this.lastTouchedCell = null;

        this.init();
    }

    async init() {
        await this.loadLetterDistribution();
        this.setupEventListeners();
        this.setupConfigListeners();
        this.updateCSSVariables();
        this.initializeGrid();
        this.renderGrid();

        // Update version display
        if (this.versionDisplay) {
            this.versionDisplay.textContent = this.version;
        }
    }

    async loadLetterDistribution() {
        const response = await fetch('LetterDistribution.json');
        this.letterDistribution = await response.json();

        // Create a flat array of letters based on their weights
        this.letterPool = [];
        for (const [letter, weight] of Object.entries(this.letterDistribution)) {
            for (let i = 0; i < weight; i++) {
                this.letterPool.push(letter);
            }
        }
    }

    getRandomLetter() {
        const randomIndex = Math.floor(Math.random() * this.letterPool.length);
        return this.letterPool[randomIndex];
    }

    initializeGrid() {
        // Initialize grid with random letters
        this.grid = [];
        for (let row = 0; row < this.gridSize; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                this.grid[row][col] = this.getRandomLetter();
            }
        }
    }

    renderGrid() {
        // Clear existing grid
        this.gridContainer.innerHTML = '';
        this.cellElements = [];

        // Create grid cells
        for (let row = 0; row < this.gridSize; row++) {
            this.cellElements[row] = [];
            for (let col = 0; col < this.gridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'letter-cell';
                cell.textContent = this.grid[row][col];
                cell.dataset.row = row;
                cell.dataset.col = col;

                this.cellElements[row][col] = cell;
                this.gridContainer.appendChild(cell);
            }
        }
    }

    setupEventListeners() {
        // Mouse events
        this.gridContainer.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        document.addEventListener('mousemove', (e) => this.handlePointerMove(e));
        document.addEventListener('mouseup', (e) => this.handlePointerUp(e));

        // Touch events
        this.gridContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerDown(e);
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            // Don't prevent default if touch is within debug overlay
            if (!this.debugOverlay.contains(e.target)) {
                e.preventDefault();
                this.handlePointerMove(e);
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            // Don't prevent default if touch is within debug overlay
            if (!this.debugOverlay.contains(e.target)) {
                e.preventDefault();
                this.handlePointerUp(e);
            }
        }, { passive: false });

        // Prevent touch event propagation from debug overlay to grid
        this.debugOverlay.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, { passive: true });

        this.debugOverlay.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        this.debugOverlay.addEventListener('touchend', (e) => {
            e.stopPropagation();
        }, { passive: true });

        // Debug buttons - support both click and touch events for better mobile support
        this.debugBtn.addEventListener('click', () => this.openDebugPanel());
        this.debugBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.openDebugPanel();
        });

        this.debugCloseBtn.addEventListener('click', () => this.closeDebugPanel());
        this.debugCloseBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.closeDebugPanel();
        });

        this.forceRestartBtn.addEventListener('click', () => {
            this.closeDebugPanel();
            this.restart();
        });
        this.forceRestartBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.closeDebugPanel();
            this.restart();
        });
    }

    setupConfigListeners() {
        // Disappear time slider
        this.disappearTimeSlider.addEventListener('input', (e) => {
            this.disappearTime = parseInt(e.target.value);
            this.disappearTimeValue.textContent = this.disappearTime;
            this.updateCSSVariables();
        });

        // Fall time slider
        this.fallTimeSlider.addEventListener('input', (e) => {
            this.fallTime = parseInt(e.target.value);
            this.fallTimeValue.textContent = this.fallTime;
            this.updateCSSVariables();
        });

        // Block size slider
        this.blockSizeSlider.addEventListener('input', (e) => {
            this.blockSize = parseFloat(e.target.value);
            this.blockSizeValue.textContent = this.blockSize;
            this.updateCSSVariables();
        });
    }

    updateCSSVariables() {
        document.documentElement.style.setProperty('--disappear-time', `${this.disappearTime}ms`);
        document.documentElement.style.setProperty('--fall-time', `${this.fallTime}ms`);
        document.documentElement.style.setProperty('--block-size', `${this.blockSize}em`);
    }

    getCellFromEvent(e) {
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const element = document.elementFromPoint(clientX, clientY);
        if (element && element.classList.contains('letter-cell')) {
            return {
                row: parseInt(element.dataset.row),
                col: parseInt(element.dataset.col),
                element: element
            };
        }
        return null;
    }

    handlePointerDown(e) {
        const cellInfo = this.getCellFromEvent(e);
        if (!cellInfo) return;

        this.isSelecting = true;
        this.selectedCells = [];
        this.currentWord = '';

        this.addCellToSelection(cellInfo.row, cellInfo.col);
        this.lastTouchedCell = { row: cellInfo.row, col: cellInfo.col };
    }

    handlePointerMove(e) {
        if (!this.isSelecting) return;

        const cellInfo = this.getCellFromEvent(e);
        if (!cellInfo) return;

        const { row, col } = cellInfo;

        // Check if this is a different cell than the last one
        if (this.lastTouchedCell &&
            this.lastTouchedCell.row === row &&
            this.lastTouchedCell.col === col) {
            return;
        }

        // Check if already selected
        const alreadySelected = this.selectedCells.some(
            cell => cell.row === row && cell.col === col
        );

        if (alreadySelected) {
            return;
        }

        // Check if adjacent to the last selected cell (including diagonal)
        if (this.selectedCells.length > 0) {
            const lastCell = this.selectedCells[this.selectedCells.length - 1];
            if (!this.isAdjacent(lastCell.row, lastCell.col, row, col)) {
                return;
            }
        }

        this.addCellToSelection(row, col);
        this.lastTouchedCell = { row, col };
    }

    handlePointerUp(e) {
        if (!this.isSelecting) return;

        this.isSelecting = false;
        this.lastTouchedCell = null;

        // Check if the word is valid
        if (this.currentWord.length >= 3) {
            this.checkWord(this.currentWord);
        } else {
            // Clear selection if word is too short
            this.clearSelection();
        }
    }

    isAdjacent(row1, col1, row2, col2) {
        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        // Adjacent includes horizontal, vertical, and diagonal (8 directions)
        return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    }

    addCellToSelection(row, col) {
        this.selectedCells.push({ row, col });
        this.currentWord += this.grid[row][col];
        this.cellElements[row][col].classList.add('selected');
    }

    clearSelection() {
        this.selectedCells.forEach(cell => {
            this.cellElements[cell.row][cell.col].classList.remove('selected');
        });
        this.selectedCells = [];
        this.currentWord = '';
    }

    async checkWord(word) {
        // Simple word validation - check if it's in a basic English dictionary
        // For now, we'll use a simple API call to check if the word is valid
        const isValid = await this.isValidWord(word);

        if (isValid) {
            console.log('Valid word:', word);
            await this.removeSelectedCells();
            await this.applyGravity();
            await this.fillEmptyCells();
        } else {
            console.log('Invalid word:', word);
            this.clearSelection();
        }
    }

    async isValidWord(word) {
        // Use a free dictionary API to validate the word
        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
            return response.ok;
        } catch (error) {
            console.error('Error validating word:', error);
            // If API fails, accept words of 3+ letters as a fallback
            return word.length >= 3;
        }
    }

    async removeSelectedCells() {
        // Animate removal
        this.selectedCells.forEach(cell => {
            this.cellElements[cell.row][cell.col].classList.add('removing');
        });

        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, this.disappearTime));

        // Clear the cells
        this.selectedCells.forEach(cell => {
            this.grid[cell.row][cell.col] = null;
            this.cellElements[cell.row][cell.col].textContent = '';
            this.cellElements[cell.row][cell.col].classList.remove('selected', 'removing');
        });

        this.selectedCells = [];
        this.currentWord = '';
    }

    async applyGravity() {
        // Track which cells will have the falling animation with their info
        const cellsToAnimate = [];

        // Process each column from bottom to top
        for (let col = 0; col < this.gridSize; col++) {
            // Collect non-null letters with their original row positions
            const lettersWithPositions = [];
            for (let row = this.gridSize - 1; row >= 0; row--) {
                if (this.grid[row][col] !== null) {
                    lettersWithPositions.push({ letter: this.grid[row][col], originalRow: row });
                }
            }

            // Fill from bottom with collected letters
            let letterIndex = 0;
            for (let row = this.gridSize - 1; row >= 0; row--) {
                if (letterIndex < lettersWithPositions.length) {
                    const { letter, originalRow } = lettersWithPositions[letterIndex];
                    this.grid[row][col] = letter;
                    this.cellElements[row][col].textContent = letter;

                    // Only animate if the block moved to a different position
                    if (originalRow !== row) {
                        const distance = row - originalRow;
                        cellsToAnimate.push({ row, col, distance });
                    }
                    letterIndex++;
                } else {
                    this.grid[row][col] = null;
                    this.cellElements[row][col].textContent = '';
                }
            }
        }

        // Only animate if there are cells to animate
        if (cellsToAnimate.length > 0) {
            // Sort cells: bottom to top, then left to right
            cellsToAnimate.sort((a, b) => {
                if (b.row !== a.row) return b.row - a.row; // Bottom first (higher row number)
                return a.col - b.col; // Left to right
            });

            // Apply staggered animation to each cell
            const staggerDelay = 50; // ms between each block animation start
            cellsToAnimate.forEach((cell, index) => {
                const delay = index * staggerDelay;
                const cellElement = this.cellElements[cell.row][cell.col];

                // Set animation delay and fall distance
                cellElement.style.animationDelay = `${delay}ms`;
                cellElement.style.setProperty('--fall-distance', `${-cell.distance * 100}%`);
                cellElement.classList.add('falling');
            });

            // Wait for all animations to complete
            const totalAnimationTime = this.fallTime + (cellsToAnimate.length - 1) * staggerDelay;
            await new Promise(resolve => setTimeout(resolve, totalAnimationTime));

            // Remove falling class and inline styles
            cellsToAnimate.forEach(cell => {
                const cellElement = this.cellElements[cell.row][cell.col];
                cellElement.classList.remove('falling');
                cellElement.style.animationDelay = '';
                cellElement.style.removeProperty('--fall-distance');
            });
        }
    }

    async fillEmptyCells() {
        // Collect all empty cells
        const emptyCells = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                if (this.grid[row][col] === null) {
                    emptyCells.push({ row, col });
                }
            }
        }

        if (emptyCells.length === 0) return;

        // Fill empty cells with new random letters
        emptyCells.forEach(cell => {
            const newLetter = this.getRandomLetter();
            this.grid[cell.row][cell.col] = newLetter;
            this.cellElements[cell.row][cell.col].textContent = newLetter;
        });

        // Sort cells: bottom to top, then left to right
        emptyCells.sort((a, b) => {
            if (b.row !== a.row) return b.row - a.row; // Bottom first (higher row number)
            return a.col - b.col; // Left to right
        });

        // Apply staggered animation to each cell
        const staggerDelay = 50; // ms between each block animation start
        emptyCells.forEach((cell, index) => {
            const delay = index * staggerDelay;
            const cellElement = this.cellElements[cell.row][cell.col];

            // Calculate fall distance based on position from top
            const fallDistance = (cell.row + 1) * 100; // Fall from above the grid
            cellElement.style.animationDelay = `${delay}ms`;
            cellElement.style.setProperty('--fall-distance', `-${fallDistance}%`);
            cellElement.classList.add('falling');
        });

        // Wait for all animations to complete
        const totalAnimationTime = this.fallTime + (emptyCells.length - 1) * staggerDelay;
        await new Promise(resolve => setTimeout(resolve, totalAnimationTime));

        // Remove falling class and inline styles
        emptyCells.forEach(cell => {
            const cellElement = this.cellElements[cell.row][cell.col];
            cellElement.classList.remove('falling');
            cellElement.style.animationDelay = '';
            cellElement.style.removeProperty('--fall-distance');
        });
    }

    openDebugPanel() {
        this.debugOverlay.classList.remove('hidden');
    }

    closeDebugPanel() {
        this.debugOverlay.classList.add('hidden');
    }

    restart() {
        this.initializeGrid();
        this.renderGrid();
        this.clearSelection();
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new WordBlocksGame();
});
