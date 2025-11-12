"use strict";
// Coin Toss Game Logic
class CoinTossGame {
    constructor() {
        this.coin = document.getElementById('coin');
        this.flipButton = document.getElementById('flipButton');
        this.resultElement = document.getElementById('result');
        this.headsCountElement = document.getElementById('headsCount');
        this.tailsCountElement = document.getElementById('tailsCount');
        this.totalFlipsElement = document.getElementById('totalFlips');
        this.stats = {
            heads: 0,
            tails: 0,
            total: 0
        };
        this.isFlipping = false;
        this.initialize();
    }
    initialize() {
        this.flipButton.addEventListener('click', () => this.flipCoin());
    }
    flipCoin() {
        if (this.isFlipping) {
            return;
        }
        this.isFlipping = true;
        this.flipButton.disabled = true;
        this.resultElement.textContent = '';
        this.resultElement.classList.remove('show');
        // Remove any existing animation classes
        this.coin.classList.remove('flipping-heads', 'flipping-tails');
        // Randomly determine the outcome
        const isHeads = Math.random() < 0.5;
        // Force a reflow to restart the animation
        void this.coin.offsetWidth;
        // Add the appropriate animation class
        if (isHeads) {
            this.coin.classList.add('flipping-heads');
        }
        else {
            this.coin.classList.add('flipping-tails');
        }
        // Wait for the animation to complete
        setTimeout(() => {
            this.showResult(isHeads);
            this.updateStats(isHeads);
            this.isFlipping = false;
            this.flipButton.disabled = false;
        }, 2000); // Match the animation duration
    }
    showResult(isHeads) {
        const result = isHeads ? 'HEADS' : 'TAILS';
        this.resultElement.textContent = `You got ${result}!`;
        this.resultElement.classList.add('show');
    }
    updateStats(isHeads) {
        if (isHeads) {
            this.stats.heads++;
        }
        else {
            this.stats.tails++;
        }
        this.stats.total++;
        this.headsCountElement.textContent = this.stats.heads.toString();
        this.tailsCountElement.textContent = this.stats.tails.toString();
        this.totalFlipsElement.textContent = this.stats.total.toString();
    }
}
// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CoinTossGame();
});
