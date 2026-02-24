# AGENTS.md - Tactical Commander

## Project Overview

Web-based multiplayer RTS game with high-level army commands. Built with Phaser 3 (client) and Node.js + Socket.io (server).

## Build Commands

### Root Commands
```bash
npm run dev              # Start both client and server
npm run build           # Build client and server for production
```

### Client Commands (client/)
```bash
npm run dev             # Start Vite dev server (port 5173)
npm run build          # TypeScript compile + Vite build
npm run preview         # Preview production build
npx tsc --noEmit        # TypeScript type checking only
```

### Server Commands (server/)
```bash
npm run dev             # Start with hot reload (tsx watch)
npm run build           # TypeScript compile to dist/
npm run start           # Run production server (node dist/index.js)
npx tsc --noEmit        # TypeScript type checking only
```

### Running a Single Test
This project currently has no test framework. To add tests:
```bash
# Install test framework (example with Vitest)
npm install -D vitest

# Run tests
npx vitest

# Run single test file
npx vitest run src/scenes/GameScene.test.ts
```

## Code Style Guidelines

### General Principles
- Keep code simple and readable
- Avoid premature abstraction
- Write self-documenting code with clear naming
- No comments unless explaining complex business logic

### TypeScript

#### Types
- Always use explicit types for function parameters and return values
- Use interfaces for objects, type aliases for unions/literals
- Prefer `const` over `let`; avoid `var`
- Use optional properties (`?`) when appropriate

```typescript
// Good
interface Unit {
  id: string;
  x: number;
  y: number;
  team: number;
  health: number;
}

type ArmyCommand = 'move' | 'attack' | 'hold' | 'retreat' | 'flank';

// Avoid
const units = [];  // Never use any
```

#### Strict Mode
- All TypeScript compilation uses `strict: true`
- Do not use `any` type; use `unknown` if type is truly unknown
- Enable `noUnusedLocals` and `noUnusedParameters`

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `game-scene.ts`, `socket-handler.ts` |
| Classes | PascalCase | `GameScene`, `UnitManager` |
| Interfaces | PascalCase | `Unit`, `GameState` |
| Types | PascalCase | `ArmyCommand` |
| Functions | camelCase | `createArmy()`, `processCommands()` |
| Variables | camelCase | `playerCount`, `activeCommand` |
| Constants | UPPER_SNAKE | `MAP_WIDTH`, `UNIT_SPEED` |
| Private fields | _camelCase (optional) | `_socket`, `_units` |

### Imports

- Use ES module syntax (`import`/`export`)
- Group imports: external libraries first, then project modules
- Use absolute imports for project code

```typescript
// External
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

// Internal
import { GameScene } from './scenes/GameScene';
```

### Error Handling

- Server: Log errors to console with context
- Client: Handle socket events with proper type guards
- Always validate data from network (client trust nothing from server)

```typescript
// Server error handling
socket.on('armyCommand', (cmd: ArmyCommand) => {
  try {
    // validate command
    if (!cmd.type || !cmd.target) {
      console.warn('Invalid command received:', cmd);
      return;
    }
    // process command
  } catch (err) {
    console.error('Error processing command:', err);
  }
});

// Client socket handling
socket.on('gameState', (state: unknown) => {
  if (!state || !Array.isArray((state as GameState).units)) return;
  this.syncUnits(state.units);
});
```

### Game Code Conventions

#### Client (Phaser)
- Use Phaser's built-in scene management
- Keep game logic in scene classes
- Use `setData`/`getData` for storing unit metadata on sprites
- Use `Phaser.Math` for vector math

```typescript
// Good - store unit ID on sprite
sprite.setData('unitId', unit.id);
sprite.setData('team', unit.team);

// Good - use Phaser math
const dist = Phaser.Math.Distance.Between(x, y, sprite.x, sprite.y);
```

#### Server (Node.js)
- Run game loop at fixed tick rate (60fps = ~16ms)
- Use `setInterval` for game tick, not game logic
- Send full game state to clients each tick
- Validate all socket input before processing

```typescript
// Game loop
setInterval(() => {
  processCommands();
  io.emit('gameState', { units });
}, 1000 / 60);
```

### Formatting

- Use 2 spaces for indentation
- Use semicolons
- Max line length: 100 characters
- Use template literals over string concatenation
- Use arrow functions for callbacks

```typescript
// Good
const unitId = `unit-${team}-${index}`;
const squads = myUnits.map(u => u.id);

// Avoid
var unitId = "unit-" + team + "-" + index;
```

### Configuration

- Store magic numbers as named constants at top of file
- Use ALL_CAPS for configuration constants
- Port configuration in respective package.json scripts

```typescript
const MAP_WIDTH = 1280;
const MAP_HEIGHT = 720;
const UNIT_SPEED = 60;
const ATTACK_RANGE = 80;
```

### File Organization

```
client/
  src/
    main.ts           # Entry point, Phaser config
    scenes/
      GameScene.ts    # Main game scene
    index.html        # HTML template

server/
  src/
    index.ts          # Express + Socket.io server
```

### Git Conventions

- Use meaningful commit messages
- Commit related changes together
- Do not commit: node_modules, dist, .env files

### Code Change Workflow

When making code changes:
1. Create a `Code_Changes_YYYY-MM-DD.md` file in the root directory
2. Document changes in the file (feature added, bug fixed, etc.)
3. Commit changes to the repository with a descriptive message

### Dependencies

- Check package.json before adding new dependencies
- Verify versions are compatible (check existing versions)
- Client: Phaser 3, Socket.io-client
- Server: Express, Socket.io

## Development Workflow

1. Start dev server: `npm run dev` (runs both client and server)
2. Client: http://localhost:5173
3. Server: http://localhost:8080
4. Test multiplayer by opening multiple browser tabs

## Common Tasks

### Adding a New Command
1. Add command type to `ArmyCommand` type in both client and server
2. Add button in client's `createCommandUI()`
3. Add keyboard shortcut in `createInputHandlers()`
4. Add command handler in server's socket listener
5. Add command logic in `processCommands()`

### Adding Unit Types
1. Add unit type field to Unit interface
2. Update unit creation to include type
3. Update rendering to show different visuals per type
4. Update combat logic for unit-specific behavior
