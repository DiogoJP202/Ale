import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/game-scene.css';

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const GRAVITY      = 0.44;
const JUMP_FORCE   = -10.8;
/** Força do segundo pulo (pulo duplo), em % do primeiro */
const DOUBLE_JUMP_FACTOR = 0.75;
const PLAYER_SPEED = 3.6;
const WORLD_WIDTH  = 5200;
/** Hitbox de colisão (mais apertada; o sprite 128x128 tem margens transparentes). */
const PLAYER_W     = 32;
const PLAYER_H     = 52;
/** Tamanho visual do sprite da Alessandra; desenhado centrado sobre a hitbox. */
const SPRITE_W     = 88;
const SPRITE_H     = 88;
/** Desloca o sprite para cima para não parecer afundado no chão. */
const SPRITE_Y_OFFSET = -10;

/** Zoom da câmera (> 1 = mais perto do personagem). */
const CAMERA_ZOOM = 1.5;

const GAME_KEYS = new Set([
  'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
  'KeyA','KeyD','KeyW','KeyS','Space','KeyE',
]);

const INTERACT_DIST = 56;

/** Mensagem final (estilo créditos) ao completar o jogo */
const COMPLETION_MESSAGE =
  'Obrigado por estar comigo mesmo nos momentos chatos e difíceis. Obrigado por sempre confiar em mim, mesmo nesse mundo tão falso. Obrigado por me ajudar, mesmo não sendo sua obrigação. Você está fazendo niver hoje, mas foi eu que recebeu o maior presente no dia que te conheci, sempre sempre e sempre vou agradecer por ter ido falar com você naquele momento da faculdade. Te amo muito Le, espero que possa contar comigo para tudo, assim como conto com você! Te desejo tudo que há de melhor nesse mundo, parabéns por completar mais um verão!';

// ─────────────────────────────────────────────
//  COLOUR PALETTE
// ─────────────────────────────────────────────
const C = {
  skyTop   : '#07031a', skyMid : '#0d0620',
  skyLow   : '#1a0a2e', skyHor : '#2d1b4e',
  gTop     : '#3d7a52', gMid   : '#1a3a2e',
  gBot     : '#0a1e17', gLine  : '#4a9460',
  platTop  : '#6b48a0', platMid: '#3d2663', platBot: '#1e1033',
  platMoss : '#3d7a52',
  flPetal  : '#e8d5f0', flCenter: '#f4f1de', flStem: '#2d5a3d',
  /* Personagem: pSkin=pele, pHair/pHairHi=cabelo, pBody/pBodyD=corpo, pBelt=cinto, pBoot=botas, pEye=olhos */
  pSkin    : '#f4c8a0', pHair  : '#5b21b6',
  pHairHi  : '#7c3aed', pBody  : '#7c3aed',
  pBodyD   : '#6d28d9', pBelt  : '#a78bfa',
  pBoot    : '#4c1d95', pEye   : '#2a1040',
  hill1    : '#150824', hill2  : '#1e0d3a',
  star     : '#ffffff',
  moon     : '#f4f1de', moonGlowC: 'rgba(244,241,222,0.13)',
  uiText   : '#e8d5f0', uiBg   : 'rgba(13,6,32,0.82)',
  uiBorder : '#5a3a8a',
  firefly  : '#ffffaa',
};

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────
interface PlayerState {
  x: number; y: number; vx: number; vy: number;
  onGround: boolean; facing: 1|-1;
  walkPhase: number; jumpHeld: boolean;
  /** Pulo duplo: true = pode dar o segundo pulo no ar */
  canDoubleJump: boolean;
  /** Animação de dança quando pega item de música */
  isDancing: boolean;
  danceTime: number;
}
interface Platform  { x:number; y:number; w:number; h:number; isGround:boolean; }
interface CollFlower{ x:number; y:number; collected:boolean; glowPhase:number; scale:number; }
interface DecoFlower{ x:number; y:number; size:number; swayPhase:number; swaySpeed:number; ct:0|1|2; }
interface StarData  { x:number; y:number; size:number; twinkle:number; speed:number; }
interface Particle  { x:number; y:number; vx:number; vy:number; life:number; max:number; color:string; size:number; }
interface Firefly   { x:number; y:number; vx:number; vy:number; gp:number; gs:number; ct:number; }

type InteractiveType = 'music' | 'message' | 'image';
interface InteractiveItem {
  id: string;
  x: number;
  y: number;
  type: InteractiveType;
  /** Para type === 'message' */
  message?: string;
  /** Para type === 'image': URL, título e data a mostrar no overlay */
  imageUrl?: string;
  imageTitle?: string;
  imageDate?: string;
  /** Para type === 'music': melodia gerada por Web Audio (não usado se tiver audioUrl) ou URL opcional */
  audioUrl?: string;
  glowPhase: number;
}

interface GameData  {
  player    : PlayerState;
  camX      : number;
  camY      : number;
  platforms : Platform[];
  cFlowers  : CollFlower[];
  dFlowers  : DecoFlower[];
  stars     : StarData[];
  particles : Particle[];
  fireflies : Firefly[];
  interactiveItems: InteractiveItem[];
  time      : number;
  fadeIn    : number;
  collected : number;
  total     : number;
  complete  : boolean;
  completeFade: number;
  groundY   : number;
  nearItemId: string | null;
  /** Sprites da Alessandra: idle + walk F0–F3 (128x128) */
  playerSprites: PlayerSprites;
}

// ─────────────────────────────────────────────
//  DRAWING HELPERS
// ─────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0,   C.skyTop);
  g.addColorStop(0.35, C.skyMid);
  g.addColorStop(0.65, C.skyLow);
  g.addColorStop(1,   C.skyHor);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawMoon(ctx: CanvasRenderingContext2D, W: number, H: number, time: number) {
  const mx = W / 2, my = H * 0.18, mr = 44;
  const pulse = 1 + Math.sin(time * 0.018) * 0.04;

  // Outer glow
  const og = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2 * pulse);
  og.addColorStop(0,   'rgba(244,241,222,0.18)');
  og.addColorStop(0.5, 'rgba(244,241,222,0.06)');
  og.addColorStop(1,   'transparent');
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(mx, my, mr * 3.2 * pulse, 0, Math.PI * 2); ctx.fill();

  // Moon body
  ctx.fillStyle = C.moon;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

  // Craters (pixel art style)
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.beginPath(); ctx.arc(mx - 13, my - 9,  10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 16, my + 13,  7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx +  4, my - 20,  5, 0, Math.PI * 2); ctx.fill();

  // Inner glow
  const ig = ctx.createRadialGradient(mx - 10, my - 10, 0, mx, my, mr);
  ig.addColorStop(0, 'rgba(255,255,240,0.35)');
  ig.addColorStop(1, 'transparent');
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
}

function hillH(x: number, seed: number): number {
  return Math.sin(x * 0.0025 + seed) * 45
       + Math.sin(x * 0.006  + seed * 1.7) * 22
       + Math.sin(x * 0.014  + seed * 3.1) * 12
       + 90;
}

function drawHills(ctx: CanvasRenderingContext2D, W: number, groundY: number, camX: number) {
  // Far hills (parallax 0.35)
  ctx.fillStyle = C.hill1;
  ctx.beginPath();
  const off1 = camX * 0.35;
  ctx.moveTo(0, groundY);
  for (let x = -80; x <= W + 80; x += 6) {
    ctx.lineTo(x, groundY - hillH(x + off1, 0.5));
  }
  ctx.lineTo(W, groundY); ctx.closePath(); ctx.fill();

  // Near hills (parallax 0.6)
  ctx.fillStyle = C.hill2;
  ctx.beginPath();
  const off2 = camX * 0.6;
  ctx.moveTo(0, groundY);
  for (let x = -60; x <= W + 60; x += 5) {
    ctx.lineTo(x, groundY - hillH(x + off2, 2.3) * 0.55);
  }
  ctx.lineTo(W, groundY); ctx.closePath(); ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, W: number, H: number, groundY: number, camX: number) {
  // Ground body
  const gg = ctx.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0,   C.gMid);
  gg.addColorStop(0.25, '#0f2621');
  gg.addColorStop(1,   C.gBot);
  ctx.fillStyle = gg;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Top grass line
  ctx.fillStyle = C.gTop;
  ctx.fillRect(0, groundY, W, 4);
  ctx.fillStyle = C.gLine;
  ctx.fillRect(0, groundY, W, 2);

  // Grass tufts
  ctx.fillStyle = '#4a9460';
  const sp = 28, off = ((camX | 0) % sp);
  for (let x = -off; x < W + sp; x += sp) {
    const h = (Math.sin((x + camX) * 0.04) * 0.5 + 0.5);
    if (h > 0.35) {
      ctx.fillRect((x | 0), groundY - 4, 2, 4);
      ctx.fillRect((x + 7) | 0, groundY - 6, 2, 6);
      ctx.fillRect((x + 14) | 0, groundY - 3, 2, 3);
    }
  }
}

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const fx = x | 0, fy = y | 0, fw = w | 0;
  ctx.fillStyle = C.platMid; ctx.fillRect(fx, fy, fw, h);
  ctx.fillStyle = C.platTop; ctx.fillRect(fx, fy, fw, 5);
  ctx.fillStyle = C.platBot; ctx.fillRect(fx, fy + h - 3, fw, 3);

  // Texture
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let px = fx + 10; px < fx + fw - 10; px += 14) {
    ctx.fillRect(px, fy + 1, 6, 3);
  }
  // Moss on top
  ctx.fillStyle = C.platMoss;
  for (let px = fx + 4; px < fx + fw - 4; px += 9) {
    if (Math.sin(px * 0.15) > 0.2) ctx.fillRect(px, fy - 2, 2, 2);
  }
}

const DECO_COLORS: { p: string; c: string }[] = [
  { p: '#e8d5f0', c: '#f4f1de' },
  { p: '#c4a8d8', c: '#e8d5f0' },
  { p: '#f4c8d8', c: '#f4f1de' },
];

function drawDecoFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, sway: number, ct: number) {
  const col = DECO_COLORS[ct];
  const sx = (x + sway * 0.4) | 0;
  ctx.fillStyle = C.flStem;
  ctx.fillRect(sx - 1, (y - size * 1.8) | 0, 2, (size * 1.8) | 0);
  ctx.fillStyle = col.p;
  const hs = (size / 2) | 0, qs = (size / 4) | 0;
  ctx.fillRect(sx - hs, (y - size * 2.5 - hs) | 0, hs,   size);
  ctx.fillRect(sx + qs, (y - size * 2.5 - hs) | 0, hs,   size);
  ctx.fillRect(sx - qs, (y - size * 3 - qs)   | 0, size, hs);
  ctx.fillRect(sx - qs, (y - size * 2.5)      | 0, size, hs);
  ctx.fillStyle = col.c;
  ctx.fillRect(sx - qs, (y - size * 2.5 - qs) | 0, size / 2 | 0, size / 2 | 0);
}

function drawCollFlower(ctx: CanvasRenderingContext2D, x: number, y: number, gp: number, scale: number, time: number) {
  const glow    = 0.5 + Math.sin(gp) * 0.5;
  const floatY  = Math.sin(time * 0.045 + gp) * 3.5;
  const fx = x | 0, fy = (y + floatY) | 0;
  const s  = scale;

  // Outer glow halo
  const halo = ctx.createRadialGradient(fx, fy, 2, fx, fy, 26 * s);
  halo.addColorStop(0,   `rgba(232,213,240,${0.55 * glow})`);
  halo.addColorStop(0.45, `rgba(232,213,240,${0.15 * glow})`);
  halo.addColorStop(1,   'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(fx, fy, 26 * s, 0, Math.PI * 2); ctx.fill();

  // Stem
  ctx.fillStyle = C.flStem;
  ctx.fillRect(fx - 1, fy, 2, (13 * s) | 0);

  // 6 petals
  ctx.fillStyle = C.flPetal;
  const pl = (9 * s) | 0, pw = (3.5 * s) | 0;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(fx, fy - 2);
    ctx.rotate(angle);
    ctx.fillRect(-(pw / 2) | 0, -pl, pw, pl);
    ctx.restore();
  }

  // Centre
  ctx.fillStyle = C.flCenter;
  ctx.beginPath(); ctx.arc(fx, fy - 2, (4.5 * s) | 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.65 * glow})`;
  ctx.beginPath(); ctx.arc(fx, fy - 2, (2.2 * s) | 0, 0, Math.PI * 2); ctx.fill();
}

/** Sprites da Alessandra: idle (parado), caminhada (4 frames), pulo (2) e dança (2), todos 128x128. */
const PLAYER_SPRITE_IDLE = '/AlessandraFront.png';
const PLAYER_SPRITE_WALK = ['/Alessandra/F0.png', '/Alessandra/F1.png', '/Alessandra/F2.png', '/Alessandra/F3.png'];
const PLAYER_SPRITE_JUMP = ['/jumping/F0.png', '/jumping/F1.png'];
const PLAYER_SPRITE_DANCE = ['/Dancing/F0.png', '/Dancing/F1.png'];

type PlayerSprites = {
  idle: HTMLImageElement | null;
  walk: (HTMLImageElement | null)[];
  jump: (HTMLImageElement | null)[];
  dance: (HTMLImageElement | null)[];
};

/**
 * Desenha o personagem: usa sprites da Alessandra (idle ou walk F0–F3) se carregados;
 * senão usa o desenho em código.
 */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  camX: number,
  camY: number,
  time: number,
  sprites: PlayerSprites
) {
  const px = (p.x - camX) | 0;
  const py = (p.y - camY) | 0;
  const facing = p.facing;
  // Posição do sprite: centrado sobre a hitbox; SPRITE_Y_OFFSET sobe o personagem
  const sx = px - (SPRITE_W - PLAYER_W) / 2;
  const sy = py - (SPRITE_H - PLAYER_H) / 2 + SPRITE_Y_OFFSET;

  const isWalking = p.onGround && Math.abs(p.vx) > 0.3;
  const isJumping = !p.onGround;
  const isDancing = p.isDancing;
  const walkFrameIndex = Math.floor(p.walkPhase * 0.5) % 4;
  // Jumping frames: F1 = subindo (vy < 0), F0 = caindo (vy >= 0)
  const jumpFrameIndex = p.vy < 0 ? 1 : 0;

  let sprite: HTMLImageElement | null | undefined;
  let danceFlip = false;
  if (isDancing && sprites.dance.length) {
    // Sequência desejada: F0, F1, F0 espelhado, F1 espelhado (e repete)
    const stepDuration = 8; // 1s por frame
    const phase = Math.floor(p.danceTime / stepDuration) % 4;
    const danceIdx = phase % 2;       // 0,2 -> F0 ; 1,3 -> F1
    danceFlip = phase >= 2;           // 0,1 sem flip ; 2,3 com flip
    if (sprites.dance[danceIdx]?.complete) {
      sprite = sprites.dance[danceIdx]!;
    }
  }
  if (!sprite && isJumping && sprites.jump[jumpFrameIndex]?.complete) {
    sprite = sprites.jump[jumpFrameIndex]!;
  } else if (!sprite && isWalking && sprites.walk[walkFrameIndex]?.complete) {
    sprite = sprites.walk[walkFrameIndex]!;
  }
  if (!sprite) {
    sprite = sprites.idle;
  }

  ctx.save();
  // Walking/jumping sprites usam facing normal; idle é espelhado ao contrário;
  // dança usa o flip definido pela fase (F0,F1,F0 espelhado,F1 espelhado,...).
  const usingIdle = sprite === sprites.idle;
  const usingDance = sprites.dance.includes(sprite as HTMLImageElement);
  const shouldFlip =
    usingDance
      ? danceFlip
      : usingIdle
        ? facing === 1   // idle: inverter quando estiver virado para a direita
        : facing === -1; // walk/jump: inverter quando estiver virado para a esquerda (comportamento antigo)

  if (shouldFlip) {
    ctx.translate(px + PLAYER_W / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(px + PLAYER_W / 2), 0);
  }

  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const nw = sprite.naturalWidth;
    const nh = sprite.naturalHeight;
    const scale = Math.min(SPRITE_W / nw, SPRITE_H / nh);
    const drawW = nw * scale;
    const drawH = nh * scale;
    const dx = sx + (SPRITE_W - drawW) / 2;
    const dy = sy + (SPRITE_H - drawH) / 2;
    ctx.drawImage(sprite, 0, 0, nw, nh, dx, dy, drawW, drawH);
    ctx.restore();
    return;
  }

  // Fallback: desenho em código (pixel art) alinhado à hitbox 32x52
  const aura = ctx.createRadialGradient(px + 12, py + 19, 2, px + 12, py + 19, 32);
  aura.addColorStop(0, 'rgba(139,92,246,0.22)');
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(px + 12, py + 19, 32, 0, Math.PI * 2); ctx.fill();

  const walkSwing = p.onGround ? Math.sin(p.walkPhase) * 5 : 0;

  ctx.fillStyle = C.pBodyD;
  ctx.fillRect(px + 3,  py + 26, 8, 10 + (walkSwing | 0));
  ctx.fillRect(px + 13, py + 26, 8, 10 - (walkSwing | 0));
  ctx.fillStyle = C.pBoot;
  ctx.fillRect(px + 1,  py + 34 + (walkSwing | 0), 11, 4);
  ctx.fillRect(px + 12, py + 34 - (walkSwing | 0), 11, 4);
  ctx.fillStyle = C.pBody;
  ctx.fillRect(px + 2, py + 14, 20, 13);
  ctx.fillStyle = C.pBodyD;
  ctx.fillRect(px + 5, py + 15, 14, 3);
  ctx.fillRect(px + 2, py + 24, 20, 2);
  ctx.fillStyle = C.pBelt;
  ctx.fillRect(px + 3, py + 23, 18, 3);
  ctx.fillStyle = C.pSkin;
  ctx.fillRect(px + 4, py + 4, 16, 12);
  ctx.fillStyle = C.pHair;
  ctx.fillRect(px + 2, py,     20, 7);
  ctx.fillRect(px,     py + 2,  5, 7);
  ctx.fillRect(px + 19, py + 2, 5, 6);
  ctx.fillStyle = C.pHairHi;
  ctx.fillRect(px + 4, py,  7, 4);
  ctx.fillRect(px + 13, py, 5, 3);
  ctx.fillStyle = C.pEye;
  ctx.fillRect(px + 7,  py + 8, 3, 3);
  ctx.fillRect(px + 14, py + 8, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px + 8,  py + 8, 1, 1);
  ctx.fillRect(px + 15, py + 8, 1, 1);
  ctx.fillStyle = 'rgba(244,130,130,0.45)';
  ctx.fillRect(px + 5,  py + 11, 3, 2);
  ctx.fillRect(px + 16, py + 11, 3, 2);
  if (Math.abs(p.vx) > 0.5 && p.onGround) {
    const sparkAlpha = (Math.sin(time * 0.2) * 0.5 + 0.5) * 0.7;
    ctx.fillStyle = `rgba(232,213,240,${sparkAlpha})`;
    const spx = px + (p.vx > 0 ? -4 : 28);
    const spy = py + 10 + Math.sin(time * 0.3) * 5;
    ctx.fillRect(spx | 0, spy | 0, 2, 2);
  }

  ctx.restore();
}

function drawInteractiveItem(
  ctx: CanvasRenderingContext2D,
  item: InteractiveItem,
  screenX: number,
  screenY: number,
  time: number,
  isNear: boolean
) {
  const glow = 0.5 + Math.sin(item.glowPhase) * 0.5;
  const floatY = Math.sin(time * 0.04 + item.glowPhase) * 4;
  const ix = (screenX) | 0;
  const iy = (screenY + floatY) | 0;
  const r = 14;

  // Glow halo
  const halo = ctx.createRadialGradient(ix, iy, 0, ix, iy, r * 2.2);
  halo.addColorStop(0, `rgba(167,139,250,${0.4 * glow})`);
  halo.addColorStop(0.6, `rgba(124,58,237,${0.15 * glow})`);
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ix, iy, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Base circle
  ctx.fillStyle = isNear ? C.pBody : C.platMid;
  ctx.strokeStyle = isNear ? C.pBelt : C.platTop;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ix, iy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Icon by type (pixel style)
  ctx.fillStyle = C.uiText;
  if (item.type === 'music') {
    // Nota musical
    ctx.fillRect(ix - 4, iy - 8, 3, 10);
    ctx.beginPath();
    ctx.arc(ix + 2, iy - 6, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'message') {
    // Pergaminho
    ctx.fillRect(ix - 6, iy - 4, 12, 8);
    ctx.fillStyle = C.platBot;
    ctx.fillRect(ix - 4, iy - 2, 8, 4);
  } else {
    // Imagem (quadro)
    ctx.fillRect(ix - 6, iy - 6, 12, 12);
    ctx.fillStyle = C.moon;
    ctx.fillRect(ix - 3, iy - 3, 6, 6);
  }
}

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────
interface Props {
  onBackToMenu: () => void;
  volume: number;
  mobileControls: boolean;
}

export function GameScene({ onBackToMenu, volume, mobileControls }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef      = useRef<GameData | null>(null);
  const keysRef   = useRef<Record<string, boolean>>({});
  const rafRef    = useRef<number>(0);
  const touchRef  = useRef({ left: false, right: false, jump: false, jumpHeld: false });
  const bgmRef    = useRef<HTMLAudioElement | null>(null);

  const [ui, setUi] = useState({ collected: 0, total: 0, phase: 'playing' as 'playing'|'complete' });
  const [showHint, setShowHint] = useState(true);
  /** Número de caracteres visíveis da mensagem final (efeito typewriter) */
  const [completionVisibleChars, setCompletionVisibleChars] = useState(0);
  type OverlayState = { type: 'message'; content: string } | { type: 'image'; imageUrl: string; title?: string; date?: string } | { type: 'music'; audioUrl: string } | null;
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const onInteractTriggerRef = useRef<(payload: OverlayState) => void>(() => {});
  const eKeyWasDownRef = useRef(false);
  const mobileControlsRef = useRef(mobileControls);
  const itemMusicRef = useRef<HTMLAudioElement | null>(null);
  const overlayIsMusicRef = useRef(false);
  const completionVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    mobileControlsRef.current = mobileControls;
  }, [mobileControls]);

  // Efeito typewriter na mensagem final (quando completa o jogo)
  useEffect(() => {
    if (ui.phase !== 'complete') {
      setCompletionVisibleChars(0);
      return;
    }
    setCompletionVisibleChars(0);
    const len = COMPLETION_MESSAGE.length;
    const interval = setInterval(() => {
      setCompletionVisibleChars((n) => (n >= len ? len : n + 1));
    }, 58);
    return () => clearInterval(interval);
  }, [ui.phase]);

  // Vídeo final: tocar com áudio e volume um pouco mais alto
  useEffect(() => {
    if (ui.phase !== 'complete') return;
    const video = completionVideoRef.current;
    if (video) {
      video.volume = 1;
      video.play().catch(() => {});
    }
  }, [ui.phase]);

  // Fechar overlay com Escape
  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);

  // Quando overlay é música: pausar BGM, estado de dança. No toque o áudio já foi iniciado no handler (itemMusicRef); na tecla E criamos aqui.
  useEffect(() => {
    if (overlay?.type !== 'music') {
      overlayIsMusicRef.current = false;
      if (gRef.current) {
        gRef.current.player.isDancing = false;
        gRef.current.player.danceTime = 0;
      }
      return;
    }
    overlayIsMusicRef.current = true;
    if (bgmRef.current) bgmRef.current.pause();
    if (gRef.current) {
      gRef.current.player.isDancing = true;
      gRef.current.player.danceTime = 0;
    }
    let audio: HTMLAudioElement | null = itemMusicRef.current;
    if (!audio) {
      audio = new Audio(overlay.audioUrl);
      audio.volume = 0.6;
      audio.addEventListener('ended', () => setOverlay(null));
      audio.play().catch(() => setOverlay(null));
      itemMusicRef.current = audio;
    }
    return () => {
      overlayIsMusicRef.current = false;
      if (itemMusicRef.current) {
        itemMusicRef.current.pause();
        itemMusicRef.current = null;
      }
      if (bgmRef.current) bgmRef.current.play().catch(() => {});
    };
  }, [overlay]);

  // Música de fundo principal (loop)
  useEffect(() => {
    // Evitar recriar se já existir
    if (!bgmRef.current) {
      const audio = new Audio('/Musicas/Twenty One Pilots - Oldies Station (8-bit).mp3');
      audio.loop = true;
      audio.volume = volume;
      bgmRef.current = audio;
      // Alguns browsers só tocam após interação, então ignorar erros de autoplay
      audio.play().catch(() => {});
    }
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
    };
  }, []);

  // Atualizar volume quando o valor vindo do menu mudar; na tela final, BGM bem mais baixo
  useEffect(() => {
    if (!bgmRef.current) return;
    bgmRef.current.volume = ui.phase === 'complete' ? 0.03 : volume;
  }, [volume, ui.phase]);

  // ─── INITIALISE ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const W = canvas.width, H = canvas.height;
    const groundY = H - 62;
    const viewH = H / CAMERA_ZOOM;
    const initialCamY = groundY - PLAYER_H / 2 - viewH / 2;

    // Stars
    const stars: StarData[] = Array.from({ length: 130 }, () => ({
      x     : Math.random() * WORLD_WIDTH,
      y     : 18 + Math.random() * H * 0.53,
      size  : Math.random() < 0.65 ? 1 : 2,
      twinkle: Math.random() * Math.PI * 2,
      speed : 0.015 + Math.random() * 0.025,
    }));

    // Platforms
    const platforms: Platform[] = [
      { x: 0, y: groundY, w: WORLD_WIDTH, h: 120, isGround: true },
    ];
    const elevations: [number, number][] = [
      [300,110],[530,180],[770,130],[1010,200],
      [1250,150],[1500,220],[1760,165],[2020,240],
      [2280,175],[2540,250],[2800,145],[3070,215],
      [3330,170],[3600,240],[3870,160],[4150,225],
      [4420,190],[4700,140],
    ];
    elevations.forEach(([px, elev]) => {
      const pw = 140 + Math.floor(Math.random() * 90);
      platforms.push({ x: px, y: groundY - elev, w: pw, h: 22, isGround: false });
    });

    // Collectible flowers
    const cFlowers: CollFlower[] = [];
    platforms.slice(1).forEach(p => {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        cFlowers.push({
          x: p.x + (p.w / (n + 1)) * (i + 1),
          y: p.y - 16,
          collected: false,
          glowPhase: Math.random() * Math.PI * 2,
          scale: 0.85 + Math.random() * 0.35,
        });
      }
    });
    for (let i = 0; i < 22; i++) {
      cFlowers.push({
        x: 180 + Math.random() * (WORLD_WIDTH - 360),
        y: groundY - 16,
        collected: false,
        glowPhase: Math.random() * Math.PI * 2,
        scale: 0.85 + Math.random() * 0.35,
      });
    }

    // Decorative flowers (background)
    const dFlowers: DecoFlower[] = Array.from({ length: 220 }, () => ({
      x       : Math.random() * WORLD_WIDTH,
      y       : groundY - 2 - Math.random() * 14,
      size    : 4 + Math.random() * 7,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.01 + Math.random() * 0.018,
      ct      : (Math.floor(Math.random() * 3)) as 0|1|2,
    }));

    // Fireflies
    const fireflies: Firefly[] = Array.from({ length: 22 }, () => ({
      x  : Math.random() * WORLD_WIDTH,
      y  : groundY - 40 - Math.random() * 220,
      vx : (Math.random() - 0.5) * 0.55,
      vy : (Math.random() - 0.5) * 0.55,
      gp : Math.random() * Math.PI * 2,
      gs : 0.02 + Math.random() * 0.04,
      ct : 0,
    }));

    const player: PlayerState = {
      x: 90, y: groundY - PLAYER_H,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1,
      walkPhase: 0, jumpHeld: false,
      canDoubleJump: true,
      isDancing: false, danceTime: 0,
    };

    // Itens interativos espalhados pelo cenário (mensagem, imagem das memórias, música)
    const interactiveItems: InteractiveItem[] = [
      { id: 'msg1', x: 420,  y: groundY - 24, type: 'message', message: 'As flores dama-da-noite só abrem à noite, porém hoje, elas estão abertas para comemorar algo especial!', glowPhase: 0 },
      { id: 'img1', x: 920,  y: groundY - 24, type: 'image', imageUrl: '/Memorias/Alezinha01.jpeg', imageTitle: 'Drip Incalculável', imageDate: '16/10/2025', glowPhase: 1.2 },
      { id: 'mus1', x: 1380, y: groundY - 24, type: 'music', audioUrl: '/Musicas/DragPath.mp3', glowPhase: 2.1 },
      { id: 'msg2', x: 1920, y: groundY - 24, type: 'message', message: 'A lua ilumina o campo, tal como você ilumina todos a sua volta.', glowPhase: 0.5 },
      { id: 'img2', x: 2620, y: groundY - 24, type: 'image', imageUrl: '/Memorias/Alezinha02.jpeg', imageTitle: 'Jantar', imageDate: '16/11/2024', glowPhase: 3 },
      { id: 'mus2', x: 3280, y: groundY - 24, type: 'music', audioUrl: '/Musicas/Drum Show.mp3', glowPhase: 1.8 },
      { id: 'd3', x: 3980, y: groundY - 24, type: 'message', message: 'Obrigado por estar aqui agora, e obrigado por sempre estar.', glowPhase: 0.9 },
      { id: 'img3', x: 4580, y: groundY - 24, type: 'image', imageUrl: '/Memorias/Alezinha03.jpeg', imageTitle: 'Fugueira', imageDate: '26/07/2025', glowPhase: 2.5 },
      { id: 'img4', x: 5100, y: groundY - 24, type: 'image', imageUrl: '/Memorias/Alezinha09.jpeg', imageTitle: 'Toda ouvidos', imageDate: '18/08/2025', glowPhase: 1.5 },
    ];
    // Itens em plataformas (usar posições das plataformas)
    platforms.slice(1, 6).forEach((plat, i) => {
      const types: InteractiveType[] = ['message', 'image', 'music'];
      const type = types[i % 3];
      const item: InteractiveItem = {
        id: `plat-${i}`,
        x: plat.x + plat.w / 2 - 10,
        y: plat.y - 28,
        type,
        glowPhase: i * 0.7,
      };
      if (type === 'message') item.message = ['Um vento suave passa pelo campo, e as flores dançam junto.', 'As estrelas observam você.', 'Pule com cuidado!'][i % 3];
      if (type === 'image') {
        item.imageUrl = ['/Memorias/Alezinha04.jpeg', '/Memorias/Alezinha05.jpeg', '/Memorias/Alezinha06.jpeg', '/Memorias/Alezinha07.jpeg', '/Memorias/Alezinha08.jpeg'][i % 5];
        const platImagetexts = ['Tamo de Zoio', 'Dá até aula', 'Rainha do SQL', 'Like no vídeo', 'Actually'];
        item.imageTitle = platImagetexts[i] ?? '';
        // Uma data por item de imagem nas plataformas (i=1 e i=4 são os que têm type 'image')
        const platImageDates = ['01/07/2025', '20/02/2025', '28/03/2025', '08/07/2025', '06/07/2025'];
        item.imageDate = platImageDates[i] ?? '';
      }
      if (type === 'music') item.audioUrl = ['/Musicas/DragPath.mp3', '/Musicas/Drum Show.mp3', '/Musicas/TaoPertomp3.mp3'][i % 3];
      interactiveItems.push(item);
    });

    // Itens de imagem no final do mapa (plataformas superiores) para completar as memórias
    const endImages = ['/Memorias/Alezinha04.jpeg', '/Memorias/Alezinha06.jpeg', '/Memorias/Alezinha07.jpeg'] as const;
    const endTitles = ['Tamo de Zoio', 'Rainha do SQL', 'Like no vídeo'];
    const endDates = ['01/07/2025', '28/03/2025', '08/06/2025'];
    platforms.slice(-3).forEach((plat, i) => {
      interactiveItems.push({
        id: `img-end-${i}`,
        x: plat.x + plat.w / 2 - 10,
        y: plat.y - 28,
        type: 'image',
        imageUrl: endImages[i],
        imageTitle: endTitles[i],
        imageDate: endDates[i],
        glowPhase: 4 + i * 0.5,
      });
    });

    gRef.current = {
      player, camX: 0, camY: Math.max(0, initialCamY),
      platforms, cFlowers, dFlowers, stars, particles: [], fireflies,
      interactiveItems,
      time: 0, fadeIn: 0,
      collected: 0, total: cFlowers.length,
      complete: false, completeFade: 0,
      groundY,
      nearItemId: null,
      playerSprites: { idle: null, walk: [null, null, null, null], jump: [null, null], dance: [null, null] },
    };

    // Carregar sprites da Alessandra (idle + walk F0–F3 + jump F0–F1 + dance F0–F1)
    const idleImg = new Image();
    idleImg.src = PLAYER_SPRITE_IDLE;
    idleImg.onload = () => {
      if (gRef.current) gRef.current.playerSprites.idle = idleImg;
    };
    PLAYER_SPRITE_WALK.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (gRef.current) gRef.current.playerSprites.walk[i] = img;
      };
    });

    PLAYER_SPRITE_JUMP.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (gRef.current) gRef.current.playerSprites.jump[i] = img;
      };
    });

    PLAYER_SPRITE_DANCE.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (gRef.current) gRef.current.playerSprites.dance[i] = img;
      };
    });

    PLAYER_SPRITE_JUMP.forEach((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        if (gRef.current) gRef.current.playerSprites.jump[i] = img;
      };
    });

    setUi({ collected: 0, total: cFlowers.length, phase: 'playing' });
    const hintTimer = setTimeout(() => setShowHint(false), 7000);

    onInteractTriggerRef.current = (payload: OverlayState) => setOverlay(payload);

    // ─── KEYBOARD ─────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    // ─── UPDATE ───────────────────────────────
    function update(dt: number) {
      const g = gRef.current!;
      if (!g) return;
      g.time += dt;

      if (g.fadeIn < 1) { g.fadeIn = Math.min(1, g.fadeIn + dt * 0.028); }
      if (g.complete) { g.completeFade = Math.min(1, g.completeFade + dt * 0.018); return; }

      const p = g.player;
      const k = keysRef.current;
      const t = touchRef.current;

      const left  = k['ArrowLeft']  || k['KeyA'] || t.left;
      const right = k['ArrowRight'] || k['KeyD'] || t.right;
      const jump  = k['ArrowUp']    || k['KeyW'] || k['Space'] || t.jump;

      // Se o jogador se mexer, interrompe a dança e para a música do item
      if (g.player.isDancing && (left || right || jump)) {
        g.player.isDancing = false;
        g.player.danceTime = 0;
        setOverlay(null);
      }

      // Horizontal
      if (left) {
        p.vx = Math.max(p.vx - 0.55 * dt, -PLAYER_SPEED);
        p.facing = -1;
      } else if (right) {
        p.vx = Math.min(p.vx + 0.55 * dt, PLAYER_SPEED);
        p.facing = 1;
      } else {
        p.vx *= Math.pow(0.65, dt);
        if (Math.abs(p.vx) < 0.08) p.vx = 0;
      }

      // Jump (normal no chão + pulo duplo no ar)
      const jumpPressed = jump && !p.jumpHeld;
      if (jumpPressed && p.onGround) {
        p.vy = JUMP_FORCE;
        p.onGround = false;
        p.jumpHeld = true;
        p.canDoubleJump = true; // libera o segundo pulo após sair do chão
        for (let i = 0; i < 7; i++) {
          g.particles.push({
            x: p.x + PLAYER_W / 2, y: p.y + PLAYER_H,
            vx: (Math.random() - 0.5) * 2.2, vy: -Math.random() * 1.8,
            life: 22, max: 22,
            color: 'rgba(167,139,250,0.8)', size: 3,
          });
        }
        if (t.jump) touchRef.current.jumpHeld = true;
      } else if (jumpPressed && !p.onGround && p.canDoubleJump) {
        // Pulo duplo: 75% da altura do primeiro
        p.vy = JUMP_FORCE * DOUBLE_JUMP_FACTOR;
        p.jumpHeld = true;
        p.canDoubleJump = false;
        for (let i = 0; i < 4; i++) {
          g.particles.push({
            x: p.x + PLAYER_W / 2, y: p.y + PLAYER_H / 2,
            vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.2,
            life: 16, max: 16,
            color: 'rgba(167,139,250,0.7)', size: 2,
          });
        }
        if (t.jump) touchRef.current.jumpHeld = true;
      }
      if (!jump) { p.jumpHeld = false; touchRef.current.jumpHeld = false; }

      // Gravity
      p.vy = Math.min(p.vy + GRAVITY * dt, 16);

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x  = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_W, p.x));

      // Atualizar tempo da animação de dança
      if (p.isDancing) {
        p.danceTime += dt;
      } else {
        p.danceTime = 0;
      }

      // Collision
      p.onGround = false;
      for (const plat of g.platforms) {
        if (p.x + PLAYER_W <= plat.x || p.x >= plat.x + plat.w) continue;
        const prevBot = p.y + PLAYER_H - p.vy * dt;
        const currBot = p.y + PLAYER_H;
        if (prevBot <= plat.y + 1 && currBot >= plat.y && p.vy >= 0) {
          p.y = plat.y - PLAYER_H;
          p.vy = 0;
          p.onGround = true;
          p.canDoubleJump = true; // ao tocar o chão, recupera o pulo duplo
        }
        if (!plat.isGround && p.vy < 0) {
          const prevTop = p.y - p.vy * dt;
          const currTop = p.y;
          const platBot = plat.y + plat.h;
          if (prevTop >= platBot - 1 && currTop < platBot) {
            p.y = platBot;
            p.vy = 0;
          }
        }
      }

      // Animação de andar: 0.17 = velocidade do ciclo (maior = mais rápido)
      if (p.onGround && (left || right)) p.walkPhase += 0.17 * dt;

      // Collect flowers
      for (const fl of g.cFlowers) {
        if (fl.collected) continue;
        fl.glowPhase += 0.03 * dt;
        const dx = (p.x + PLAYER_W / 2) - fl.x;
        const dy = (p.y + PLAYER_H / 2) - fl.y;
        if (dx * dx + dy * dy < 28 * 28) {
          fl.collected = true;
          g.collected++;
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            g.particles.push({
              x: fl.x, y: fl.y,
              vx: Math.cos(a) * (1.2 + Math.random() * 2.2),
              vy: Math.sin(a) * (1.2 + Math.random() * 2.2) - 0.8,
              life: 32, max: 32,
              color: '#e8d5f0', size: 3,
            });
          }
          if (g.collected >= g.total) {
            g.complete = true;
            setUi({ collected: g.collected, total: g.total, phase: 'complete' });
          } else {
            setUi(prev => ({ ...prev, collected: g.collected }));
          }
        }
      }

      // Particles
      g.particles = g.particles.filter(pt => pt.life > 0);
      for (const pt of g.particles) {
        pt.x += pt.vx * dt; pt.y += pt.vy * dt;
        pt.vy += 0.07 * dt; pt.life -= dt;
      }

      // Fireflies
      for (const ff of g.fireflies) {
        ff.x += ff.vx * dt; ff.y += ff.vy * dt;
        ff.gp += ff.gs * dt;
        ff.ct += dt;
        if (ff.ct > 60 + Math.random() * 60) {
          ff.vx = (Math.random() - 0.5) * 0.9;
          ff.vy = (Math.random() - 0.5) * 0.7;
          ff.ct = 0;
        }
        if (ff.x < 0) ff.x = WORLD_WIDTH;
        if (ff.x > WORLD_WIDTH) ff.x = 0;
        if (ff.y < g.groundY - 300) ff.vy = Math.abs(ff.vy);
        if (ff.y > g.groundY - 10)  ff.vy = -Math.abs(ff.vy);
      }

      // Deco flowers sway
      for (const df of g.dFlowers) df.swayPhase += df.swaySpeed * dt;

      // Interactive items glow
      for (const it of g.interactiveItems) it.glowPhase += 0.025 * dt;

      // Stars twinkle
      for (const s of g.stars) s.twinkle += s.speed * dt;

      // Camera smooth follow (horizontal e vertical, zoom no personagem)
      const viewW = canvas.width / CAMERA_ZOOM;
      const viewH = canvas.height / CAMERA_ZOOM;
      const targetX = p.x - viewW / 2 + PLAYER_W / 2;
      const targetY = p.y + PLAYER_H / 2 - viewH / 2;
      g.camX += (targetX - g.camX) * 0.075 * dt;
      g.camX = Math.max(0, Math.min(WORLD_WIDTH - viewW, g.camX));
      g.camY += (targetY - g.camY) * 0.075 * dt;
      g.camY = Math.max(0, Math.min(g.groundY + 80 - viewH, g.camY));

      // Itens interativos: proximidade e tecla E
      const px = p.x + PLAYER_W / 2, py = p.y + PLAYER_H / 2;
      let nearestId: string | null = null;
      let nearestDist = INTERACT_DIST;
      for (const it of g.interactiveItems) {
        const dx = px - it.x, dy = py - it.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = it.id;
        }
      }
      g.nearItemId = nearestId;

      const eDown = keysRef.current['KeyE'] === true;
      if (eDown && !eKeyWasDownRef.current && g.nearItemId) {
        const item = g.interactiveItems.find(i => i.id === g.nearItemId)!;
        if (item.type === 'message' && item.message) {
          onInteractTriggerRef.current({ type: 'message', content: item.message });
        } else if (item.type === 'image' && item.imageUrl) {
          onInteractTriggerRef.current({ type: 'image', imageUrl: item.imageUrl, title: item.imageTitle, date: item.imageDate });
        } else if (item.type === 'music' && item.audioUrl) {
          onInteractTriggerRef.current({ type: 'music', audioUrl: item.audioUrl });
        }
      }
      eKeyWasDownRef.current = eDown;
    }

    // ─── RENDER ───────────────────────────────
    function render() {
      const g = gRef.current!;
      const ctx = canvas.getContext('2d')!;
      if (!ctx || !g) return;
      const cW = canvas.width, cH = canvas.height;
      const viewW = cW / CAMERA_ZOOM, viewH = cH / CAMERA_ZOOM;
      const camX = g.camX, camY = g.camY;
      const gY   = g.groundY;

      ctx.save();
      // Zoom centrado no ecrã (vista centrada no personagem)
      ctx.translate(cW / 2, cH / 2);
      ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
      ctx.translate(-viewW / 2, -viewH / 2);

      // 1) Sky
      drawBackground(ctx, viewW, viewH);

      // 2) Moon (fixed in screen, no parallax)
      drawMoon(ctx, viewW, viewH, g.time);

      // 3) Stars (parallax 0.22)
      for (const s of g.stars) {
        const sx = s.x - camX * 0.22;
        const sy = s.y - camY;
        if (sx < -4 || sx > viewW + 4 || sy < -4 || sy > viewH + 4) continue;
        const alpha = 0.45 + Math.sin(s.twinkle) * 0.55;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = C.star;
        ctx.fillRect(sx | 0, sy | 0, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // 4) Hills
      drawHills(ctx, viewW, gY - camY, camX);

      // 5) Ground
      drawGround(ctx, viewW, viewH, gY - camY, camX);

      // 6) Deco flowers
      for (const df of g.dFlowers) {
        const fx = df.x - camX;
        const fy = df.y - camY;
        if (fx < -30 || fx > viewW + 30 || fy < -30 || fy > viewH + 30) continue;
        drawDecoFlower(ctx, fx, fy, df.size, Math.sin(df.swayPhase) * 3.5, df.ct);
      }

      // 7) Platforms
      for (const plat of g.platforms) {
        if (plat.isGround) continue;
        const px = plat.x - camX;
        const py = plat.y - camY;
        if (px + plat.w < -10 || px > viewW + 10 || py < -22 || py > viewH + 10) continue;
        drawPlatform(ctx, px, py, plat.w, plat.h);
      }

      // 8) Collectible flowers
      for (const fl of g.cFlowers) {
        if (fl.collected) continue;
        const fx = fl.x - camX;
        const fy = fl.y - camY;
        if (fx < -40 || fx > viewW + 40 || fy < -40 || fy > viewH + 40) continue;
        drawCollFlower(ctx, fx, fy, fl.glowPhase, fl.scale, g.time);
      }

      // 8b) Interactive items
      for (const it of g.interactiveItems) {
        const ix = it.x - camX;
        const iy = it.y - camY;
        if (ix < -40 || ix > viewW + 40 || iy < -40 || iy > viewH + 40) continue;
        drawInteractiveItem(ctx, it, ix, iy, g.time, g.nearItemId === it.id);
      }

      // 9) Fireflies
      for (const ff of g.fireflies) {
        const fx = ff.x - camX;
        const fy = ff.y - camY;
        if (fx < -20 || fx > viewW + 20 || fy < -20 || fy > viewH + 20) continue;
        const alpha = Math.max(0, 0.35 + Math.sin(ff.gp) * 0.65);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = C.firefly;
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
        const ffg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 12);
        ffg.addColorStop(0, `rgba(255,255,150,${alpha * 0.55})`);
        ffg.addColorStop(1, 'transparent');
        ctx.fillStyle = ffg;
        ctx.beginPath(); ctx.arc(fx, fy, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 10) Player
      drawPlayer(ctx, g.player, camX, camY, g.time, g.playerSprites);

      // 11) Particles
      for (const pt of g.particles) {
        const ptx = pt.x - camX, pty = pt.y - camY;
        if (ptx < -20 || ptx > viewW + 20 || pty < -20 || pty > viewH + 20) continue;
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect((ptx - pt.size / 2) | 0, (pty - pt.size / 2) | 0, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // 12) Fade-in overlay (em pixels de ecrã)
      if (g.fadeIn < 1) {
        ctx.fillStyle = `rgba(7,3,26,${1 - g.fadeIn})`;
        ctx.fillRect(0, 0, cW, cH);
      }

      // 13) Completion glow overlay
      if (g.complete && g.completeFade > 0) {
        ctx.fillStyle = `rgba(232,213,240,${g.completeFade * 0.18})`;
        ctx.fillRect(0, 0, cW, cH);
      }

      // 14) Hint interagir (E ou toque conforme modo)
      if (g.nearItemId) {
        const txt = mobileControlsRef.current ? 'Toque no item para interagir' : 'Pressione E para interagir';
        ctx.font = '14px monospace';
        const tw = ctx.measureText(txt).width;
        const bx = (cW - tw) / 2 - 12;
        const by = cH - 100;
        ctx.fillStyle = 'rgba(13,6,32,0.9)';
        ctx.strokeStyle = C.uiBorder;
        ctx.lineWidth = 2;
        ctx.fillRect(bx, by, tw + 24, 28);
        ctx.strokeRect(bx, by, tw + 24, 28);
        ctx.fillStyle = C.uiText;
        ctx.fillText(txt, (cW - tw) / 2, by + 19);
      }
    }

    // ─── GAME LOOP ────────────────────────────
    let lastTs = 0;
    function loop(ts: number) {
      const dt = Math.min((ts - lastTs) / 16.667, 3);
      lastTs = ts;
      update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(ts => { lastTs = ts; rafRef.current = requestAnimationFrame(loop); });

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      clearTimeout(hintTimer);
    };
  }, []);

  // Clique do rato OU toque: interagir com item (quando mobile controls ativado)
  const getClientXY = useCallback((e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if ('pointerType' in e) return { x: (e as React.PointerEvent).clientX, y: (e as React.PointerEvent).clientY };
    if ('touches' in e) {
      const t = (e as React.TouchEvent).changedTouches?.[0] ?? (e as React.TouchEvent).touches?.[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  }, []);

  const handleTapOrClick = useCallback((e: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    if (!mobileControlsRef.current) return;
    const canvas = canvasRef.current;
    const g = gRef.current;
    if (!canvas || !g) return;
    const coords = getClientXY(e);
    if (!coords) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (coords.x - rect.left) * scaleX;
    const clickY = (coords.y - rect.top) * scaleY;
    const cW = canvas.width, cH = canvas.height;
    // Mesma transformação do render: view (0,0) = canto do canvas, world (wx,wy) desenhado em ((wx-camX)*ZOOM, (wy-camY)*ZOOM)
    const worldX = clickX / CAMERA_ZOOM + g.camX;
    const worldY = clickY / CAMERA_ZOOM + g.camY;
    const TAP_RADIUS = 90;
    let nearestId: string | null = null;
    let nearestDist = TAP_RADIUS;
    for (const it of g.interactiveItems) {
      const dx = worldX - it.x, dy = worldY - it.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = it.id;
      }
    }
    if (!nearestId) return;
    const item = g.interactiveItems.find(i => i.id === nearestId)!;
    if (item.type === 'message' && item.message) {
      onInteractTriggerRef.current({ type: 'message', content: item.message });
    } else if (item.type === 'image' && item.imageUrl) {
      onInteractTriggerRef.current({ type: 'image', imageUrl: item.imageUrl, title: item.imageTitle, date: item.imageDate });
    } else if (item.type === 'music' && item.audioUrl) {
      // Se já está a tocar música (overlay ativo), toque de novo = parar
      if (overlayIsMusicRef.current) {
        onInteractTriggerRef.current(null);
        return;
      }
      // Evitar múltiplos inícios (ex.: pointerUp + touchEnd no mesmo toque)
      if (itemMusicRef.current) return;
      // No mobile o play() tem de ser no gesto do toque; criar e dar play aqui, depois setOverlay
      const audio = new Audio(item.audioUrl);
      audio.volume = 0.6;
      itemMusicRef.current = audio;
      if (gRef.current) {
        gRef.current.player.isDancing = true;
        gRef.current.player.danceTime = 0;
      }
      audio.addEventListener('ended', () => onInteractTriggerRef.current(null));
      audio.play().then(() => {
        onInteractTriggerRef.current({ type: 'music', audioUrl: item.audioUrl! });
      }).catch(() => {
        itemMusicRef.current = null;
        if (gRef.current) gRef.current.player.isDancing = false;
      });
    }
  }, [getClientXY]);

  // ─── JSX ──────────────────────────────────
  return (
    <div className="game-wrapper">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Overlay invisível para toque em itens (só quando mobile controls ativo); z-index 12, botões em 20 */}
      {mobileControls && (
        <div
          className="game-tap-overlay"
          onPointerUp={handleTapOrClick}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleTapOrClick(e);
          }}
          role="presentation"
          aria-hidden
        />
      )}

      {/* HUD */}
      <div className="game-hud">
        <div className="hud-box">
          <span className="hud-icon">✿</span>
          <span className="hud-label">Flores</span>
          <span className="hud-value">{ui.collected} / {ui.total}</span>
        </div>
      </div>

      {/* Back button */}
      <button className="game-back-btn" onClick={onBackToMenu}>
        ← Sair
      </button>

      {/* Controles mobile: esquerda, direita, pulo */}
      {mobileControls && (
        <div className="mobile-controls">
          <div className="dpad">
            <button
              type="button"
              className="dpad-btn"
              aria-label="Mover esquerda"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current.left = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchRef.current.left = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchRef.current.left = false; }}
              onPointerCancel={(e) => { e.preventDefault(); touchRef.current.left = false; }}
              onContextMenu={(e) => e.preventDefault()}
            >
              ←
            </button>
            <button
              type="button"
              className="dpad-btn"
              aria-label="Mover direita"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current.right = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchRef.current.right = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchRef.current.right = false; }}
              onPointerCancel={(e) => { e.preventDefault(); touchRef.current.right = false; }}
              onContextMenu={(e) => e.preventDefault()}
            >
              →
            </button>
          </div>
          <div className="jump-dpad">
            <button
              type="button"
              className="dpad-btn jump-btn"
              aria-label="Pular"
              onPointerDown={(e) => { e.preventDefault(); touchRef.current.jump = true; }}
              onPointerUp={(e) => { e.preventDefault(); touchRef.current.jump = false; touchRef.current.jumpHeld = false; }}
              onPointerLeave={(e) => { e.preventDefault(); touchRef.current.jump = false; touchRef.current.jumpHeld = false; }}
              onPointerCancel={(e) => { e.preventDefault(); touchRef.current.jump = false; touchRef.current.jumpHeld = false; }}
              onContextMenu={(e) => e.preventDefault()}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Controls hint */}
      {showHint && (
        <div className="controls-hint">
          <div className="hint-row">← → / A D{' \u00A0 '}para mover</div>
          <div className="hint-row">↑ / W / Espaço{' \u00A0 '}para pular. <br /> O jogo possui um pulo duplo, que pode ser utilizado pressionando a tecla de pulo duas vezes.</div>
          <div className="hint-row">{mobileControls ? 'Toque no item para interagir' : 'E \u00A0 para interagir com itens'}</div>
          <div className="hint-row" style={{ color: '#a78bfa', marginTop: 4 }}>
            Colete todas as flores dama-da-noite ✿
          </div>
        </div>
      )}

      {/* Overlay: mensagem */}
      {overlay?.type === 'message' && (
        <div className="interact-overlay" onClick={() => setOverlay(null)} role="presentation">
          <div className="interact-box interact-message" onClick={e => e.stopPropagation()}>
            <p className="interact-text">{overlay.content}</p>
            <button type="button" className="interact-close" onClick={() => setOverlay(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Overlay: imagem (título e data) */}
      {overlay?.type === 'image' && (
        <div className="interact-overlay" onClick={() => setOverlay(null)} role="presentation">
          <div className="interact-box interact-image" onClick={e => e.stopPropagation()}>
            {overlay.title != null && overlay.title !== '' && (
              <h3 className="interact-image-title">{overlay.title}</h3>
            )}
            <img src={overlay.imageUrl} alt={overlay.title ?? 'Item interativo'} className="interact-img" />
            <p className="interact-image-date">{overlay.date && overlay.date.trim() !== '' ? overlay.date : '—'}</p>
            <button type="button" className="interact-close" onClick={() => setOverlay(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Completion screen: vídeo ocupa a maior parte da tela, texto por cima */}
      {ui.phase === 'complete' && (
        <div className="completion-overlay completion-with-video">
          <div className="completion-video-container">
            <video
              ref={completionVideoRef}
              className="completion-video"
              src="/VideoFinal.mp4"
              autoPlay
              loop
              playsInline
            />
            <div className="completion-video-text-overlay" aria-hidden />
            <div className="completion-credits-wrap">
              <p className="completion-credits-text">
                {COMPLETION_MESSAGE.slice(0, completionVisibleChars)}
                {completionVisibleChars < COMPLETION_MESSAGE.length && (
                  <span className="completion-cursor">|</span>
                )}
              </p>
              {completionVisibleChars >= COMPLETION_MESSAGE.length && (
                <button type="button" className="completion-btn completion-btn-bottom" onClick={onBackToMenu}>
                  ← Voltar ao Menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
