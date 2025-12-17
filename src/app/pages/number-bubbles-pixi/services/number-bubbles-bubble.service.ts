import { Injectable } from '@angular/core';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { Bubble, Particle } from './number-bubbles-pixi.types';

@Injectable({ providedIn: 'root' })
export class NumberBubblesBubbleService {
  // Movement and lifecycle update for all bubbles; also updates particles and removes finished containers
  updateBubbles(
    app: Application,
    bubbles: Bubble[],
    overlay?: Graphics,
    uiContainer?: Container,
  ): Bubble[] {
    const currentTime = Date.now();
    let hasHighlight = false;
    let highlightBubble: Bubble | undefined;

    const activeBubbles = bubbles.filter((bubble) => {
      if (bubble.isExploding) {
        if (bubble.particles) {
          bubble.particles.forEach((p) => {
            p.sprite.x += p.vx;
            p.sprite.y += p.vy;
            p.vy += 0.3; // gravity
            p.vx *= 0.98; // air drag
            p.vy *= 0.98;
            p.life--;
            const lifeRatio = p.life / p.maxLife;
            p.sprite.alpha = lifeRatio;
            const scale = lifeRatio * 0.99;
            p.sprite.scale.set(scale);
          });
          bubble.particles = bubble.particles.filter((p) => p.life > 0);
          return bubble.particles.length > 0;
        }
        return false;
      }

      // falling position
      const elapsed = (currentTime - bubble.startTime) / 1000;
      const progress = elapsed / bubble.duration;

      if (progress >= 1) {
        if (bubble.container && bubble.container.parent) {
          bubble.container.parent.removeChild(bubble.container);
        }
        return false;
      }

      const startY = -bubble.size;
      const endY = app.renderer.height + bubble.size;
      bubble.y = startY + (endY - startY) * progress;

      if (bubble.container) {
        bubble.container.y = bubble.y;

        if (bubble.isShaking && bubble.shakeStartTime) {
          const e = Date.now() - bubble.shakeStartTime;
          const p = e / 500;
          if (p < 1) {
            const shakeIntensity = 12 * (1 - p);
            const shakeFrequency = 25;
            const offsetX =
              Math.sin(e * shakeFrequency * 0.01) * shakeIntensity;
            const offsetY =
              Math.cos(e * shakeFrequency * 0.01) * shakeIntensity * 0.6;
            bubble.container.x = bubble.x + offsetX;
            bubble.container.y = bubble.y + offsetY;
          } else {
            bubble.container.x = bubble.x;
            bubble.container.y = bubble.y;
          }
        }
      }

      if (bubble.isHighlight && bubble.container) {
        const bullseye = bubble.container.getChildByName('bullseye');
        const hand = bubble.container.getChildByName('hand');
        const t = Date.now();
        if (bullseye) {
          const scale = 1 + Math.sin(t / 200) * 0.1;
          bullseye.scale.set(scale);
          bullseye.alpha = 0.8 + Math.sin(t / 300) * 0.2;
          bullseye.rotation += 0.02;
        }
      }

      if (bubble.isHighlight) {
        hasHighlight = true;
        highlightBubble = bubble;
      }

      return true;
    });

    if (overlay) {
      overlay.clear();

      if (hasHighlight && highlightBubble) {
        const width = app.renderer.width;
        const height = app.renderer.height;

        // Always draw tint
        overlay.rect(0, 0, width, height);
        overlay.fill({ color: 0x000000, alpha: 0.7 });

        const radius = highlightBubble.size / 2 + 20;
        overlay.circle(highlightBubble.x, highlightBubble.y, radius);
        overlay.cut();
      }
    }

    if (uiContainer) {
      let hand = uiContainer.getChildByName('tutorialHand') as Text;

      if (hasHighlight && highlightBubble) {
        if (!hand) {
          hand = new Text({
            text: '👆',
            style: {
              fontSize: 60,
            },
          });
          hand.name = 'tutorialHand';
          hand.anchor.set(0.5, 0); // top-center
          uiContainer.addChild(hand);
        }

        hand.visible = true;
        const radius = highlightBubble.size / 2;
        // Position relative to screen since uiContainer is global (child of gameStage)
        // bubble x/y are relative to bubbleContainer?
        // bubbleContainer is at 0,0 usually.

        hand.rotation = -0.5;
        hand.x = highlightBubble.x + 15;
        hand.y = highlightBubble.y + 5 + Math.sin(Date.now() / 300) * 10;
      } else {
        if (hand) {
          hand.visible = false;
        }
      }
    }

    return activeBubbles;
  }

  // Create bubble display objects and attach to container; mutates bubble to set refs
  createBubbleSprite(stageBubbleContainer: Container, bubble: Bubble): void {
    const container = new Container();
    container.position.set(bubble.x, bubble.y);

    const radius = bubble.size / 2;

    if (bubble.isHighlight) {
      // Bullseye Effect
      const bullseye = new Container();
      bullseye.name = 'bullseye';

      const ring1 = new Graphics();
      ring1.circle(0, 0, radius * 1.15);
      ring1.stroke({ color: 0xff5733, width: 4, alpha: 0.8 }); // Red/Orange
      bullseye.addChild(ring1);

      const ring2 = new Graphics();
      ring2.circle(0, 0, radius * 0.9);
      ring2.stroke({ color: 0xffffff, width: 3, alpha: 0.6 });
      bullseye.addChild(ring2);

      // Add crosshair lines? optional.
      const crosshair = new Graphics();
      crosshair.moveTo(-radius * 1.4, 0);
      crosshair.lineTo(radius * 1.4, 0);
      crosshair.moveTo(0, -radius * 1.4);
      crosshair.lineTo(0, radius * 1.4);
      crosshair.stroke({ color: 0xff5733, width: 2, alpha: 0.5 });
      bullseye.addChild(crosshair);

      container.addChild(bullseye);
    }

    const graphics = new Graphics();

    // shadow
    graphics.circle(2, 2, radius);
    graphics.fill({ color: 0x000000, alpha: 0.2 });

    // layered gradient body
    for (let i = radius; i >= 0; i -= radius * 0.1) {
      const alpha = 0.9 * (1 - (radius - i) / radius);
      const color = this.adjustColorBrightness(
        bubble.color,
        ((radius - i) / radius) * 30,
      );
      graphics.circle(0, 0, i);
      graphics.fill({ color, alpha });
    }

    // border
    graphics.circle(0, 0, radius);
    graphics.stroke({ color: 0xffffff, width: 3, alpha: 0.6 });

    graphics.eventMode = 'static';
    graphics.cursor = 'pointer';

    container.addChild(graphics);

    // highlights
    const highlight = new Graphics();
    highlight.circle(-radius * 0.3, -radius * 0.3, radius * 0.5);
    highlight.fill({ color: 0xffffff, alpha: 0.6 });
    container.addChild(highlight);

    const highlight2 = new Graphics();
    highlight2.circle(-radius * 0.5, -radius * 0.5, radius * 0.2);
    highlight2.fill({ color: 0xffffff, alpha: 0.8 });
    container.addChild(highlight2);

    // text
    const text = new Text({
      text: bubble.number.toString(),
      style: {
        fontFamily: 'Arial',
        fontSize: radius * 0.7,
        fontWeight: 'bold',
        fill: bubble.textColor,
        align: 'center',
        stroke: { color: 0x000000, width: 2 },
        dropShadow: { color: 0x000000, alpha: 0.5, blur: 2, distance: 1 },
      },
    });
    text.anchor.set(0.5);
    container.addChild(text);

    stageBubbleContainer.addChild(container);
    container.zIndex = bubble.index;
    if (stageBubbleContainer.sortableChildren !== true) {
      stageBubbleContainer.sortableChildren = true;
    }

    bubble.container = container;
    bubble.sprite = graphics;
    bubble.text = text;
  }

  createExplosion(
    particleContainer: Container,
    bubble: Bubble,
    bubbles: Bubble[],
  ): Bubble[] {
    const particleCount = 60;
    const particles: Particle[] = [];

    const colorNum = parseInt(bubble.color.slice(1), 16);
    const r = (colorNum >> 16) & 0xff;
    const g = (colorNum >> 8) & 0xff;
    const b = colorNum & 0xff;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speedLayer = Math.random();
      let speed: number;
      if (speedLayer < 0.3) speed = Math.random() * 3 + 8;
      else if (speedLayer < 0.7) speed = Math.random() * 4 + 4;
      else speed = Math.random() * 3 + 1;

      const size = Math.random() * 6 + 1;
      const colorVariation = Math.random() * 0.3 - 0.15;
      const newR = Math.max(0, Math.min(255, r + colorVariation * 255));
      const newG = Math.max(0, Math.min(255, g + colorVariation * 255));
      const newB = Math.max(0, Math.min(255, b + colorVariation * 255));

      let particleColor: number;
      const colorType = Math.random();
      if (colorType < 0.7)
        particleColor =
          (Math.floor(newR) << 16) | (Math.floor(newG) << 8) | Math.floor(newB);
      else if (colorType < 0.85) particleColor = 0xffd700;
      else particleColor = 0xffffff;

      const lifeVariation = Math.random() * 20 + 25;

      const particleGraphics = new Graphics();
      particleGraphics.circle(0, 0, size);
      particleGraphics.fill({ color: particleColor, alpha: 1 });
      particleGraphics.position.set(
        bubble.x + (Math.random() - 0.5) * 10,
        bubble.y + (Math.random() - 0.5) * 10,
      );

      particleContainer.addChild(particleGraphics);

      particles.push({
        sprite: particleGraphics,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        life: lifeVariation,
        maxLife: lifeVariation,
        initialSize: size,
      });
    }

    if (bubble.container && bubble.container.parent) {
      bubble.container.parent.removeChild(bubble.container);
    }

    return bubbles.map((b) =>
      b.index === bubble.index
        ? { ...b, isExploding: true, isHighlight: false, particles }
        : b,
    );
  }

  getTextColor(_hex: string): number {
    return 0xffffff;
  }

  generateBubbleWithSpacing(
    app: Application,
    existing: Bubble[],
    index: number,
    number: number,
    sizeMin: number,
    sizeMax: number,
    durationStart: number,
    durationEnd: number,
    colors: string[],
  ): Bubble | null {
    const size = Math.floor(Math.random() * (sizeMax - sizeMin + 1)) + sizeMin;
    const duration =
      Math.random() * (durationEnd - durationStart) + durationStart;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const textColor = this.getTextColor(color);

    const maxAttempts = 10;
    const minSpacing = size * 0.2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const margin = 40;
      const minCenter = size / 2 + margin;
      const maxCenter = app.renderer.width - size / 2 - margin;

      // Ensure we have space; if screen is too narrow (unlikely), fall back to center or existing logic
      const x =
        maxCenter > minCenter
          ? Math.random() * (maxCenter - minCenter) + minCenter
          : app.renderer.width / 2;

      let hasOverlap = false;
      for (const eb of existing) {
        if (eb.isExploding) continue;
        const distance = Math.abs(x - eb.x);
        const minRequiredDistance = (size + eb.size) / 2 + minSpacing;
        if (distance < minRequiredDistance) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        return {
          index,
          size,
          duration,
          color,
          textColor,
          x,
          y: -size,
          number,
          startTime: Date.now(),
        };
      }
    }
    return null;
  }

  generateBubble(
    app: Application | undefined,
    index: number,
    number: number,
    sizeMin: number,
    sizeMax: number,
    durationStart: number,
    durationEnd: number,
    colors: string[],
  ): Bubble {
    if (!app) {
      return {
        index,
        size: 100,
        duration: 10,
        color: colors[0],
        textColor: 0xffffff,
        x: 100,
        y: -100,
        number,
        startTime: Date.now(),
      };
    }

    const size = Math.floor(Math.random() * (sizeMax - sizeMin + 1)) + sizeMin;
    const duration =
      Math.random() * (durationEnd - durationStart) + durationStart;
    const color = colors[Math.floor(Math.random() * colors.length)];

    const maxX = app.renderer.width - size;
    const x = Math.random() * maxX + size / 2;
    const textColor = this.getTextColor(color);

    return {
      index,
      size,
      duration,
      color,
      textColor,
      x,
      y: -size,
      number,
      startTime: Date.now(),
    };
  }

  onCanvasClick(
    app: Application,
    bubbles: Bubble[],
    event: MouseEvent,
  ): Bubble | null {
    const rect = (app.canvas as HTMLCanvasElement).getBoundingClientRect();
    const clickX =
      (event.clientX - rect.left) * (app.renderer.width / rect.width);
    const clickY =
      (event.clientY - rect.top) * (app.renderer.height / rect.height);

    const overlapping = bubbles
      .filter((b) => {
        if (b.isExploding || !b.container) return false;
        const distance = Math.sqrt((clickX - b.x) ** 2 + (clickY - b.y) ** 2);
        return distance <= b.size / 2;
      })
      .sort((a, b) => a.index - b.index);

    if (overlapping.length > 0) {
      return overlapping[overlapping.length - 1];
    }
    return null;
  }

  shakeBubble(bubbles: Bubble[], target: Bubble): Bubble[] {
    return bubbles.map((b) =>
      b.index === target.index
        ? { ...b, isShaking: true, shakeStartTime: Date.now() }
        : b,
    );
  }

  clearShake(bubbles: Bubble[], target: Bubble): Bubble[] {
    return bubbles.map((b) =>
      b.index === target.index
        ? { ...b, isShaking: false, shakeStartTime: undefined }
        : b,
    );
  }

  private adjustColorBrightness(hexColor: string, percent: number): number {
    const num = parseInt(hexColor.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
    return (R << 16) | (G << 8) | B;
  }
}
