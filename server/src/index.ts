import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

interface Unit {
  id: string;
  x: number;
  y: number;
  team: number;
  health: number;
  targetX?: number;
  targetY?: number;
  state: 'idle' | 'moving' | 'attacking' | 'holding' | 'retreating' | 'flanking';
  attackTarget?: string;
}

interface ArmyCommand {
  type: 'move' | 'attack' | 'hold' | 'retreat' | 'flank';
  target: { x: number; y: number };
  formations: { unitIds: string[]; offsetX: number; offsetY: number }[];
}

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 720;
const UNIT_SPEED = 60;
const ATTACK_RANGE = 80;
const UNIT_COUNT = 30;

let units: Unit[] = [];
let playerTeams: Map<string, number> = new Map();

function createArmy(team: number): Unit[] {
  const startX = team === 1 ? 100 : MAP_WIDTH - 100;
  const startY = MAP_HEIGHT / 2 + (team === 1 ? -100 : 100);
  
  return Array.from({ length: UNIT_COUNT }, (_, i) => ({
    id: `unit-${team}-${i}`,
    x: startX + (i % 6) * 20 + Math.random() * 10,
    y: startY + Math.floor(i / 6) * 20 + Math.random() * 10,
    team,
    health: 100,
    state: 'idle'
  }));
}

function initGame() {
  units = [
    ...createArmy(1),
    ...createArmy(2)
  ];
}

function findNearestEnemy(unit: Unit): Unit | null {
  let nearest: Unit | null = null;
  let nearestDist = Infinity;

  units.forEach(other => {
    if (other.team !== unit.team && other.health > 0) {
      const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }
  });

  return nearest;
}

function processCommands() {
  units.forEach(unit => {
    if (unit.health <= 0) return;

    const enemy = findNearestEnemy(unit);
    const enemyDist = enemy ? Math.hypot(enemy.x - unit.x, enemy.y - unit.y) : Infinity;

    switch (unit.state) {
      case 'moving':
      case 'flanking':
        if (unit.targetX !== undefined && unit.targetY !== undefined) {
          const dx = unit.targetX - unit.x;
          const dy = unit.targetY - unit.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist > 5) {
            const moveX = (dx / dist) * UNIT_SPEED * (1/60);
            const moveY = (dy / dist) * UNIT_SPEED * (1/60);
            unit.x = Math.max(10, Math.min(MAP_WIDTH - 10, unit.x + moveX));
            unit.y = Math.max(10, Math.min(MAP_HEIGHT - 10, unit.y + moveY));
          } else {
            unit.state = 'idle';
            unit.targetX = undefined;
            unit.targetY = undefined;
          }
        }
        if (enemy && enemyDist < ATTACK_RANGE) {
          unit.state = 'attacking';
          unit.attackTarget = enemy.id;
        }
        break;

      case 'attacking':
        if (!enemy || enemy.health <= 0) {
          unit.state = 'idle';
          unit.attackTarget = undefined;
          break;
        }
        if (enemyDist > ATTACK_RANGE * 1.5) {
          unit.state = 'moving';
          unit.targetX = enemy.x;
          unit.targetY = enemy.y;
        } else if (enemyDist > ATTACK_RANGE) {
          const dx = enemy.x - unit.x;
          const dy = enemy.y - unit.y;
          const moveX = (dx / enemyDist) * UNIT_SPEED * 0.5 * (1/60);
          const moveY = (dy / enemyDist) * UNIT_SPEED * 0.5 * (1/60);
          unit.x += moveX;
          unit.y += moveY;
        } else {
          enemy.health -= 0.5;
        }
        break;

      case 'holding':
        if (enemy && enemyDist < ATTACK_RANGE) {
          enemy.health -= 0.3;
        }
        break;

      case 'retreating':
        if (unit.targetX !== undefined && unit.targetY !== undefined) {
          const dx = unit.targetX - unit.x;
          const dy = unit.targetY - unit.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist > 10) {
            const moveX = (dx / dist) * UNIT_SPEED * 1.2 * (1/60);
            const moveY = (dy / dist) * UNIT_SPEED * 1.2 * (1/60);
            unit.x = Math.max(10, Math.min(MAP_WIDTH - 10, unit.x + moveX));
            unit.y = Math.max(10, Math.min(MAP_HEIGHT - 10, unit.y + moveY));
          } else {
            unit.state = 'idle';
            unit.targetX = undefined;
            unit.targetY = undefined;
          }
        } else if (unit.team === 1) {
          unit.targetX = 50;
          unit.targetY = MAP_HEIGHT / 2;
        } else {
          unit.targetX = MAP_WIDTH - 50;
          unit.targetY = MAP_HEIGHT / 2;
        }
        break;
    }
  });

  units = units.filter(u => u.health > 0);
}

initGame();

setInterval(() => {
  processCommands();
  io.emit('gameState', { units });
}, 1000 / 60);

io.on('connection', (socket) => {
  playerTeams.set(socket.id, playerTeams.size % 2 + 1);
  const team = playerTeams.get(socket.id)!;
  
  socket.emit('init', { team, units });

  socket.on('armyCommand', (cmd: ArmyCommand) => {
    const playerTeam = playerTeams.get(socket.id) || 1;

    cmd.formations.forEach(formation => {
      formation.unitIds.forEach(unitId => {
        const unit = units.find(u => u.id === unitId && u.team === playerTeam);
        if (!unit) return;

        switch (cmd.type) {
          case 'move':
            unit.state = 'moving';
            unit.targetX = cmd.target.x + formation.offsetX;
            unit.targetY = cmd.target.y + formation.offsetY;
            break;

          case 'attack':
            unit.state = 'attacking';
            break;

          case 'hold':
            unit.state = 'holding';
            unit.targetX = unit.x;
            unit.targetY = unit.y;
            break;

          case 'retreat':
            unit.state = 'retreating';
            break;

          case 'flank':
            unit.state = 'flanking';
            const flankOffset = playerTeam === 1 ? 150 : -150;
            unit.targetX = cmd.target.x + flankOffset;
            unit.targetY = cmd.target.y + formation.offsetY;
            break;
        }
      });
    });
  });

  socket.on('disconnect', () => {
    playerTeams.delete(socket.id);
  });
});

const PORT = 8080;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
