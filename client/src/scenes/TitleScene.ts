import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

interface TeamInfo {
  id: number;
  name: string;
  color: number;
  players: number;
}

export class TitleScene extends Phaser.Scene {
  private socket!: Socket;
  private teams: TeamInfo[] = [];
  private selectedTeam: number | null = null;
  private waitingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(0x1a1510);
    this.drawBackground();
    this.setupSocket();
  }

  private drawBackground() {
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, 1280);
      const y = Phaser.Math.Between(0, 720);
      const alpha = Phaser.Math.FloatBetween(0.02, 0.05);
      this.add.circle(x, y, Phaser.Math.Between(2, 6), 0x8b7355, alpha);
    }

    const title = this.add.text(640, 120, 'TACTICAL COMMANDER', {
      font: '48px serif',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    title.setStroke('#4a3728', 4);

    this.add.text(640, 180, 'A Medieval Battle Simulator', {
      font: '20px serif',
      color: '#a89070'
    }).setOrigin(0.5);

    const instruction = this.add.text(640, 230, 'Select Your Faction', {
      font: '24px serif',
      color: '#c0b090'
    }).setOrigin(0.5);

    this.createTeamButtons();
    
    this.waitingText = this.add.text(640, 550, '', {
      font: '18px serif',
      color: '#a89070'
    }).setOrigin(0.5);
  }

  private createTeamButtons() {
    this.teams = [
      { id: 1, name: 'Royal Kingdom', color: 0x3366aa, players: 0 },
      { id: 2, name: 'Rebel Lords', color: 0xaa3333, players: 0 }
    ];

    const positions = [400, 880];

    this.teams.forEach((team, index) => {
      this.createTeamCard(positions[index], 350, team);
    });
  }

  private createTeamCard(x: number, y: number, team: TeamInfo) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 320, 180, 0x2a2318, 0.8);
    bg.setStrokeStyle(3, team.color);

    const shield = this.drawShield(0, -20, team.color);

    const name = this.add.text(0, 30, team.name, {
      font: '28px serif',
      color: '#d4af37',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const playerCount = this.add.text(0, 65, `Players: ${team.players}/4`, {
      font: '18px serif',
      color: '#a89070'
    }).setOrigin(0.5);

    container.add([bg, shield, name, playerCount]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setFillStyle(0x3a3328, 0.9);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x2a2318, 0.8);
    });
    bg.on('pointerdown', () => this.selectTeam(team.id));

    container.setSize(320, 180);
    container.setData('teamId', team.id);
  }

  private drawShield(x: number, y: number, color: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const shield = this.add.graphics();
    shield.fillStyle(color, 1);
    shield.beginPath();
    shield.moveTo(-30, -25);
    shield.lineTo(30, -25);
    shield.lineTo(30, 5);
    shield.lineTo(0, 35);
    shield.lineTo(-30, 5);
    shield.closePath();
    shield.fillPath();

    shield.lineStyle(3, 0xd4af37);
    shield.strokePath();

    const cross = this.add.graphics();
    cross.fillStyle(0xd4af37, 1);
    cross.fillRect(-20, -5, 40, 10);
    cross.fillRect(-8, -18, 16, 30);

    container.add([shield, cross]);
    return container;
  }

  private setupSocket() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('teamUpdate', (data: { teams: TeamInfo[] }) => {
      this.updateTeamDisplay(data.teams);
    });

    this.socket.on('gameStart', () => {
      this.scene.start('GameScene');
    });
  }

  private updateTeamDisplay(teams: TeamInfo[]) {
    this.teams = teams;
    
    this.children.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Container) {
        const teamId = child.getData('teamId');
        if (teamId) {
          const team = teams.find(t => t.id === teamId);
          if (team) {
            const bg = child.list[0] as Phaser.GameObjects.Rectangle;
            const playerCount = child.list[3] as Phaser.GameObjects.Text;
            playerCount.setText(`Players: ${team.players}/4`);
            
            if (this.selectedTeam === teamId) {
              bg.setStrokeStyle(5, 0xd4af37);
            }
          }
        }
      }
    });
  }

  private selectTeam(teamId: number) {
    this.socket.emit('selectTeam', { teamId });
    this.selectedTeam = teamId;
    this.waitingText.setText('Waiting for game to start...');
  }
}
