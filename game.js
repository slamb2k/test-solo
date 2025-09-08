const GRID_WIDTH = 21;
const GRID_HEIGHT = 12;
const PIXEL_SIZE = 4;
const CANVAS_WIDTH = 336;
const CANVAS_HEIGHT = 192;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.5;
const MAX_SPEED = 15;
const FOOD_POINTS = 10;

class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        
        this.ctx.imageSmoothingEnabled = false;
        
        this.gameState = {
            score: 0,
            highScore: this.loadHighScore(),
            speed: INITIAL_SPEED,
            foodPosition: null,
            state: 'MENU',
            foodEaten: 0
        };
        
        this.snake = {
            segments: [],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 }
        };
        
        this.lastMoveTime = 0;
        this.moveInterval = 1000 / this.gameState.speed;
        
        this.audioContext = null;
        this.soundEnabled = true;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateHighScoreDisplay();
        this.gameLoop();
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        document.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', () => {
                const key = button.dataset.key;
                this.handleKeyPress({ key, preventDefault: () => {} });
            });
        });
        
        let touchStartX = 0;
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            e.preventDefault();
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                    this.handleKeyPress({ key: 'ArrowRight', preventDefault: () => {} });
                } else {
                    this.handleKeyPress({ key: 'ArrowLeft', preventDefault: () => {} });
                }
            } else {
                if (dy > 0) {
                    this.handleKeyPress({ key: 'ArrowDown', preventDefault: () => {} });
                } else {
                    this.handleKeyPress({ key: 'ArrowUp', preventDefault: () => {} });
                }
            }
            
            e.preventDefault();
        });
    }
    
    handleKeyPress(e) {
        const key = e.key;
        
        switch(this.gameState.state) {
            case 'MENU':
                if (key === 'Enter') {
                    this.startGame();
                }
                break;
                
            case 'PLAYING':
                if (key === ' ' || key === 'Space') {
                    this.pauseGame();
                    e.preventDefault();
                } else if (key === 'ArrowUp' || key === 'w' || key === 'W') {
                    if (this.snake.direction.y === 0) {
                        this.snake.nextDirection = { x: 0, y: -1 };
                    }
                    e.preventDefault();
                } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
                    if (this.snake.direction.y === 0) {
                        this.snake.nextDirection = { x: 0, y: 1 };
                    }
                    e.preventDefault();
                } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
                    if (this.snake.direction.x === 0) {
                        this.snake.nextDirection = { x: -1, y: 0 };
                    }
                    e.preventDefault();
                } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
                    if (this.snake.direction.x === 0) {
                        this.snake.nextDirection = { x: 1, y: 0 };
                    }
                    e.preventDefault();
                }
                break;
                
            case 'PAUSED':
                if (key === ' ' || key === 'Space') {
                    this.resumeGame();
                    e.preventDefault();
                }
                break;
                
            case 'GAME_OVER':
                if (key === 'Enter') {
                    this.resetToMenu();
                }
                break;
        }
    }
    
    startGame() {
        this.gameState.state = 'PLAYING';
        this.gameState.score = 0;
        this.gameState.speed = INITIAL_SPEED;
        this.gameState.foodEaten = 0;
        this.moveInterval = 1000 / this.gameState.speed;
        
        this.snake.segments = [
            { x: 10, y: 6 },
            { x: 9, y: 6 },
            { x: 8, y: 6 }
        ];
        this.snake.direction = { x: 1, y: 0 };
        this.snake.nextDirection = { x: 1, y: 0 };
        
        this.spawnFood();
        this.hideAllScreens();
        document.getElementById('score-display').classList.add('visible');
        this.updateScoreDisplay();
        
        this.playSound(200, 50);
    }
    
    pauseGame() {
        this.gameState.state = 'PAUSED';
        this.showScreen('pause-screen');
    }
    
    resumeGame() {
        this.gameState.state = 'PLAYING';
        this.hideAllScreens();
    }
    
    gameOver() {
        this.gameState.state = 'GAME_OVER';
        
        if (this.gameState.score > this.gameState.highScore) {
            this.gameState.highScore = this.gameState.score;
            this.saveHighScore();
            this.playSound(800, 100);
            setTimeout(() => this.playSound(1000, 100), 150);
            setTimeout(() => this.playSound(1200, 150), 300);
        } else {
            this.playSound(400, 100);
            setTimeout(() => this.playSound(200, 100), 150);
            setTimeout(() => this.playSound(100, 200), 300);
        }
        
        document.getElementById('final-score').textContent = this.gameState.score;
        document.getElementById('high-score-display').textContent = this.gameState.highScore;
        this.showScreen('game-over-screen');
        document.getElementById('score-display').classList.remove('visible');
    }
    
    resetToMenu() {
        this.gameState.state = 'MENU';
        this.showScreen('menu-screen');
        this.updateHighScoreDisplay();
    }
    
    spawnFood() {
        let newPosition;
        do {
            newPosition = {
                x: Math.floor(Math.random() * GRID_WIDTH),
                y: Math.floor(Math.random() * GRID_HEIGHT)
            };
        } while (this.snake.segments.some(segment => 
            segment.x === newPosition.x && segment.y === newPosition.y
        ));
        
        this.gameState.foodPosition = newPosition;
    }
    
    update(currentTime) {
        if (this.gameState.state !== 'PLAYING') return;
        
        if (currentTime - this.lastMoveTime >= this.moveInterval) {
            this.lastMoveTime = currentTime;
            this.moveSnake();
        }
    }
    
    moveSnake() {
        this.snake.direction = this.snake.nextDirection;
        
        const head = { ...this.snake.segments[0] };
        head.x += this.snake.direction.x;
        head.y += this.snake.direction.y;
        
        if (head.x < 0 || head.x >= GRID_WIDTH || 
            head.y < 0 || head.y >= GRID_HEIGHT) {
            this.gameOver();
            return;
        }
        
        for (let i = 1; i < this.snake.segments.length; i++) {
            if (head.x === this.snake.segments[i].x && 
                head.y === this.snake.segments[i].y) {
                this.gameOver();
                return;
            }
        }
        
        this.snake.segments.unshift(head);
        
        if (head.x === this.gameState.foodPosition.x && 
            head.y === this.gameState.foodPosition.y) {
            this.eatFood();
        } else {
            this.snake.segments.pop();
        }
    }
    
    eatFood() {
        const lengthBonus = this.snake.segments.length;
        const speedBonus = Math.floor(this.gameState.speed) * 2;
        this.gameState.score += FOOD_POINTS + lengthBonus + speedBonus;
        this.gameState.foodEaten++;
        
        if (this.gameState.foodEaten % 5 === 0 && this.gameState.speed < MAX_SPEED) {
            this.gameState.speed = Math.min(this.gameState.speed + SPEED_INCREMENT, MAX_SPEED);
            this.moveInterval = 1000 / this.gameState.speed;
        }
        
        this.spawnFood();
        this.updateScoreDisplay();
        this.playSound(200, 50);
    }
    
    render() {
        this.ctx.fillStyle = '#9BC53D';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        if (this.gameState.state === 'PLAYING' || this.gameState.state === 'PAUSED') {
            this.ctx.fillStyle = '#000000';
            this.snake.segments.forEach(segment => {
                this.drawPixel(segment.x, segment.y);
            });
            
            if (this.gameState.foodPosition) {
                this.drawFood(this.gameState.foodPosition.x, this.gameState.foodPosition.y);
            }
        }
    }
    
    drawPixel(x, y) {
        const pixelX = x * PIXEL_SIZE * 4;
        const pixelY = y * PIXEL_SIZE * 4;
        this.ctx.fillRect(pixelX, pixelY, PIXEL_SIZE * 4, PIXEL_SIZE * 4);
    }
    
    drawFood(x, y) {
        const pixelX = x * PIXEL_SIZE * 4;
        const pixelY = y * PIXEL_SIZE * 4;
        const size = PIXEL_SIZE * 4;
        
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(pixelX + size * 0.25, pixelY + size * 0.25, size * 0.5, size * 0.5);
    }
    
    updateScoreDisplay() {
        document.getElementById('score').textContent = this.gameState.score;
        document.getElementById('high-score').textContent = this.gameState.highScore;
    }
    
    updateHighScoreDisplay() {
        document.getElementById('high-score').textContent = this.gameState.highScore;
    }
    
    showScreen(screenId) {
        this.hideAllScreens();
        document.getElementById(screenId).classList.add('active');
        document.getElementById('overlay').style.display = 'flex';
    }
    
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('overlay').style.display = 'none';
    }
    
    loadHighScore() {
        const saved = localStorage.getItem('snakeHighScore');
        return saved ? parseInt(saved) : 0;
    }
    
    saveHighScore() {
        localStorage.setItem('snakeHighScore', this.gameState.highScore.toString());
    }
    
    playSound(frequency, duration) {
        if (!this.soundEnabled) return;
        
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration / 1000);
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
    
    gameLoop(currentTime) {
        this.update(currentTime);
        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
});