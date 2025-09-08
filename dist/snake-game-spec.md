# Nokia 5110 Snake Game - HTML Implementation Specification

## 1. Game Overview

### 1.1 Concept
A faithful recreation of the classic Snake game from Nokia 5110 mobile phones, implemented using HTML5, CSS3, and vanilla JavaScript.

### 1.2 Core Gameplay
- Player controls a snake that moves continuously in one of four directions
- Snake grows by eating food items that appear randomly on the game field
- Game ends when snake collides with walls or itself
- Score increases with each food item consumed

## 2. Visual Design

### 2.1 Display Specifications
- **Resolution**: 84x48 pixels (matching Nokia 5110 LCD)
- **Color Scheme**: Monochrome (black pixels on green-tinted background)
- **Pixel Size**: Scaled up for modern displays (e.g., 8x8 physical pixels per game pixel)
- **Aspect Ratio**: 1.75:1 (original Nokia 5110 ratio)

### 2.2 Visual Elements
- **Snake**: Solid black squares forming a continuous line
- **Food**: Single black square, slightly different pattern (e.g., smaller square or dot)
- **Walls**: Solid border around play area
- **Score Display**: Pixelated font showing current score
- **Game Over Screen**: Centered text with final score

### 2.3 Aesthetic Requirements
- Authentic LCD pixel grid effect
- Optional scanline effect for retro feel
- Green-tinted background (#9BC53D or similar)
- Black pixels (#000000)

## 3. Game Mechanics

### 3.1 Snake Movement
- **Speed**: Initial speed of 5 moves per second
- **Speed Increase**: +0.5 moves/second every 5 food items
- **Maximum Speed**: 15 moves per second
- **Direction**: Can only turn 90 degrees (no 180-degree turns)
- **Grid Size**: 21x12 game units (fitting within 84x48 pixel display)

### 3.2 Controls
- **Arrow Keys**: Primary control method
  - ↑: Move up
  - ↓: Move down
  - ←: Move left
  - →: Move right
- **WASD Keys**: Alternative control scheme
  - W: Move up
  - S: Move down
  - A: Move left
  - D: Move right
- **Mobile Touch**: Swipe gestures for mobile devices
- **Spacebar**: Pause/Resume game
- **Enter**: Start new game

### 3.3 Scoring System
- **Basic Food**: 10 points
- **Length Bonus**: 1 point per segment when eating food
- **Speed Bonus**: Current speed level × 2 points per food
- **High Score**: Persistent storage using localStorage

### 3.4 Collision Rules
- **Wall Collision**: Immediate game over
- **Self Collision**: Game over when head touches any body segment
- **Food Collection**: Detected when snake head occupies same position as food

## 4. Game States

### 4.1 State Machine
1. **MENU**: Initial state showing "Press ENTER to Start"
2. **PLAYING**: Active gameplay
3. **PAUSED**: Gameplay suspended, "PAUSED" overlay
4. **GAME_OVER**: Shows final score and restart prompt

### 4.2 State Transitions
- MENU → PLAYING: Press Enter
- PLAYING → PAUSED: Press Spacebar
- PAUSED → PLAYING: Press Spacebar
- PLAYING → GAME_OVER: Collision detected
- GAME_OVER → MENU: Press Enter

## 5. Technical Implementation

### 5.1 HTML Structure
```html
<div id="game-container">
  <div id="lcd-screen">
    <canvas id="game-canvas"></canvas>
    <div id="score-display"></div>
  </div>
  <div id="phone-buttons">
    <!-- Optional visual button representation -->
  </div>
</div>
```

### 5.2 Core Components
- **Game Engine**: 60 FPS update loop with frame-independent movement
- **Renderer**: Canvas 2D context for pixel-perfect rendering
- **Input Handler**: Event listeners for keyboard and touch input
- **State Manager**: Handles game state transitions
- **Score Manager**: Tracks and persists high scores
- **Sound Manager**: Optional beep sounds for food and game over

### 5.3 Data Structures
```javascript
// Snake representation
snake = {
  segments: [{x, y}, ...],  // Head at index 0
  direction: {x, y},        // Unit vector
  nextDirection: {x, y}     // Buffered input
}

// Game state
gameState = {
  score: 0,
  highScore: 0,
  speed: 5,
  foodPosition: {x, y},
  state: 'MENU'
}
```

## 6. Performance Requirements

### 6.1 Target Metrics
- **Frame Rate**: Stable 60 FPS
- **Input Latency**: < 16ms response time
- **Memory Usage**: < 10MB total
- **Load Time**: < 1 second

### 6.2 Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 7. Audio (Optional)

### 7.1 Sound Effects
- **Eat Food**: Short beep (200Hz, 50ms)
- **Game Over**: Descending tone (400Hz → 100Hz, 200ms)
- **High Score**: Victory fanfare (3 ascending beeps)

### 7.2 Implementation
- Web Audio API for generation
- Optional mute button
- Volume stored in localStorage

## 8. Additional Features

### 8.1 Difficulty Levels
- **Easy**: Slower speed, no walls
- **Normal**: Standard speed, walls enabled
- **Hard**: Faster initial speed, faster acceleration

### 8.2 Game Modes
- **Classic**: Original Nokia 5110 rules
- **Endless**: No walls, wrap-around edges
- **Maze**: Pre-defined obstacle patterns

### 8.3 UI Enhancements
- **Pause Menu**: Shows current score and options
- **Settings**: Difficulty, sound toggle, control scheme
- **Statistics**: Games played, average score, best streak

## 9. Development Phases

### Phase 1: Core Gameplay (Week 1)
- Basic snake movement
- Food spawning and collection
- Collision detection
- Score tracking

### Phase 2: Visual Polish (Week 2)
- Nokia 5110 LCD effect
- Proper scaling and responsiveness
- Game states and menus

### Phase 3: Features & Polish (Week 3)
- High score persistence
- Sound effects
- Mobile support
- Performance optimization

## 10. Testing Requirements

### 10.1 Functional Tests
- All control schemes work correctly
- Snake grows properly when eating food
- Collision detection is pixel-perfect
- Score calculation is accurate
- Game states transition correctly

### 10.2 Performance Tests
- Maintains 60 FPS on target devices
- No memory leaks during extended play
- Responsive on mobile devices

### 10.3 Compatibility Tests
- Works on all target browsers
- Scales properly on different screen sizes
- Touch controls work on mobile devices

## 11. Deliverables

1. **index.html**: Main game file
2. **style.css**: Nokia 5110 styling
3. **game.js**: Core game logic
4. **README.md**: Setup and play instructions
5. **Assets**: Any sprite sheets or fonts needed

## 12. Success Criteria

- Gameplay feels authentic to original Nokia 5110 Snake
- Runs smoothly on modern devices
- Intuitive controls for both desktop and mobile
- Addictive "one more game" quality
- Clean, maintainable code structure