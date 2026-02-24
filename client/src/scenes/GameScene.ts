import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

interface Unit {
  id: string;
  x: number;
  y: number;
  team: number;
  health: number;
}

interface GameState {
  units: Unit[];
}

type ArmyCommand = 'move' | 'attack' | 'hold' | 'retreat' | 'flank';

export class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private units: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private myTeam: number = 0;
  private commandButtons: Map<ArmyCommand, Phaser.GameObjects.Container> = new Map();
  private activeCommand: ArmyCommand | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.setupSocket();
    this.createCommandUI();
    this.createInputHandlers();
  }

  private setupSocket() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('init', (data: { team: number; units: Unit[] }) => {
      this.myTeam = data.team;
      this.spawnUnits(data.units);
    });

    this.socket.on('gameState', (state: GameState) => {
      this.syncUnits(state.units);
    });
  }

  private createCommandUI() {
    const commands: { cmd: ArmyCommand; label: string; color: number }[] = [
      { cmd: 'move', label: 'MOVE', color: 0x44ff44 },
      { cmd: 'attack', label: 'ATTACK', color: 0xff4444 },
      { cmd: 'hold', label: 'HOLD', color: 0xffaa00 },
      { cmd: 'retreat', label: 'RETREAT', color: 0x4488ff },
      { cmd: 'flank', label: 'FLANK', color: 0xaa44ff }
    ];

    const startX = 640;
    const startY = 40;
    const spacing = 110;

    commands.forEach((cmd, i) => {
      const x = startX + (i - 2) * spacing;
      const container = this.createCommandButton(x, startY, cmd.label, cmd.color, cmd.cmd);
      this.commandButtons.set(cmd.cmd, container);
    });

    const infoY = 80;
    this.add.text(640, infoY, 'Select a command, then click on map', { 
      font: '14px Arial', 
      color: '#aaaaaa' 
    }).setOrigin(0.5);
  }

  private createCommandButton(x: number, y: number, label: string, color: number, cmd: ArmyCommand): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 90, 30, color, 0.3);
    bg.setStrokeStyle(2, color);
    bg.setInteractive({ useHandCursor: true });

    const text = this.add.text(0, 0, label, { 
      font: '14px Arial', 
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([bg, text]);

    bg.on('pointerover', () => bg.setFillStyle(color, 0.6));
    bg.on('pointerout', () => {
      if (this.activeCommand !== cmd) {
        bg.setFillStyle(color, 0.3);
      }
    });
    bg.on('pointerdown', () => this.selectCommand(cmd));

    return container;
  }

  private selectCommand(cmd: ArmyCommand) {
    this.commandButtons.forEach((container, buttonCmd) => {
      const bg = container.list[0] as Phaser.GameObjects.Rectangle;
      const colors: Record<ArmyCommand, number> = {
        move: 0x44ff44,
        attack: 0xff4444,
        hold: 0xffaa00,
        retreat: 0x4488ff,
        flank: 0xaa44ff
      };
      bg.setFillStyle(colors[buttonCmd], buttonCmd === cmd ? 0.8 : 0.3);
    });

    this.activeCommand = cmd;
  }

  private createInputHandlers() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.handleMapClick(pointer.x, pointer.y);
      }
    });

    this.input.keyboard?.on('keydown-ONE', () => this.selectCommand('move'));
    this.input.keyboard?.on('keydown-TWO', () => this.selectCommand('attack'));
    this.input.keyboard?.on('keydown-THREE', () => this.selectCommand('hold'));
    this.input.keyboard?.on('keydown-FOUR', () => this.selectCommand('retreat'));
    this.input.keyboard?.on('keydown-FIVE', () => this.selectCommand('flank'));
  }

  private handleMapClick(x: number, y: number) {
    if (!this.activeCommand) return;

    const target = { x, y };

    const formations = this.getFormations();
    
    this.socket.emit('armyCommand', {
      type: this.activeCommand,
      target,
      formations
    });
  }

  private getFormations(): { unitIds: string[]; offsetX: number; offsetY: number }[] {
    const myUnits = Array.from(this.units.values())
      .filter(sprite => sprite.getData('team') === this.myTeam)
      .map(sprite => sprite.getData('unitId') as string);

    const squadSize = 6;
    const squads: { unitIds: string[]; offsetX: number; offsetY: number }[] = [];

    for (let i = 0; i < myUnits.length; i += squadSize) {
      const squadUnits = myUnits.slice(i, i + squadSize);
      const row = Math.floor(i / squadSize);
      const offsetX = (row % 3 - 1) * 60;
      const offsetY = Math.floor(row / 3) * 40;
      squads.push({ unitIds: squadUnits, offsetX, offsetY });
    }

    return squads;
  }

  private spawnUnits(units: Unit[]) {
    units.forEach(unit => this.createUnitSprite(unit));
  }

  private createUnitSprite(unit: Unit): Phaser.GameObjects.Sprite {
    const color = unit.team === 1 ? 0x4488ff : 0xff4444;
    const sprite = this.add.circle(0, 0, 6, color);
    sprite.setData('unitId', unit.id);
    sprite.setData('team', unit.team);
    this.units.set(unit.id, sprite as any);
    return sprite as any;
  }

  private syncUnits(serverUnits: Unit[]) {
    const serverIds = new Set(serverUnits.map(u => u.id));

    this.units.forEach((sprite, id) => {
      if (!serverIds.has(id)) {
        sprite.destroy();
        this.units.delete(id);
      }
    });

    serverUnits.forEach(unit => {
      const sprite = this.units.get(unit.id);
      if (sprite) {
        sprite.x = unit.x;
        sprite.y = unit.y;
      } else {
        this.createUnitSprite(unit);
      }
    });
  }
}
