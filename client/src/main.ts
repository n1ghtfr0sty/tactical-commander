import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game',
  backgroundColor: '#1a1510',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [TitleScene, GameScene]
};

new Phaser.Game(config);
