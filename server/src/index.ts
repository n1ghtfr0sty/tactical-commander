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
  type: 'melee' | 'ranged';
  health: number;
  maxHealth: number;
  targetX?: number;
  targetY?: number;
  state: 'idle' | 'moving' | 'attacking' | 'holding' | 'retreating' | 'flanking';
  attackTarget?: string;
}

type UnitType = 'melee' | 'ranged';

interface ArmyCommand {
  type: 'move' | 'attack' | 'hold' | 'retreat' | 'flank';
  target: { x: number; y: number };
  formations: { unitIds: string[]; offsetX: number; offsetY: number }[];
}

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 720;
const UNIT_SPEED = 50;
const ATTACK_RANGE_MELEE = 25;
const ATTACK_RANGE_RANGED = 150;
const RANGED_DAMAGE = 0.4;
const MELEE_DAMAGE = 0.6;
const UNIT_COUNT_PER_TYPE = 15;
const MAX_TEAMS = 8;

const TEAM_COLORS: number[] = [
  0x3366aa, 0xaa3333, 0x33aa55, 0xaaaa33,
  0xaa55aa, 0x55aaaa, 0xaa7744, 0x777777
];

const TEAM_POSITIONS: { x: number; y: number }[] = [
  { x: 80, y: 120 },   // Team 1 - top left
  { x: 1200, y: 120 }, // Team 2 - top right
  { x: 80, y: 600 },   // Team 3 - bottom left
  { x: 1200, y: 600 }, // Team 4 - bottom right
  { x: 640, y: 80 },   // Team 5 - top center
  { x: 640, y: 640 },  // Team 6 - bottom center
  { x: 200, y: 360 },  // Team 7 - mid left
  { x: 1080, y: 360 }, // Team 8 - mid right
];

let units: Unit[] = [];
let playerTeams: Map<string, number> = new Map();
let playersReady: Set<string> = new Set();
let gameStarted = false;

function startGameIfReady() {
  if (gameStarted || playersReady.size < 1) return;
  gameStarted = true;
  io.emit('gameStart');
}

function createArmy(team: number): Unit[] {
  const pos = TEAM_POSITIONS[team - 1];
  const units: Unit[] = [];
  
  for (let i = 0; i < UNIT_COUNT_PER_TYPE * 2; i++) {
    const type: UnitType = i < UNIT_COUNT_PER_TYPE ? 'melee' : 'ranged';
    const row = i % UNIT_COUNT_PER_TYPE;
    const col = Math.floor(i / UNIT_COUNT_PER_TYPE);
    
    units.push({
      id: `unit-${team}-${i}`,
      x: pos.x + (col * 30) + (Math.random() * 10),
      y: pos.y + (row * 25) + (Math.random() * 10),
      team,
      type,
      health: type === 'melee' ? 100 : 80,
      maxHealth: type === 'melee' ? 100 : 80,
      state: 'idle'
    });
  }
  
  return units;
}

function initGame() {
  units = [];
  for (let team = 1; team <= MAX_TEAMS; team++) {
    units.push(...createArmy(team));
  }
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

    const attackRange = unit.type === 'melee' ? ATTACK_RANGE_MELEE : ATTACK_RANGE_RANGED;
    const damage = unit.type === 'melee' ? MELEE_DAMAGE : RANGED_DAMAGE;
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
        if (enemy && enemyDist < attackRange) {
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
        if (enemyDist > attackRange * 1.5) {
          unit.state = 'moving';
          unit.targetX = enemy.x;
          unit.targetY = enemy.y;
        } else if (enemyDist > attackRange) {
          const dx = enemy.x - unit.x;
          const dy = enemy.y - unit.y;
          const moveX = (dx / enemyDist) * UNIT_SPEED * 0.5 * (1/60);
          const moveY = (dy / enemyDist) * UNIT_SPEED * 0.5 * (1/60);
          unit.x += moveX;
          unit.y += moveY;
        } else {
          enemy.health -= damage;
        }
        break;

      case 'holding':
        if (enemy) {
          const attackRange = unit.type === 'melee' ? ATTACK_RANGE_MELEE : ATTACK_RANGE_RANGED;
          if (enemyDist < attackRange) {
            const damage = unit.type === 'melee' ? MELEE_DAMAGE : RANGED_DAMAGE;
            enemy.health -= damage * 0.5;
          }
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
        } else {
          const pos = TEAM_POSITIONS[unit.team - 1];
          unit.targetX = pos.x;
          unit.targetY = pos.y;
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
  const usedTeams = new Set(playerTeams.values());
  let assignedTeam = 1;
  for (let i = 1; i <= MAX_TEAMS; i++) {
    if (!usedTeams.has(i)) {
      assignedTeam = i;
      break;
    }
  }
  playerTeams.set(socket.id, assignedTeam);
  const team = assignedTeam;
  
  socket.emit('init', { team, units, teamColors: TEAM_COLORS });

  socket.on('selectTeam', (data: { teamId: number }) => {
    const usedTeams = new Set(playerTeams.values());
    if (data.teamId >= 1 && data.teamId <= MAX_TEAMS && !usedTeams.has(data.teamId)) {
      playerTeams.set(socket.id, data.teamId);
      playersReady.add(socket.id);
      startGameIfReady();
    }
  });

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
    playersReady.delete(socket.id);
  });
});

const PORT = 8080;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
