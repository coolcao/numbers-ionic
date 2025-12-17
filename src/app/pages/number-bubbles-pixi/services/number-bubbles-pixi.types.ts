import { Container, Graphics, Text } from 'pixi.js';

export interface Bubble {
  index: number;
  size: number;
  duration: number;
  color: string;
  textColor: number;
  x: number;
  y: number;
  number: number;
  startTime: number;
  sprite?: Graphics;
  text?: Text;
  container?: Container;
  isExploding?: boolean;
  particles?: Particle[];
  isShaking?: boolean;
  shakeStartTime?: number;
}

export interface Particle {
  sprite: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  initialSize: number;
}
