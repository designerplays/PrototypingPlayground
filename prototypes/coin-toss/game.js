// Coin Toss Game - XP and Money
// VERSION: 0.1

class CoinTossGame {
    constructor() {
        // DOM elements
        this.coin = document.getElementById('coin');
        this.flipButton = document.getElementById('flipButton');
        this.resultElement = document.getElementById('result');
        this.xpBar = document.getElementById('xpBar');
        this.xpText = document.getElementById('xpText');
        this.moneyCounter = document.getElementById('moneyCounter');
        this.flipsLeftCounter = document.getElementById('flipsLeftCounter');
        this.gameOverPopup = document.getElementById('gameOver');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        this.debugBtn = document.getElementById('debug-btn');
        this.debugOverlay = document.getElementById('debug-overlay');
        this.debugCloseBtn = document.getElementById('debug-close-btn');
        this.versionDisplay = document.getElementById('version-display');

        // Game state
        this.xp = 0;
        this.money = 0;
        this.flipsLeft = 100;
        this.isFlipping = false;
        this.version = '0.1';

        this.initialize();
    }

    initialize() {
        // Set up event listeners
        this.flipButton.addEventListener('click', () => this.flipCoin());
        this.playAgainBtn.addEventListener('click', () => this.resetGame());
        this.debugBtn.addEventListener('click', () => this.toggleDebug());
        this.debugCloseBtn.addEventListener('click', () => this.toggleDebug());

        // Update version display
        if (this.versionDisplay) {
            this.versionDisplay.textContent = this.version;
        }

        // Initialize UI
        this.updateUI();
    }

    flipCoin() {
        if (this.isFlipping || this.flipsLeft <= 0) {
            return;
        }

        this.isFlipping = true;
        this.flipButton.disabled = true;
        this.resultElement.textContent = '';
        this.resultElement.classList.remove('show');

        // Remove any existing animation classes
        this.coin.classList.remove('flipping-xp', 'flipping-money');

        // Randomly determine the outcome
        const isXP = Math.random() < 0.5;

        // Force a reflow to restart the animation
        void this.coin.offsetWidth;

        // Add the appropriate animation class
        if (isXP) {
            this.coin.classList.add('flipping-xp');
        } else {
            this.coin.classList.add('flipping-money');
        }

        // Wait for the animation to complete
        setTimeout(() => {
            this.processFlipResult(isXP);
            this.flipsLeft--;
            this.updateUI();

            // Check for game over
            if (this.flipsLeft <= 0) {
                setTimeout(() => this.showGameOver(), 500);
            } else {
                this.isFlipping = false;
                this.flipButton.disabled = false;
            }
        }, 2000); // Match the animation duration
    }

    processFlipResult(isXP) {
        if (isXP) {
            this.xp++;
            this.resultElement.textContent = 'You got XP!';
        } else {
            this.money += 10;
            this.resultElement.textContent = 'You got Money!';
        }
        this.resultElement.classList.add('show');
    }

    updateUI() {
        // Update XP bar (cap at 100%)
        const xpPercentage = Math.min(this.xp, 100);
        this.xpBar.style.width = `${xpPercentage}%`;
        this.xpText.textContent = this.xp;

        // Update money counter
        this.moneyCounter.textContent = `💰${this.money}`;

        // Update flips left
        this.flipsLeftCounter.textContent = `Flips Left: ${this.flipsLeft}`;
    }

    showGameOver() {
        this.gameOverPopup.classList.remove('hidden');
    }

    resetGame() {
        // Reset game state
        this.xp = 0;
        this.money = 0;
        this.flipsLeft = 100;
        this.isFlipping = false;

        // Reset UI
        this.gameOverPopup.classList.add('hidden');
        this.resultElement.textContent = '';
        this.resultElement.classList.remove('show');
        this.coin.classList.remove('flipping-xp', 'flipping-money');
        this.flipButton.disabled = false;

        this.updateUI();
    }

    toggleDebug() {
        this.debugOverlay.classList.toggle('hidden');
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CoinTossGame();
});
