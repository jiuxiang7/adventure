/* =========================================================================
   ADVENTURE — a side-scrolling bullet-hell flight
   Vanilla canvas game. Art and audio live under assets/.
   ========================================================================= */
(() => {
  "use strict";

  /* ---------------------------------------------------------------------
     Constants
     --------------------------------------------------------------------- */
  const W = 1280;
  const H = 720;
  const GROUND = 640;

  const PLAYER_H = 96;
  const PLAYER_W = PLAYER_H * (614 / 1008);
  const PLAYER_HALF = PLAYER_H / 2;
  const PLAYER_MIN_Y = 82 + PLAYER_HALF;
  const PLAYER_MAX_Y = GROUND - PLAYER_HALF;

  const ROOSTER_H = 238;
  const ROOSTER_W = ROOSTER_H * (791 / 1013);

  const SPRITE_CROP = {
    player: { x: 276, y: 180, w: 614, h: 1008 },
    boss1: { x: 0, y: 0, w: 394, h: 640 },
    boss1to2: { x: 0, y: 0, w: 796, h: 1015 },
    boss2: { x: 0, y: 0, w: 664, h: 738 },
    boss3: { x: 0, y: 0, w: 1001, h: 1416 },
    bullet1: { x: 0, y: 0, w: 767, h: 772 },
    bullet2: { x: 0, y: 0, w: 1227, h: 1396 },
    bullet3: { x: 0, y: 0, w: 1024, h: 1024 },
    playerbullet: { x: 2, y: 2, w: 750, h: 682 },
    mice: { x: 0, y: 0, w: 1079, h: 998 },
  };

  const IMAGE_SRC = {
    background1: "assets/images/background1.jpg",
    background2: "assets/images/background2.jpg",
    player: "assets/images/player.png",
    playerbullet: "assets/images/playerbullet.png",
    boss1: "assets/images/boss1.png",
    boss1to2: "assets/images/boss1to2.png",
    boss2: "assets/images/boss2.png",
    boss3: "assets/images/boss3.png",
    bullet1: "assets/images/bullet1.png",
    bullet2: "assets/images/bullet2.png",
    bullet3: "assets/images/bullet3.png",
    mice: "assets/images/mice.png",
  };

  const AUDIO_SRC = {
    fight1: "assets/audio/fight1.mp3",
    fight2: "assets/audio/fight2.mp3",
    victory1: "assets/audio/victory1.mp3",
  };

  const BULLET_STYLE = {
    bullet1: {
      w: 16,
      h: 16,
      r: 6.5,
      damage: 8,
      spin: 4.8,
    },
    bullet2: {
      w: 14,
      h: 16,
      r: 6.5,
      damage: 8,
      spin: 2.2,
    },
    bullet3: {
      w: 16,
      h: 16,
      r: 6.5,
      damage: 9,
      spin: 3.6,
    },
  };

  const BOSS_THEME = {
    boss1: { accent: "#ffad5b", accentSoft: "rgba(255, 141, 65, 0.18)" },
    boss2: { accent: "#ffe06a", accentSoft: "rgba(255, 214, 76, 0.18)" },
    boss3: { accent: "#6dccff", accentSoft: "rgba(80, 186, 255, 0.18)" },
  };

  const BODY_FONT =
    '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';
  const DISPLAY_FONT = 'Bahnschrift, "Arial Narrow", "Arial Black", Impact, sans-serif';
  const MONO_FONT = 'Consolas, "SFMono-Regular", "Cascadia Mono", monospace';

  /* ---------------------------------------------------------------------
     DOM, images, audio
     --------------------------------------------------------------------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stageEl = document.getElementById("stage");
  const loadingEl = document.getElementById("loading");
  const loadingBar = document.getElementById("loadingBar");
  const loadingText = document.getElementById("loadingText");

  const images = {};
  const audioTracks = {};
  let background2Processed = null;

  let audioCtx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let currentMusic = null;

  const view = { sx: 1, sy: 1, dpr: 1 };

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const TAU = Math.PI * 2;

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeOutBack = (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  function roundedRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fillRoundRect(x, y, w, h, r, fill) {
    roundedRectPath(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRoundRect(x, y, w, h, r, stroke, width = 1) {
    roundedRectPath(x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function text(str, x, y, opts = {}) {
    const {
      size = 16,
      weight = 600,
      color = "#ffffff",
      align = "left",
      baseline = "middle",
      font = BODY_FONT,
      spacing = 0,
      alpha = 1,
      shadow = null,
    } = opts;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
    if (shadow) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur ?? 12;
      ctx.shadowOffsetY = shadow.y ?? 0;
    }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawKeycap(x, y, w, h, label, accent = "#74f3ff", active = false) {
    ctx.save();
    const base = active ? "rgba(55, 89, 120, 0.96)" : "rgba(14, 21, 38, 0.94)";
    const border = active ? accent : "rgba(137, 196, 230, 0.3)";
    fillRoundRect(x, y + 3, w, h, 6, "rgba(0, 0, 0, 0.45)");
    fillRoundRect(x, y, w, h, 6, base);
    strokeRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, 6, border, 1);
    fillRoundRect(x + 7, y + 5, w - 14, 2, 1, "rgba(255, 255, 255, 0.1)");
    text(label, x + w / 2, y + h / 2 + 0.5, {
      size: label.length > 2 ? Math.min(11, h * 0.27) : Math.min(16, h * 0.43),
      weight: 800,
      color: active ? "#ffffff" : "rgba(225, 244, 255, 0.92)",
      align: "center",
      font: DISPLAY_FONT,
      spacing: label.length > 2 ? 1.4 : 0,
    });
    ctx.restore();
  }

  function drawSprite(key, x, y, w, h, opts = {}) {
    const img = images[key];
    if (!img) return;
    const crop = SPRITE_CROP[key] || { x: 0, y: 0, w: img.width, h: img.height };
    const {
      flip = false,
      rotation = 0,
      alpha = 1,
      filter = null,
      sx = 1,
      sy = 1,
      shadowColor = null,
      shadowBlur = 0,
    } = opts;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale((flip ? -1 : 1) * sx, sy);
    ctx.globalAlpha *= alpha;
    if (filter) ctx.filter = filter;
    if (shadowColor) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
    }
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.w,
      crop.h,
      -w / 2,
      -h / 2,
      w,
      h
    );
    ctx.restore();
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= cr * cr;
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  // The player's hurtbox follows the visible sprite bounds (rotor to wheels),
  // rather than a small circle hidden in the middle of the character.
  function getPlayerHitbox() {
    const p = game.player;
    if (!p) return null;
    return {
      x: p.x - PLAYER_W / 2,
      y: p.y - PLAYER_H / 2,
      w: PLAYER_W,
      h: PLAYER_H,
    };
  }

  function getBossHitbox(boss) {
    return {
      x: boss.x - boss.hitW / 2,
      y: boss.y - boss.hitH / 2,
      w: boss.hitW,
      h: boss.hitH,
    };
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  /* ---------------------------------------------------------------------
     Audio
     --------------------------------------------------------------------- */
  function setupAudioTracks() {
    for (const [key, src] of Object.entries(AUDIO_SRC)) {
      try {
        const track = new Audio(src);
        track.preload = "auto";
        track.loop = false;
        track.volume = 0.35;
        audioTracks[key] = track;
      } catch {
        /* Audio can be unavailable in some embedded browsers. */
      }
    }
  }

  function ensureAudio() {
    try {
      if (!audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        audioCtx = new AudioCtor();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.4;
        masterGain.connect(audioCtx.destination);

        const len = Math.floor(audioCtx.sampleRate * 0.6);
        noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    } catch {
      return null;
    }
    return audioCtx;
  }

  function tone(freq, endFreq, duration, type, volume, delay = 0) {
    if (!ensureAudio() || !masterGain) return;
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function noiseBurst(duration, volume, frequency, delay = 0) {
    if (!ensureAudio() || !masterGain || !noiseBuffer) return;
    const t0 = audioCtx.currentTime + delay;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(frequency, t0);
    filter.frequency.exponentialRampToValueAtTime(220, t0 + duration);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t0);
    src.stop(t0 + duration + 0.03);
  }

  const sfx = {
    shoot() {
      tone(740, 220, 0.065, "square", 0.012);
    },
    hit() {
      tone(190, 90, 0.055, "triangle", 0.018);
    },
    hurt() {
      noiseBurst(0.24, 0.075, 1200);
      tone(140, 55, 0.18, "sawtooth", 0.028);
    },
    bossShot() {
      tone(120, 75, 0.12, "sine", 0.028);
    },
    explode() {
      noiseBurst(0.45, 0.12, 1500);
      tone(90, 38, 0.4, "sawtooth", 0.035);
    },
    portal() {
      tone(240, 920, 0.4, "sine", 0.04);
      tone(360, 1220, 0.32, "triangle", 0.02, 0.04);
    },
    cheat() {
      tone(520, 1040, 0.13, "triangle", 0.028);
    },
    deflect() {
      tone(300, 900, 0.1, "sine", 0.026);
      tone(520, 1320, 0.08, "triangle", 0.016, 0.03);
    },
    charge() {
      tone(180, 520, 0.55, "sawtooth", 0.022);
      tone(340, 680, 0.4, "sine", 0.018, 0.12);
    },
    lock() {
      tone(900, 320, 0.12, "square", 0.02);
    },
    dash() {
      noiseBurst(0.22, 0.055, 950);
      tone(220, 75, 0.2, "sawtooth", 0.026);
    },
    win() {
      tone(440, 660, 0.42, "triangle", 0.04);
      tone(660, 990, 0.42, "triangle", 0.03, 0.12);
    },
  };

  function playMusic(name, loop = true, volume = 0.32) {
    const track = audioTracks[name];
    if (!track) return;
    if (currentMusic === name && !track.paused) {
      track.loop = loop;
      track.volume = volume;
      return;
    }
    stopMusic();
    currentMusic = name;
    try {
      track.loop = loop;
      track.volume = volume;
      track.currentTime = 0;
      const promise = track.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    } catch {
      /* Autoplay policies: game remains fully playable silently. */
    }
  }

  function stopMusic() {
    for (const track of Object.values(audioTracks)) {
      try {
        track.pause();
        track.currentTime = 0;
      } catch {
        /* noop */
      }
    }
    currentMusic = null;
  }

  function stopAllAudio() {
    stopMusic();
  }

  /* ---------------------------------------------------------------------
     Game state
     --------------------------------------------------------------------- */
  const game = {
    mode: "boot",
    time: 0,
    modeTime: 0,
    stage: 0,
    stageTime: 0,
    bg: "background1",
    player: null,
    boss: null,
    playerBullets: [],
    enemyBullets: [],
    particles: [],
    shockwaves: [],
    damageTexts: [],
    ghosts: [],
    motes: [],
    rain: [],
    stars: [],
    shake: 0,
    flash: 0,
    damageVignette: 0,
    introFade: 1,
    transition: null,
    stageBanner: null,
    toast: null,
    exitReady: false,
    victoryStage: 0,
    adventureStart: 0,
    adventureEnd: 0,
    pointer: { x: W / 2, y: H / 2, hoverButton: false },
    overButton: { x: W / 2 - 136, y: 438, w: 272, h: 58 },
    lastBossKind: null,
    combatEnabled: false,
    lowHpPulse: 0,
    cheat: false,
    mice: null,
  };

  function makeMice() {
    return {
      x: W / 2,
      y: GROUND - 30,
      drawW: 65,
      drawH: 60,
      hitW: 68,
      hitH: 60,
      flash: 0,
      pulse: 0,
      hintShown: false,
    };
  }

  function makePlayer(x = 180, y = PLAYER_MAX_Y) {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      face: 1,
      hp: 100,
      maxHp: 100,
      displayHp: 100,
      invuln: 1,
      shootCd: 0.2,
      muzzle: 0,
      grounded: true,
      dead: false,
      ghostTimer: 0,
      thrusterTimer: 0,
      rotor: 0,
    };
  }

  /* ---------------------------------------------------------------------
     Boss factories
     --------------------------------------------------------------------- */
  function makeBoss1(x, y) {
    return {
      kind: "boss1",
      sprite: "boss1",
      x,
      y,
      drawW: 270 * (394 / 640),
      drawH: 270,
      hitW: 154,
      hitH: 246,
      hp: 400,
      maxHp: 400,
      hpDisplay: 400,
      active: false,
      dying: false,
      t: 0,
      rot: 0,
      face: 1,
      artFacesLeft: false,
      flash: 0,
      firePulse: 0,
      scale: 1,
      spawnScale: 1,
      shootTimer: 1.4,
      ringTimer: 3.5,
      rainTimer: 6.6,
      name: "Cai Xukun",
      cn: "神秘背带裤男",
      theme: BOSS_THEME.boss1,
      entryT: 0,
      phase2: false,
    };
  }

  function makeBoss2(x, y) {
    return {
      kind: "boss2",
      sprite: "boss2",
      x,
      y,
      drawW: 252 * (664 / 738),
      drawH: 252,
      hitW: 198,
      hitH: 226,
      hp: 560,
      maxHp: 560,
      hpDisplay: 560,
      active: false,
      dying: false,
      t: 0,
      rot: 0,
      face: -1,
      artFacesLeft: true,
      flash: 0,
      firePulse: 0,
      scale: 1,
      spawnScale: 1,
      shootTimer: 1.5,
      ringTimer: 2.7,
      sweepTimer: 5.6,
      name: "Nai Chicken",
      cn: "奶鸡",
      theme: BOSS_THEME.boss2,
      phase2: false,
    };
  }

  function makeBoss3(x, y) {
    return {
      kind: "boss3",
      sprite: "boss3",
      x,
      y,
      drawW: 320 * (1001 / 1416),
      drawH: 320,
      hitW: 206,
      hitH: 300,
      hp: 800,
      maxHp: 800,
      hpDisplay: 800,
      active: false,
      dying: false,
      t: 0,
      rot: 0,
      face: -1,
      artFacesLeft: true,
      flash: 0,
      firePulse: 0,
      scale: 1,
      spawnScale: 1,
      shootTimer: 1.2,
      spiralTimer: 0.8,
      spiralAngle: 0,
      ringTimer: 3.4,
      name: "USTC",
      cn: "电❤️我",
      theme: BOSS_THEME.boss3,
      phase2: false,
      homeX: x,
      homeY: y,
      specialTimer: rand(8, 13),
      dashState: "idle",
      dashTime: 0,
      dashAngle: 0,
      dashLocked: false,
      dashTargetX: x,
      dashTargetY: y,
      dashTravelled: 0,
      dashDistance: 0,
      dashSide: -1,
      dashHit: false,
      settleFromX: x,
      settleFromY: y,
      settleToX: x,
      settleToY: y,
      dashFromX: x,
      dashFromY: y,
      dashDirX: 0,
      dashDirY: 1,
    };
  }

  function makeRooster(x, y, face = 1, leaving = false) {
    return {
      kind: "rooster",
      sprite: "boss1to2",
      x,
      y,
      exitBaseY: y,
      drawW: ROOSTER_W,
      drawH: ROOSTER_H,
      hitW: 0,
      hitH: 0,
      active: false,
      dying: false,
      leaving,
      t: 0,
      rot: 0,
      face,
      artFacesLeft: false,
      flash: 0,
      firePulse: 0,
      scale: 1,
      spawnScale: 1,
      hp: 0,
      maxHp: 0,
      hpDisplay: 0,
      name: "",
      cn: "",
      theme: BOSS_THEME.boss1,
    };
  }

  /* ---------------------------------------------------------------------
     Particles / effects
     --------------------------------------------------------------------- */
  function spawnParticle(opts) {
    if (game.particles.length > 420) return;
    const life = opts.life ?? rand(0.3, 0.8);
    game.particles.push({
      x: opts.x,
      y: opts.y,
      vx: opts.vx ?? rand(-120, 120),
      vy: opts.vy ?? rand(-120, 120),
      gravity: opts.gravity ?? 0,
      life,
      maxLife: life,
      size: opts.size ?? rand(1.5, 4),
      color: opts.color ?? "#ffffff",
      alpha: opts.alpha ?? 1,
      shape: opts.shape ?? "dot",
      rot: opts.rot ?? rand(0, TAU),
      spin: opts.spin ?? rand(-8, 8),
      drag: opts.drag ?? 0.985,
    });
  }

  function burst(x, y, options = {}) {
    const {
      count = 12,
      colors = ["#ffffff", "#6df4ff"],
      speedMin = 40,
      speedMax = 240,
      lifeMin = 0.25,
      lifeMax = 0.75,
      sizeMin = 1.4,
      sizeMax = 4,
      gravity = 80,
      shape = "spark",
      angleMin = 0,
      angleMax = TAU,
    } = options;
    for (let i = 0; i < count; i += 1) {
      const angle = rand(angleMin, angleMax);
      const speed = rand(speedMin, speedMax);
      spawnParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity,
        life: rand(lifeMin, lifeMax),
        size: rand(sizeMin, sizeMax),
        color: colors[randInt(0, colors.length - 1)],
        shape,
        spin: rand(-14, 14),
      });
    }
  }

  function shockwave(x, y, maxR, color, lineWidth = 2.5, life = 0.45) {
    game.shockwaves.push({
      x,
      y,
      r: 0,
      maxR,
      color,
      width: lineWidth,
      life,
      maxLife: life,
    });
  }

  function damageText(x, y, str, color = "#ffffff") {
    game.damageTexts.push({
      x,
      y,
      text: str,
      color,
      life: 0.62,
      maxLife: 0.62,
      vx: rand(-18, 18),
      vy: rand(-72, -42),
    });
  }

  function spawnGhost(player) {
    if (game.ghosts.length > 12) return;
    game.ghosts.push({
      x: player.x,
      y: player.y,
      face: player.face,
      life: 0.28,
      maxLife: 0.28,
    });
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        game.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }

    for (let i = game.shockwaves.length - 1; i >= 0; i -= 1) {
      const s = game.shockwaves[i];
      s.life -= dt;
      if (s.life <= 0) {
        game.shockwaves.splice(i, 1);
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      s.r = s.maxR * easeOutCubic(t);
    }

    for (let i = game.damageTexts.length - 1; i >= 0; i -= 1) {
      const d = game.damageTexts[i];
      d.life -= dt;
      if (d.life <= 0) {
        game.damageTexts.splice(i, 1);
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 80 * dt;
    }

    for (let i = game.ghosts.length - 1; i >= 0; i -= 1) {
      const g = game.ghosts[i];
      g.life -= dt;
      if (g.life <= 0) game.ghosts.splice(i, 1);
    }
  }

  function updateAtmosphere(dt) {
    const t = game.time;
    for (const m of game.motes) {
      m.y -= m.speed * dt;
      m.x += Math.sin(t * m.drift + m.phase) * m.wobble * dt;
      if (m.y < -10) {
        m.y = H + 10;
        m.x = rand(0, W);
      }
    }
    if (game.bg === "background2" || game.stage >= 2) {
      for (const r of game.rain) {
        r.y += r.speed * dt;
        r.x += r.drift * dt;
        if (r.y > H + 30) {
          r.y = rand(-120, -20);
          r.x = rand(0, W);
        }
      }
    }
  }

  /* ---------------------------------------------------------------------
     Setup / reset
     --------------------------------------------------------------------- */
  function initAtmosphere() {
    game.motes = [];
    for (let i = 0; i < 54; i += 1) {
      game.motes.push({
        x: rand(0, W),
        y: rand(0, H),
        speed: rand(4, 22),
        wobble: rand(2, 15),
        phase: rand(0, TAU),
        drift: rand(0.4, 1.6),
        size: rand(0.5, 2),
        alpha: rand(0.08, 0.38),
      });
    }
    game.rain = [];
    for (let i = 0; i < 42; i += 1) {
      game.rain.push({
        x: rand(0, W),
        y: rand(-H, H),
        speed: rand(320, 700),
        length: rand(10, 34),
        drift: rand(-14, -2),
        alpha: rand(0.08, 0.24),
      });
    }
    game.stars = [];
    for (let i = 0; i < 64; i += 1) {
      game.stars.push({
        x: rand(0, W),
        y: rand(70, GROUND - 30),
        size: rand(0.6, 2),
        phase: rand(0, TAU),
        speed: rand(0.6, 2.4),
      });
    }
  }

  function resetCombat() {
    game.playerBullets.length = 0;
    game.enemyBullets.length = 0;
    game.particles.length = 0;
    game.shockwaves.length = 0;
    game.damageTexts.length = 0;
    game.ghosts.length = 0;
    game.boss = null;
    game.mice = makeMice();
    game.stageBanner = null;
    game.toast = null;
    game.exitReady = false;
    game.victoryStage = 0;
    game.combatEnabled = false;
    game.lastBossKind = null;
  }

  function resetToIntro() {
    stopAllAudio();
    resetCombat();
    game.mode = "intro";
    game.stage = 0;
    game.stageTime = 0;
    game.modeTime = 0;
    game.bg = "intro";
    game.player = makePlayer(180, PLAYER_MAX_Y);
    game.player.hp = 100;
    game.player.displayHp = 100;
    game.player.invuln = 0.7;
    game.shake = 0;
    game.flash = 0;
    game.damageVignette = 0;
    game.introFade = 1;
    game.transition = null;
    game.adventureStart = 0;
    game.adventureEnd = 0;
    game.lowHpPulse = 0;
    game.pointer.hoverButton = false;
    canvas.style.cursor = "crosshair";
    keys.clear();
  }

  function setupStage1() {
    resetCombat();
    game.stage = 1;
    game.bg = "background1";
    game.mode = "stage1_enter";
    game.modeTime = 0;
    game.stageTime = 0;
    game.combatEnabled = false;
    game.player.x = 140;
    game.player.y = PLAYER_MAX_Y;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.face = 1;
    game.player.invuln = 2.2;
    game.player.dead = false;
    game.player.shootCd = 0.25;
    game.boss = makeBoss1(W + 190, 305);
    game.boss.entryT = 0;
    if (!game.adventureStart) game.adventureStart = game.time;
    game.stageBanner = {
      title: "STAGE 01",
      sub: "个人练习生 · Sing Dance Rap Basketball",
      accent: "#69efff",
      time: 0,
      duration: 2.7,
    };
    playMusic("fight1", true, 0.3);
    sfx.portal();
    burst(game.player.x, game.player.y, {
      count: 16,
      colors: ["#7cf8ff", "#9a8cff", "#ffffff"],
      speedMin: 20,
      speedMax: 140,
      gravity: -20,
      lifeMin: 0.3,
      lifeMax: 0.8,
    });
  }

  function setupStage2() {
    resetCombat();
    game.stage = 2;
    game.bg = "background2";
    game.mode = "stage2_intro";
    game.modeTime = 0;
    game.stageTime = 0;
    game.combatEnabled = false;
    game.player.x = 105;
    game.player.y = PLAYER_MAX_Y;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.face = 1;
    game.player.invuln = 2.5;
    game.player.dead = false;
    game.player.shootCd = 0.25;
    game.boss = makeRooster(1045, GROUND - ROOSTER_H / 2 - 4, -1, false);
    game.stageBanner = {
      title: "STAGE 02",
      sub: "根本没有这样的生物 · You Are Just Scared",
      accent: "#ffe275",
      time: 0,
      duration: 2.8,
    };
    stopMusic();
    sfx.portal();
    burst(game.player.x, game.player.y, {
      count: 18,
      colors: ["#ffe576", "#8af4ff", "#ffffff"],
      speedMin: 30,
      speedMax: 160,
      gravity: -12,
      lifeMin: 0.3,
      lifeMax: 0.9,
    });
    burst(game.boss.x, game.boss.y, {
      count: 15,
      colors: ["#ffe576", "#ff8b56", "#ffffff"],
      speedMin: 10,
      speedMax: 110,
      gravity: -20,
      lifeMin: 0.4,
      lifeMax: 1,
    });
  }

  function startStage3() {
    const previousBoss = game.boss;
    const x = previousBoss ? previousBoss.x : 1000;
    const y = previousBoss ? previousBoss.y : 340;
    game.stage = 3;
    game.mode = "fight";
    game.modeTime = 0;
    game.stageTime = 0;
    game.combatEnabled = true;
    game.boss = makeBoss3(x, y);
    game.boss.active = true;
    game.boss.spawnScale = 0.35;
    game.boss.hpDisplay = game.boss.maxHp;
    game.player.invuln = Math.max(game.player.invuln, 2);
    game.stageBanner = {
      title: "FINAL STAGE",
      sub: "求实求真 · Fake News",
      accent: "#7fd4ff",
      time: 0,
      duration: 3,
    };
    game.flash = Math.max(game.flash, 0.92);
    game.shake = 28;
    stopMusic();
    playMusic("fight2", true, 0.35);
    sfx.explode();
    shockwave(x, y, 350, "rgba(118, 218, 255, 0.8)", 4, 0.8);
    burst(x, y, {
      count: 48,
      colors: ["#ffffff", "#7ad8ff", "#ff5b8d", "#968cff"],
      speedMin: 50,
      speedMax: 420,
      gravity: 20,
      lifeMin: 0.35,
      lifeMax: 1.2,
      sizeMin: 1.4,
      sizeMax: 5,
    });
  }

  /* ---------------------------------------------------------------------
     Input
     --------------------------------------------------------------------- */
  const keys = new Set();
  const controlCodes = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyR",
    "Enter",
  ]);

  function isCheatShortcut(e) {
    return (
      e.ctrlKey &&
      e.shiftKey &&
      !e.altKey &&
      !e.metaKey &&
      (e.code === "KeyC" || e.key === "C" || e.key === "c")
    );
  }

  function toggleCheat() {
    game.cheat = !game.cheat;
    if (game.cheat && game.player && !game.player.dead) {
      game.player.invuln = Math.max(game.player.invuln, 0.35);
    }
    game.toast = {
      text: game.cheat ? "作弊模式开启" : "作弊模式关闭",
      sub: game.cheat ? "GOD MODE // 不会受到伤害" : "DAMAGE ENABLED",
      time: 0,
      duration: 1.35,
      accent: "#ffc765",
    };
    sfx.cheat();
  }

  function keyDown(e) {
    if (isCheatShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) toggleCheat();
      return;
    }
    if (controlCodes.has(e.code)) e.preventDefault();
    ensureAudio();
    if (e.repeat) return;
    keys.add(e.code);

    if (e.code === "KeyR") {
      if (game.mode === "gameover" || game.mode === "complete") {
        resetToIntro();
      }
    }
    if (e.code === "Enter") {
      if (game.mode === "gameover" || game.mode === "complete") {
        resetToIntro();
      }
    }
  }

  function keyUp(e) {
    if (controlCodes.has(e.code)) e.preventDefault();
    keys.delete(e.code);
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function isOverButton(pos) {
    const b = game.overButton;
    return pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h;
  }

  function pointerDown(e) {
    ensureAudio();
    const pos = pointerPos(e);
    game.pointer.x = pos.x;
    game.pointer.y = pos.y;
    if (game.mode === "gameover" || game.mode === "complete") {
      if (isOverButton(pos)) {
        resetToIntro();
        return;
      }
    }
  }

  function pointerMove(e) {
    const pos = pointerPos(e);
    game.pointer.x = pos.x;
    game.pointer.y = pos.y;
    game.pointer.hoverButton =
      (game.mode === "gameover" || game.mode === "complete") && isOverButton(pos);
    canvas.style.cursor = game.pointer.hoverButton ? "pointer" : "crosshair";
  }

  /* ---------------------------------------------------------------------
     Player
     --------------------------------------------------------------------- */
  function updatePlayer(dt, controlEnabled = true) {
    const p = game.player;
    if (!p || p.dead) return;

    const left = controlEnabled && (keys.has("KeyA") || keys.has("ArrowLeft"));
    const right = controlEnabled && (keys.has("KeyD") || keys.has("ArrowRight"));
    const up = controlEnabled && (keys.has("KeyW") || keys.has("ArrowUp"));
    const down = controlEnabled && (keys.has("KeyS") || keys.has("ArrowDown"));

    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) {
      p.vx += dir * 2350 * dt;
      p.face = dir;
    } else {
      p.vx *= Math.pow(0.0007, dt);
    }
    p.vx = clamp(p.vx, -330, 330);

    if (up) p.vy -= 2250 * dt;
    if (down) p.vy += 1300 * dt;
    p.vy += 1000 * dt;
    p.vy = clamp(p.vy, -350, 560);

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotor += dt * 24;

    if (p.x < 48) {
      p.x = 48;
      p.vx = Math.max(0, p.vx);
    }
    if (p.x > W - 48) {
      p.x = W - 48;
      p.vx = Math.min(0, p.vx);
    }
    if (p.y < PLAYER_MIN_Y) {
      p.y = PLAYER_MIN_Y;
      p.vy = Math.max(0, p.vy);
    }
    if (p.y >= PLAYER_MAX_Y) {
      p.y = PLAYER_MAX_Y;
      p.vy = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
    }

    p.invuln = Math.max(0, p.invuln - dt);
    p.shootCd -= dt;
    p.muzzle = Math.max(0, p.muzzle - dt);

    if (up) {
      p.thrusterTimer -= dt;
      if (p.thrusterTimer <= 0) {
        p.thrusterTimer = 0.035;
        spawnParticle({
          x: p.x + rand(-9, 13),
          y: p.y + PLAYER_HALF - 10,
          vx: rand(-24, 24),
          vy: rand(80, 180),
          gravity: -60,
          life: rand(0.14, 0.3),
          size: rand(1.2, 3),
          color: Math.random() > 0.45 ? "#7ef4ff" : "#ffffff",
          shape: "spark",
          alpha: 0.85,
        });
      }
    }

    p.ghostTimer -= dt;
    if ((Math.abs(p.vx) > 190 || up) && p.ghostTimer <= 0) {
      p.ghostTimer = 0.055;
      spawnGhost(p);
    }

    if (controlEnabled && keys.has("Space") && p.shootCd <= 0) {
      shootPlayerBullet();
    }
  }

  function shootPlayerBullet() {
    const p = game.player;
    if (!p || p.dead) return;
    p.shootCd = 0.11;
    p.muzzle = 0.07;
    const dir = p.face < 0 ? -1 : 1;
    const bx = p.x + dir * (PLAYER_W / 2 - 8);
    const by = p.y - 6;
    game.playerBullets.push({
      x: bx,
      y: by,
      vx: 940 * dir,
      vy: 0,
      r: 5.5,
      damage: 9,
      life: 2.4,
      age: 0,
      deflected: false,
    });
    game.shake = Math.max(game.shake, 0.9);
    sfx.shoot();
    for (let i = 0; i < 2; i += 1) {
      spawnParticle({
        x: bx,
        y: by,
        vx: rand(50, 170) * dir,
        vy: rand(-35, 35),
        life: rand(0.08, 0.2),
        size: rand(1, 2.4),
        color: i ? "#ffd166" : "#ff753d",
        shape: "spark",
        gravity: 0,
      });
    }
  }

  function updatePlayerBullets(dt) {
    for (let i = game.playerBullets.length - 1; i >= 0; i -= 1) {
      const b = game.playerBullets[i];
      if (!b) {
        game.playerBullets.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.age += dt;

      let remove =
        b.life <= 0 ||
        b.x > W + 80 ||
        b.x < -80 ||
        b.y < -80 ||
        b.y > H + 80;

      // The MICE gadget at the bottom-centre refracts any player shot upward.
      if (!remove && !b.deflected && game.mice) {
        const m = game.mice;
        const mx = m.x - m.hitW / 2;
        const my = m.y - m.hitH / 2;
        if (circleRect(b.x, b.y, b.r, mx, my, m.hitW, m.hitH)) {
          b.x = m.x;
          b.y = my - 6;
          b.vx = 0;
          b.vy = -1000;
          b.life = 2.2;
          b.age = 0;
          b.deflected = true;
          m.flash = 0.24;
          m.pulse = 1;
          game.shake = Math.max(game.shake, 3);
          sfx.deflect();
          shockwave(m.x, my, 58, "rgba(114, 244, 255, 0.8)", 2, 0.35);
          burst(m.x, my, {
            count: 10,
            colors: ["#8ff6ff", "#ffffff", "#ffd166"],
            speedMin: 25,
            speedMax: 140,
            gravity: -20,
            lifeMin: 0.15,
            lifeMax: 0.4,
            sizeMin: 1,
            sizeMax: 2.6,
            angleMin: Math.PI,
            angleMax: TAU,
          });
          if (!m.hintShown) {
            m.hintShown = true;
            game.toast = {
              text: "MICE // 弹道折射",
              sub: "玩家子弹已转为向上发射",
              time: 0,
              duration: 1.6,
              accent: "#82f5ff",
            };
          }
        }
      }

      if (!remove && game.boss && game.boss.active && !game.boss.dying) {
        const bossHitbox = getBossHitbox(game.boss);
        if (
          circleRect(
            b.x,
            b.y,
            b.r,
            bossHitbox.x,
            bossHitbox.y,
            bossHitbox.w,
            bossHitbox.h
          )
        ) {
          damageBoss(b.damage, b.x, b.y);
          remove = true;
        }
      }

      if (remove) game.playerBullets.splice(i, 1);
    }
  }

  function hurtPlayer(amount, sourceX = null, sourceY = null) {
    const p = game.player;
    if (!p || p.dead || p.invuln > 0) return;
    if (game.mode === "gameover" || game.mode === "complete") return;

    if (game.cheat) {
      p.invuln = Math.max(p.invuln, 0.35);
      game.damageVignette = Math.max(game.damageVignette, 0.32);
      game.flash = Math.max(game.flash, 0.08);
      game.shake = Math.max(game.shake, 4);
      sfx.hit();
      shockwave(p.x, p.y, 66, "rgba(255, 209, 102, 0.8)", 2, 0.3);
      burst(p.x, p.y, {
        count: 7,
        colors: ["#ffe19a", "#ffffff"],
        speedMin: 20,
        speedMax: 110,
        gravity: 20,
        lifeMin: 0.12,
        lifeMax: 0.32,
        sizeMin: 1,
        sizeMax: 2.5,
      });
      return;
    }

    p.hp = Math.max(0, p.hp - amount);
    p.invuln = 1.25;
    game.damageVignette = 1;
    game.flash = Math.max(game.flash, 0.2);
    game.shake = Math.max(game.shake, 16);
    sfx.hurt();
    shockwave(p.x, p.y, 90, "rgba(255, 92, 128, 0.85)", 3, 0.35);
    burst(p.x, p.y, {
      count: 18,
      colors: ["#ff6b85", "#ffd166", "#ffffff"],
      speedMin: 60,
      speedMax: 280,
      gravity: 160,
      lifeMin: 0.25,
      lifeMax: 0.7,
    });

    if (sourceX !== null) {
      const dir = Math.sign(p.x - sourceX) || -1;
      p.vx = dir * 260;
      p.vy = Math.min(p.vy, -80);
    } else {
      p.vy = Math.min(p.vy, -50);
    }

    if (p.hp <= 0) triggerGameOver();
  }

  function checkBossContact() {
    const b = game.boss;
    const p = game.player;
    if (!b || !b.active || !p || p.dead) return;
    if (b.hitW <= 0) return;
    if (p.invuln > 0) return;
    const playerHitbox = getPlayerHitbox();
    const bossHitbox = getBossHitbox(b);
    if (playerHitbox && rectsOverlap(playerHitbox, bossHitbox)) {
      const isDash =
        b.kind === "boss3" && b.dashState === "dash" && !b.dashHit;
      hurtPlayer(isDash ? 38 : 22, b.x, b.y);
      if (isDash) {
        b.dashHit = true;
        game.shake = Math.max(game.shake, 26);
        game.flash = Math.max(game.flash, 0.24);
        shockwave(p.x, p.y, 152, "rgba(255, 221, 136, 0.9)", 4, 0.5);
      }
      if (game.mode === "fight" && !game.cheat) {
        p.x -= 24;
        p.vx = -220;
        shockwave(p.x, p.y, 88, "rgba(255, 255, 255, 0.5)", 2, 0.3);
      }
    }
  }

  /* ---------------------------------------------------------------------
     Enemy bullets & boss attacks
     --------------------------------------------------------------------- */
  function spawnEnemyBullet(kind, x, y, angle, speed, opts = {}) {
    if (game.enemyBullets.length > 420) return;
    const style = BULLET_STYLE[kind];
    const b = {
      kind,
      sprite: kind,
      x,
      y,
      vx: Math.cos(angle) * speed + (opts.vx || 0),
      vy: Math.sin(angle) * speed + (opts.vy || 0),
      r: style.r,
      w: style.w,
      h: style.h,
      damage: style.damage,
      spin: opts.spin ?? style.spin * (Math.random() > 0.5 ? 1 : -1),
      rot: opts.rot ?? rand(0, TAU),
      life: opts.life ?? 8,
      age: 0,
      accel: opts.accel ?? 0,
      maxSpeed: opts.maxSpeed ?? 520,
      wobble: opts.wobble ?? 0,
      wobbleSpeed: opts.wobbleSpeed ?? 5,
      baseAngle: angle,
      aim: opts.aim ?? false,
    };
    game.enemyBullets.push(b);
  }

  function fireFan(kind, x, y, baseAngle, count, spread, speed) {
    const start = baseAngle - spread / 2;
    const step = count > 1 ? spread / (count - 1) : 0;
    for (let i = 0; i < count; i += 1) {
      spawnEnemyBullet(kind, x, y, start + step * i, speed);
    }
  }

  function fireAimedFan(boss, kind, count, spread, speed, muzzleOffset = 42) {
    const p = game.player;
    const muzzleDir =
      boss.kind === "boss3" ? (boss.face >= 0 ? 1 : -1) : -1;
    const ox = boss.x + muzzleDir * muzzleOffset;
    const oy = boss.y + 8;
    const aim = Math.atan2(p.y - oy, p.x - ox);
    fireFan(kind, ox, oy, aim, count, spread, speed);
    boss.firePulse = 0.18;
    game.shake = Math.max(game.shake, 2);
    sfx.bossShot();
  }

  function fireRing(boss, kind, count, speed, offset = 0) {
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * TAU;
      spawnEnemyBullet(kind, boss.x, boss.y, angle, speed, {
        rot: angle,
      });
    }
    boss.firePulse = 0.24;
    shockwave(boss.x, boss.y, 120, "rgba(255, 255, 255, 0.25)", 1.5, 0.35);
    game.shake = Math.max(game.shake, 3);
    sfx.bossShot();
  }

  function updateEnemyBullets(dt) {
    const p = game.player;
    for (let i = game.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = game.enemyBullets[i];
      if (!b) {
        game.enemyBullets.splice(i, 1);
        continue;
      }
      b.age += dt;
      b.life -= dt;
      b.rot += b.spin * dt;

      if (b.accel) {
        const speed = Math.hypot(b.vx, b.vy);
        const next = Math.min(b.maxSpeed, speed + b.accel * dt);
        const scale = speed > 0.01 ? next / speed : 1;
        b.vx *= scale;
        b.vy *= scale;
      }
      if (b.wobble) {
        const perp = b.baseAngle + Math.PI / 2;
        const force = Math.sin(b.age * b.wobbleSpeed) * b.wobble * dt;
        b.x += Math.cos(perp) * force;
        b.y += Math.sin(perp) * force;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const off =
        b.x < -100 ||
        b.x > W + 100 ||
        b.y < -130 ||
        b.y > H + 110 ||
        b.life <= 0;

      if (off) {
        game.enemyBullets.splice(i, 1);
        continue;
      }

      if (
        p &&
        !p.dead &&
        p.invuln <= 0 &&
        game.mode !== "gameover" &&
        game.mode !== "complete"
      ) {
        const playerHitbox = getPlayerHitbox();
        if (
          playerHitbox &&
          circleRect(
            b.x,
            b.y,
            b.r * 0.9,
            playerHitbox.x,
            playerHitbox.y,
            playerHitbox.w,
            playerHitbox.h
          )
        ) {
          hurtPlayer(b.damage, b.x, b.y);
          burst(b.x, b.y, {
            count: 10,
            colors: ["#ffffff", "#ffbf6e", "#ff5d80"],
            speedMin: 30,
            speedMax: 180,
            gravity: 30,
            lifeMin: 0.15,
            lifeMax: 0.45,
          });
          game.enemyBullets.splice(i, 1);
        }
      }
    }
  }

  function updateBossFight(dt) {
    const b = game.boss;
    if (!b || !b.active) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.firePulse = Math.max(0, b.firePulse - dt);
    b.spawnScale = lerp(b.spawnScale, 1, Math.min(1, dt * 5.5));
    b.hpDisplay += (b.hp - b.hpDisplay) * Math.min(1, dt * 8);

    if (b.kind === "boss1") updateBoss1(b, dt);
    else if (b.kind === "boss2") updateBoss2(b, dt);
    else if (b.kind === "boss3") updateBoss3(b, dt);
  }

  function updateBoss1(b, dt) {
    const t = b.t;
    const phase2 = b.hp < b.maxHp * 0.45;
    if (phase2 && !b.phase2) {
      b.phase2 = true;
      b.flash = 0.4;
      game.flash = Math.max(game.flash, 0.28);
      shockwave(b.x, b.y, 250, "rgba(255, 173, 91, 0.7)", 3, 0.5);
    }

    b.x = 968 + Math.sin(t * 0.88) * (phase2 ? 55 : 38);
    b.y = 320 + Math.sin(t * 1.68) * (phase2 ? 122 : 108) + Math.sin(t * 3.2) * 12;
    b.rot = Math.sin(t * 1.9) * 0.024;
    b.face = 1;

    b.shootTimer -= dt;
    b.ringTimer -= dt;
    b.rainTimer -= dt;

    if (b.shootTimer <= 0) {
      const count = phase2 ? 5 : 3;
      const spread = phase2 ? 0.34 : 0.22;
      fireAimedFan(b, "bullet1", count, spread, phase2 ? 285 : 245, 48);
      b.shootTimer = phase2 ? 0.82 : 1.16;
    }

    if (b.ringTimer <= 0) {
      fireRing(b, "bullet1", phase2 ? 16 : 13, phase2 ? 178 : 158, rand(0, TAU));
      b.ringTimer = phase2 ? 3.3 : 4.2;
    }

    if (b.rainTimer <= 0) {
      const drops = phase2 ? 8 : 6;
      for (let i = 0; i < drops; i += 1) {
        const x = rand(140, W - 120);
        spawnEnemyBullet("bullet1", x, rand(-140, -20), Math.PI / 2 + rand(-0.12, 0.12), rand(200, 280), {
          life: 6,
        });
      }
      game.toast = {
        text: "篮板球来袭",
        sub: "注意上方",
        time: 0,
        duration: 1.3,
        accent: "#ffb15f",
      };
      b.rainTimer = phase2 ? 5.6 : 7;
      b.firePulse = 0.25;
    }
  }

  function updateBoss2(b, dt) {
    const t = b.t;
    const phase2 = b.hp < b.maxHp * 0.45;
    if (phase2 && !b.phase2) {
      b.phase2 = true;
      b.flash = 0.4;
      game.flash = Math.max(game.flash, 0.3);
      shockwave(b.x, b.y, 260, "rgba(255, 224, 106, 0.75)", 3, 0.5);
    }

    b.x = 1008 + Math.sin(t * 1.05) * (phase2 ? 70 : 54);
    b.y = 322 + Math.sin(t * 1.48) * (phase2 ? 108 : 92) + Math.sin(t * 2.8) * 13;
    b.rot = Math.sin(t * 2.05) * 0.045;
    b.face = -1;

    b.shootTimer -= dt;
    b.ringTimer -= dt;
    b.sweepTimer -= dt;

    if (b.shootTimer <= 0) {
      const count = phase2 ? 5 : 3;
      const spread = phase2 ? 0.33 : 0.21;
      fireAimedFan(b, "bullet2", count, spread, phase2 ? 262 : 222, 34);
      b.shootTimer = phase2 ? 1.0 : 1.35;
    }

    if (b.ringTimer <= 0) {
      fireRing(b, "bullet2", phase2 ? 19 : 15, phase2 ? 172 : 150, t * 0.41);
      b.ringTimer = phase2 ? 2.15 : 2.85;
    }

    if (b.sweepTimer <= 0) {
      const count = phase2 ? 8 : 6;
      const p = game.player;
      const base = Math.atan2(p.y - b.y, p.x - b.x);
      for (let i = 0; i < count; i += 1) {
        const angle = base + (i - (count - 1) / 2) * 0.19;
        spawnEnemyBullet("bullet2", b.x - 20, b.y + 26, angle, 180 + i * 10, {
          wobble: 70,
          wobbleSpeed: 4.2 + i * 0.3,
          spin: rand(-2, 2),
          life: 7,
        });
      }
      b.firePulse = 0.2;
      b.sweepTimer = phase2 ? 4.1 : 5.7;
      game.shake = Math.max(game.shake, 4);
      sfx.bossShot();
    }
  }

  function startBoss3Special(b) {
    b.dashState = "rise";
    b.dashTime = 0;
    b.dashFromX = b.x;
    b.dashFromY = b.y;
    b.dashLocked = false;
    b.dashHit = false;
    b.dashAngle = Math.atan2(
      game.player.y - b.y,
      game.player.x - b.x
    );
    b.dashTargetX = game.player.x;
    b.dashTargetY = game.player.y;
    b.dashSide = game.player.x < W / 2 ? -1 : 1;
    b.firePulse = 0;
    b.flash = 0.2;
    game.shake = Math.max(game.shake, 8);
    game.toast = {
      text: "冲撞蓄力",
      sub: "离开红色预警轨道",
      time: 0,
      duration: 1.5,
      accent: "#ff8a8a",
    };
    sfx.charge();
  }

  function finishBoss3Dash(b) {
    b.dashState = "settle";
    b.dashTime = 0;
    b.settleFromX = b.x;
    b.settleFromY = Math.min(b.y, GROUND - 100);
    b.settleToX = b.dashSide < 0 ? 220 : W - 220;
    b.settleToY = clamp(b.settleFromY, 300, 390);
    b.y = b.settleFromY;
    game.shake = Math.max(game.shake, 20);
    game.flash = Math.max(game.flash, 0.16);
    shockwave(b.x, b.y, 220, "rgba(255, 166, 117, 0.8)", 3.5, 0.55);
    burst(b.x, b.y, {
      count: 22,
      colors: ["#ffffff", "#ffd28a", "#81dcff"],
      speedMin: 30,
      speedMax: 240,
      gravity: 30,
      lifeMin: 0.25,
      lifeMax: 0.7,
    });
  }

  function updateBoss3Special(b, dt) {
    const p = game.player;

    if (b.dashState === "rise") {
      b.dashTime += dt;
      const k = clamp(b.dashTime / 0.78, 0, 1);
      const e = easeOutCubic(k);
      b.x = lerp(b.dashFromX, W / 2, e);
      b.y = lerp(b.dashFromY, 235, e);
      b.rot = Math.sin(b.dashTime * 9) * 0.03;
      b.face = p.x < b.x ? -1 : 1;
      if (k >= 1) {
        b.dashState = "charge";
        b.dashTime = 0;
        b.dashLocked = false;
        b.x = W / 2;
        b.y = 235;
        b.dashAngle = Math.atan2(p.y - b.y, p.x - b.x);
        b.dashTargetX = p.x;
        b.dashTargetY = p.y;
        shockwave(b.x, b.y, 160, "rgba(255, 124, 128, 0.55)", 2, 0.4);
      }
      return;
    }

    if (b.dashState === "charge") {
      b.dashTime += dt;
      b.x = W / 2 + Math.sin(b.dashTime * 30) * 2.2;
      b.y = 235 + Math.sin(b.dashTime * 17) * 2.2;
      b.rot = Math.sin(b.dashTime * 20) * 0.018;

      if (!b.dashLocked && b.dashTime < 0.68) {
        b.dashAngle = Math.atan2(p.y - b.y, p.x - b.x);
        b.dashTargetX = p.x;
        b.dashTargetY = p.y;
        b.face = p.x < b.x ? -1 : 1;
      } else if (!b.dashLocked) {
        b.dashLocked = true;
        b.dashSide = p.x < W / 2 ? -1 : 1;
        b.face = Math.cos(b.dashAngle) < 0 ? -1 : 1;
        game.flash = Math.max(game.flash, 0.14);
        shockwave(b.dashTargetX, b.dashTargetY, 70, "rgba(255, 89, 107, 0.85)", 2, 0.35);
        sfx.lock();
      }

      if (b.dashTime >= 1.14) {
        const dx = b.dashTargetX - b.x;
        const dy = b.dashTargetY - b.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        b.dashDirX = dx / len;
        b.dashDirY = dy / len;
        b.dashAngle = Math.atan2(dy, dx);
        b.dashDistance = len + 170;
        b.dashTravelled = 0;
        b.dashState = "dash";
        b.dashTime = 0;
        b.dashHit = false;
        b.face =
          b.dashDirX < -0.05 ? -1 : b.dashDirX > 0.05 ? 1 : b.dashSide < 0 ? -1 : 1;
        b.flash = 0.35;
        game.shake = Math.max(game.shake, 16);
        game.flash = Math.max(game.flash, 0.22);
        sfx.dash();
        shockwave(b.x, b.y, 180, "rgba(255, 217, 142, 0.85)", 3, 0.45);
      }
      return;
    }

    if (b.dashState === "dash") {
      const speed = 1480;
      const step = speed * dt;
      b.dashTime += dt;
      b.x += b.dashDirX * step;
      b.y += b.dashDirY * step;
      b.dashTravelled += step;
      b.dashAngle = Math.atan2(b.dashDirY, b.dashDirX);
      b.face = b.dashDirX < -0.03 ? -1 : b.dashDirX > 0.03 ? 1 : b.dashSide < 0 ? -1 : 1;
      b.rot = 0;
      b.flash = Math.max(b.flash, 0.08);
      game.shake = Math.max(game.shake, 2.5);

      if (Math.random() < 0.9) {
        spawnParticle({
          x: b.x - b.dashDirX * b.hitW * 0.35 + rand(-18, 18),
          y: b.y - b.dashDirY * b.hitH * 0.35 + rand(-18, 18),
          vx: -b.dashDirX * rand(80, 250) + rand(-40, 40),
          vy: -b.dashDirY * rand(80, 250) + rand(-40, 40),
          gravity: 0,
          life: rand(0.18, 0.4),
          size: rand(1.5, 3.6),
          color: Math.random() > 0.45 ? "#ffd28a" : "#7bddff",
          shape: "spark",
          alpha: 0.8,
        });
      }

      const hitWorld =
        b.dashTravelled >= b.dashDistance ||
        b.y > GROUND - 96 ||
        b.x < 40 ||
        b.x > W - 40;
      if (hitWorld) finishBoss3Dash(b);
      return;
    }

    if (b.dashState === "settle") {
      b.dashTime += dt;
      const k = clamp(b.dashTime / 0.52, 0, 1);
      const e = easeOutCubic(k);
      b.x = lerp(b.settleFromX, b.settleToX, e);
      b.y = lerp(b.settleFromY, b.settleToY, e);
      b.rot = Math.sin(b.dashTime * 16) * 0.035 * (1 - k);
      b.face = b.dashSide < 0 ? 1 : -1;
      if (k >= 1) {
        b.x = b.settleToX;
        b.y = b.settleToY;
        b.homeX = b.settleToX;
        b.homeY = b.settleToY;
        b.dashState = "idle";
        b.dashTime = 0;
        b.shootTimer = Math.max(b.shootTimer, 0.75);
        b.spiralTimer = Math.max(b.spiralTimer, 0.7);
        b.ringTimer = Math.max(b.ringTimer, 1.0);
        b.specialTimer = rand(9, 15);
        b.flash = 0.18;
        game.toast = {
          text: b.dashSide < 0 ? "BOSS 停在左侧" : "BOSS 停在右侧",
          sub: "继续射击",
          time: 0,
          duration: 1.25,
          accent: "#ffd18a",
        };
      }
    }
  }

  function updateBoss3(b, dt) {
    const t = b.t;
    const phase2 = b.hp < b.maxHp * 0.46;
    if (phase2 && !b.phase2) {
      b.phase2 = true;
      b.flash = 0.5;
      game.flash = Math.max(game.flash, 0.42);
      game.shake = Math.max(game.shake, 18);
      shockwave(b.x, b.y, 330, "rgba(116, 214, 255, 0.8)", 4, 0.7);
      game.stageBanner = {
        title: "OVERDRIVE",
        sub: "哈哈哈哈哈哈哈",
        accent: "#ff6c9a",
        time: 0,
        duration: 1.8,
      };
    }

    if (b.dashState !== "idle") {
      updateBoss3Special(b, dt);
      return;
    }

    b.specialTimer -= dt;
    if (b.specialTimer <= 0) {
      startBoss3Special(b);
      updateBoss3Special(b, 0);
      return;
    }

    const homeX = b.homeX ?? 995;
    const homeY = b.homeY ?? 324;
    b.x = homeX + Math.sin(t * 0.76) * (phase2 ? 70 : 48);
    b.y = homeY + Math.sin(t * 1.62) * (phase2 ? 116 : 100) + Math.cos(t * 2.7) * 14;
    b.rot = Math.sin(t * 1.35) * 0.032;
    b.face = game.player.x >= b.x ? 1 : -1;

    b.shootTimer -= dt;
    b.spiralTimer -= dt;
    b.ringTimer -= dt;

    b.spiralAngle += dt * (phase2 ? 2.75 : 2.05);

    if (b.spiralTimer <= 0) {
      const arms = phase2 ? 3 : 2;
      const speed = phase2 ? 168 : 145;
      const muzzleDir = b.face >= 0 ? 1 : -1;
      for (let i = 0; i < arms; i += 1) {
        const angle = b.spiralAngle + (i / arms) * TAU;
        spawnEnemyBullet("bullet3", b.x + muzzleDir * 18, b.y + 12, angle, speed, {
          spin: rand(-5, 5),
          accel: 4,
          maxSpeed: 230,
        });
      }
      b.spiralTimer = phase2 ? 0.16 : 0.2;
    }

    if (b.shootTimer <= 0) {
      fireAimedFan(b, "bullet3", phase2 ? 4 : 3, phase2 ? 0.24 : 0.15, phase2 ? 330 : 292, 42);
      b.shootTimer = phase2 ? 1.1 : 1.45;
    }

    if (b.ringTimer <= 0) {
      fireRing(b, "bullet3", phase2 ? 22 : 17, phase2 ? 208 : 184, -t * 0.27);
      b.ringTimer = phase2 ? 3.05 : 3.8;
    }
  }

  function damageBoss(amount, x, y) {
    const b = game.boss;
    if (!b || !b.active || b.dying) return;
    b.hp = Math.max(0, b.hp - amount);
    b.flash = 0.12;
    game.shake = Math.max(game.shake, 3.4);
    spawnParticle({
      x,
      y,
      vx: rand(-40, 80),
      vy: rand(-80, 20),
      life: rand(0.15, 0.32),
      size: rand(2, 5),
      color: Math.random() > 0.5 ? "#fff4cd" : b.theme.accent,
      shape: "spark",
      gravity: 80,
    });
    damageText(x, y - 16, `-${amount}`, b.theme.accent);
    sfx.hit();
    if (b.hp <= 0) onBossDefeated();
  }

  /* ---------------------------------------------------------------------
     State transitions & cinematic sequences
     --------------------------------------------------------------------- */
  function beginTransition(action) {
    if (game.transition) return;
    game.transition = { phase: "out", alpha: 0, action };
    sfx.portal();
  }

  function updateTransition(dt) {
    const tr = game.transition;
    if (!tr) return;
    if (tr.phase === "out") {
      tr.alpha = Math.min(1, tr.alpha + dt * 3.2);
      if (tr.alpha >= 1) {
        tr.action();
        tr.phase = "in";
      }
    } else {
      tr.alpha = Math.max(0, tr.alpha - dt * 2.35);
      if (tr.alpha <= 0) game.transition = null;
    }
  }

  function onBossDefeated() {
    if (game.mode !== "fight") return;
    const stage = game.stage;
    const boss = game.boss;
    if (!boss) return;

    boss.hp = 0;
    boss.active = false;
    boss.dying = true;
    boss.deathTime = 0;
    game.mode = "victory";
    game.modeTime = 0;
    game.victoryStage = stage;
    game.combatEnabled = false;
    game.player.invuln = Math.max(game.player.invuln, 4);
    game.enemyBullets.length = 0;
    game.flash = Math.max(game.flash, 0.75);
    game.shake = 30;
    stopMusic();
    playMusic("victory1", false, 0.55);
    sfx.explode();
    sfx.win();

    const cx = boss.x;
    const cy = boss.y;
    shockwave(cx, cy, 330, `${boss.theme.accent}`, 4, 0.8);
    burst(cx, cy, {
      count: 60,
      colors: ["#ffffff", boss.theme.accent, "#ff8ea8", "#ffe9a8"],
      speedMin: 80,
      speedMax: 430,
      gravity: 60,
      lifeMin: 0.4,
      lifeMax: 1.2,
      sizeMin: 1.4,
      sizeMax: 5.5,
    });
    game.stageBanner = {
      title: stage === 3 ? "MISSION CLEAR" : "BOSS DOWN",
      sub: stage === 1 ? "神秘背带裤男 · 击破" : stage === 2 ? "奶鸡 · 击破" : "电❤️我 · 击破",
      accent: "#ffd873",
      time: 0,
      duration: 2.3,
    };
  }

  function updateVictory(dt) {
    game.modeTime += dt;
    // Clear leftover shots one frame after the killing blow. Clearing them
    // inside updatePlayerBullets would mutate the array while it is iterated.
    if (game.playerBullets.length) game.playerBullets.length = 0;
    const b = game.boss;

    if (b) {
      b.deathTime = (b.deathTime || 0) + dt;
      b.rot = Math.sin(game.modeTime * 23) * 0.09;
      b.flash = 0.08 + Math.sin(game.modeTime * 38) * 0.06;
      if (game.modeTime < 1.2 && Math.random() < 0.22) {
        const ex = b.x + rand(-b.hitW / 2, b.hitW / 2);
        const ey = b.y + rand(-b.hitH / 2, b.hitH / 2);
        burst(ex, ey, {
          count: 8,
          colors: ["#ffffff", b.theme.accent, "#ff7a58"],
          speedMin: 20,
          speedMax: 180,
          lifeMin: 0.2,
          lifeMax: 0.55,
          gravity: 80,
        });
      }
    }

    if (game.victoryStage === 1) {
      if (game.modeTime > 1.4) {
        const transformX = b ? b.x : 1000;
        const transformY = b ? b.y : 300;
        game.boss = makeRooster(transformX, transformY, 1, true);
        game.boss.t = 0;
        game.boss.exitBaseY = transformY;
        game.mode = "stage1_exit";
        game.modeTime = 0;
        game.flash = Math.max(game.flash, 0.48);
        game.shake = Math.max(game.shake, 14);
        shockwave(transformX, transformY, 190, "rgba(255, 226, 168, 0.8)", 3, 0.55);
        burst(transformX, transformY, {
          count: 26,
          colors: ["#ffffff", "#ffe3a8", "#8df5ff"],
          speedMin: 30,
          speedMax: 220,
          gravity: -20,
          lifeMin: 0.25,
          lifeMax: 0.8,
        });
        game.toast = {
          text: "BOSS 离场",
          sub: "前往下一关",
          time: 0,
          duration: 1.6,
          accent: "#6ff3ff",
        };
      }
    } else if (game.victoryStage === 2) {
      if (game.modeTime > 2.25) {
        startStage3();
      }
    } else if (game.victoryStage === 3) {
      if (game.modeTime > 1.85) {
        game.boss = null;
        game.mode = "complete";
        game.modeTime = 0;
        game.adventureEnd = game.time;
        game.stageBanner = null;
        game.toast = null;
        game.flash = Math.max(game.flash, 0.5);
        burst(W / 2, H / 2, {
          count: 80,
          colors: ["#ffffff", "#ffd873", "#72f6ff", "#ff7da5"],
          speedMin: 40,
          speedMax: 340,
          gravity: 45,
          lifeMin: 0.5,
          lifeMax: 1.6,
          sizeMin: 1.5,
          sizeMax: 5,
          shape: "star",
        });
      }
    }
  }

  function updateStage1Enter(dt) {
    game.modeTime += dt;
    updatePlayer(dt);
    updatePlayerBullets(dt);

    const b = game.boss;
    if (b) {
      b.t += dt;
      const t = clamp(game.modeTime / 1.6, 0, 1);
      b.x = lerp(W + 190, 968, easeOutCubic(t));
      b.y = lerp(250, 320, easeOutCubic(t)) + Math.sin(game.modeTime * 2.4) * 14;
      b.rot = Math.sin(game.modeTime * 2.6) * 0.035;
      b.firePulse = Math.max(0, b.firePulse - dt);
      b.flash = Math.max(0, b.flash - dt);
      if (game.modeTime > 1.75) {
        b.active = true;
        b.shootTimer = 1.15;
        game.mode = "fight";
        game.modeTime = 0;
        game.stageTime = 0;
        game.combatEnabled = true;
        game.toast = {
          text: "FIGHT",
          sub: "击败 Cai Xukun",
          time: 0,
          duration: 1.35,
          accent: "#ffb363",
        };
        game.shake = Math.max(game.shake, 10);
      }
    }
  }

  function updateStage1Exit(dt) {
    game.modeTime += dt;
    updatePlayer(dt);
    updatePlayerBullets(dt);

    const b = game.boss;
    if (b) {
      b.t += dt;
      b.rot = Math.sin(b.t * 12) * 0.045;
      b.x += 310 * dt;
      b.y = (b.exitBaseY ?? b.y) + Math.sin(b.t * 10) * 7;
      if (Math.random() < 0.4) {
        spawnParticle({
          x: b.x - ROOSTER_W * 0.3,
          y: b.y + rand(24, 70),
          vx: rand(-100, -30),
          vy: rand(-60, -12),
          gravity: 70,
          life: rand(0.2, 0.5),
          size: rand(1.5, 3.5),
          color: Math.random() > 0.5 ? "#d8f6ff" : "#ffe6bb",
          shape: "spark",
          alpha: 0.6,
        });
      }
      if (b.x > W + 240) {
        game.boss = null;
        game.exitReady = true;
        game.toast = {
          text: "出口已开启",
          sub: "继续向右 · ENTER STAGE 02",
          time: 0,
          duration: 2.6,
          accent: "#6ff3ff",
        };
        burst(W - 95, GROUND - 55, {
          count: 26,
          colors: ["#6ff3ff", "#ffffff", "#8e88ff"],
          speedMin: 40,
          speedMax: 220,
          gravity: -20,
          lifeMin: 0.4,
          lifeMax: 1,
        });
      }
    }

    if (game.exitReady && game.player.x > W - 82) {
      beginTransition(setupStage2);
    }
  }

  function updateStage2Intro(dt) {
    game.modeTime += dt;
    updatePlayer(dt);
    updatePlayerBullets(dt);

    const b = game.boss;
    if (b) {
      b.t += dt;
      b.y = GROUND - ROOSTER_H / 2 - 4 + Math.sin(b.t * 2.4) * 4;
      b.rot = Math.sin(b.t * 1.6) * 0.017;
      if (game.modeTime > 1.5) {
        game.mode = "stage2_transform";
        game.modeTime = 0;
        game.boss = makeBoss2(1028, 344);
        game.boss.spawnScale = 0.12;
        game.boss.hpDisplay = game.boss.maxHp;
        game.flash = Math.max(game.flash, 0.66);
        game.shake = 22;
        shockwave(1028, 360, 260, "rgba(255, 226, 117, 0.82)", 3.5, 0.6);
        burst(1028, 360, {
          count: 40,
          colors: ["#ffe476", "#ffffff", "#ff8a5a", "#8cf5ff"],
          speedMin: 50,
          speedMax: 300,
          gravity: -20,
          lifeMin: 0.3,
          lifeMax: 0.95,
        });
        sfx.explode();
      }
    }
  }

  function updateStage2Transform(dt) {
    game.modeTime += dt;
    updatePlayer(dt);
    updatePlayerBullets(dt);

    const b = game.boss;
    if (b) {
      b.t += dt;
      const t = clamp(game.modeTime / 0.55, 0, 1);
      b.spawnScale = easeOutBack(t);
      b.x = lerp(1028, 1000, easeOutCubic(t));
      b.y = lerp(420, 322, easeOutCubic(t)) + Math.sin(b.t * 2) * 8;
      b.rot = Math.sin(b.t * 7) * 0.03 * (1 - t);
      b.flash = Math.max(0, b.flash - dt);
      if (game.modeTime > 0.86) {
        b.active = true;
        b.spawnScale = 1;
        game.mode = "fight";
        game.modeTime = 0;
        game.stageTime = 0;
        game.combatEnabled = true;
        playMusic("fight2", true, 0.35);
        game.toast = {
          text: "FIGHT",
          sub: "击败 Nai Chicken",
          time: 0,
          duration: 1.35,
          accent: "#ffe275",
        };
        game.shake = Math.max(game.shake, 8);
      }
    }
  }

  function updateFight(dt) {
    game.stageTime += dt;
    updatePlayer(dt);
    updateBossFight(dt);
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    checkBossContact();
  }

  function triggerGameOver() {
    const p = game.player;
    if (!p || game.mode === "gameover") return;
    p.dead = true;
    p.hp = 0;
    game.mode = "gameover";
    game.modeTime = 0;
    game.combatEnabled = false;
    game.enemyBullets.length = 0;
    game.stageBanner = null;
    game.toast = null;
    game.flash = Math.max(game.flash, 0.9);
    game.shake = 34;
    game.damageVignette = 1;
    stopMusic();
    sfx.explode();
    burst(p.x, p.y, {
      count: 65,
      colors: ["#ffffff", "#ff5579", "#ffcb6d", "#84f6ff"],
      speedMin: 80,
      speedMax: 430,
      gravity: 80,
      lifeMin: 0.45,
      lifeMax: 1.3,
      sizeMin: 1.5,
      sizeMax: 5.5,
    });
    shockwave(p.x, p.y, 320, "rgba(255, 83, 119, 0.9)", 5, 0.8);
    game.adventureEnd = game.time;
  }

  function updateIntro(dt) {
    game.modeTime += dt;
    updatePlayer(dt);
    updatePlayerBullets(dt);
    if (game.player.x > W - 88) {
      beginTransition(setupStage1);
    }
  }

  function updateGameOver(dt) {
    game.modeTime += dt;
    game.lowHpPulse = Math.max(0, game.lowHpPulse - dt);
  }

  function updateComplete(dt) {
    game.modeTime += dt;
    if (game.player && !game.player.dead) {
      game.player.invuln = Math.max(0, game.player.invuln - dt);
      game.player.rotor += dt * 8;
    }
  }

  /* ---------------------------------------------------------------------
     Main update
     --------------------------------------------------------------------- */
  function updateVisualTimers(dt) {
    game.shake = Math.max(0, game.shake - 48 * dt);
    game.flash = Math.max(0, game.flash - 2.6 * dt);
    game.damageVignette = Math.max(0, game.damageVignette - 1.9 * dt);
    game.introFade = Math.max(0, game.introFade - dt * 0.72);

    if (game.stageBanner) {
      game.stageBanner.time += dt;
      if (game.stageBanner.time >= game.stageBanner.duration) {
        game.stageBanner = null;
      }
    }
    if (game.toast) {
      game.toast.time += dt;
      if (game.toast.time >= game.toast.duration) game.toast = null;
    }
    if (game.player) {
      game.player.displayHp +=
        (game.player.hp - game.player.displayHp) * Math.min(1, dt * 6.5);
      if (game.player.hp > 0 && game.player.hp <= 30) {
        game.lowHpPulse += dt;
      }
    }
    if (game.mice) {
      game.mice.flash = Math.max(0, game.mice.flash - dt * 2.8);
      game.mice.pulse = Math.max(0, game.mice.pulse - dt * 2.1);
    }
  }

  function update(dt) {
    game.time += dt;
    updateVisualTimers(dt);
    updateAtmosphere(dt);

    if (game.transition) {
      updateTransition(dt);
      updateParticles(dt);
      return;
    }

    switch (game.mode) {
      case "intro":
        updateIntro(dt);
        break;
      case "stage1_enter":
        updateStage1Enter(dt);
        break;
      case "fight":
        updateFight(dt);
        break;
      case "victory":
        updateVictory(dt);
        break;
      case "stage1_exit":
        updateStage1Exit(dt);
        break;
      case "stage2_intro":
        updateStage2Intro(dt);
        break;
      case "stage2_transform":
        updateStage2Transform(dt);
        break;
      case "gameover":
        updateGameOver(dt);
        break;
      case "complete":
        updateComplete(dt);
        break;
      default:
        break;
    }

    updateParticles(dt);
  }

  /* ---------------------------------------------------------------------
     Rendering — background & environment
     --------------------------------------------------------------------- */
  function prepareBackground2() {
    if (!images.background2) return;
    const buffer = document.createElement("canvas");
    buffer.width = W;
    buffer.height = H;
    const bctx = buffer.getContext("2d");
    bctx.fillStyle = "#07121b";
    bctx.fillRect(0, 0, W, H);
    bctx.filter = "blur(1.55px) saturate(0.68) brightness(0.72) contrast(1.04)";
    const scale = 1.035;
    const dw = W * scale;
    const dh = H * scale;
    bctx.drawImage(images.background2, (W - dw) / 2, (H - dh) / 2, dw, dh);
    bctx.filter = "none";

    const wash = bctx.createLinearGradient(0, 0, W, H);
    wash.addColorStop(0, "rgba(8, 31, 49, 0.18)");
    wash.addColorStop(0.55, "rgba(4, 15, 28, 0.12)");
    wash.addColorStop(1, "rgba(2, 8, 18, 0.36)");
    bctx.fillStyle = wash;
    bctx.fillRect(0, 0, W, H);

    background2Processed = buffer;
  }

  function drawIntroBackdrop() {
    const t = game.time;

    // Deep space glimpsed through the launch-bay windows.
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#03050c");
    sky.addColorStop(0.36, "#071224");
    sky.addColorStop(0.72, "#0b1d33");
    sky.addColorStop(1, "#06101b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND + 2);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const nebulaA = ctx.createRadialGradient(322, 286, 8, 322, 286, 420);
    nebulaA.addColorStop(0, "rgba(42, 166, 195, 0.14)");
    nebulaA.addColorStop(0.5, "rgba(25, 79, 142, 0.055)");
    nebulaA.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = nebulaA;
    ctx.fillRect(0, 0, W, GROUND);

    const nebulaB = ctx.createRadialGradient(990, 172, 10, 990, 172, 390);
    nebulaB.addColorStop(0, "rgba(140, 83, 200, 0.13)");
    nebulaB.addColorStop(0.52, "rgba(75, 48, 128, 0.05)");
    nebulaB.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = nebulaB;
    ctx.fillRect(0, 0, W, GROUND);

    for (const s of game.stars) {
      const a = 0.12 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = a > 0.3 ? "#dffcff" : "#7fbcff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Faint orbit diagram on the back wall.
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "rgba(106, 227, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 12]);
    ctx.beginPath();
    ctx.arc(352, 284, 205, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(352, 284, 272, -0.65, 1.22);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(104, 238, 255, 0.16)";
    ctx.beginPath();
    ctx.arc(352, 284, 3, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Dark hangar frame.
    ctx.save();
    const ceiling = ctx.createLinearGradient(0, 0, 0, 112);
    ceiling.addColorStop(0, "rgba(2, 5, 12, 0.98)");
    ceiling.addColorStop(0.68, "rgba(6, 13, 24, 0.94)");
    ceiling.addColorStop(1, "rgba(10, 20, 34, 0.24)");
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, W, 112);

    ctx.fillStyle = "rgba(110, 237, 255, 0.16)";
    ctx.fillRect(0, 74, W, 1);
    ctx.fillStyle = "rgba(118, 150, 255, 0.09)";
    for (let x = 0; x < W; x += 64) {
      ctx.fillRect(x, 82, 1, 30);
    }

    // Left structural pylon.
    const leftWall = ctx.createLinearGradient(0, 0, 270, 0);
    leftWall.addColorStop(0, "rgba(4, 8, 17, 0.98)");
    leftWall.addColorStop(0.7, "rgba(6, 14, 27, 0.9)");
    leftWall.addColorStop(1, "rgba(7, 17, 31, 0.18)");
    ctx.fillStyle = leftWall;
    ctx.beginPath();
    ctx.moveTo(0, 90);
    ctx.lineTo(194, 90);
    ctx.lineTo(283, GROUND);
    ctx.lineTo(0, GROUND);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(93, 235, 255, 0.24)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(194, 90);
    ctx.lineTo(283, GROUND);
    ctx.stroke();

    ctx.fillStyle = "rgba(5, 12, 22, 0.88)";
    ctx.beginPath();
    ctx.moveTo(0, 170);
    ctx.lineTo(126, 170);
    ctx.lineTo(166, 342);
    ctx.lineTo(0, 342);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(107, 222, 255, 0.1)";
    ctx.stroke();

    // Right structural pylon, framing the exit.
    const rightWall = ctx.createLinearGradient(W, 0, W - 240, 0);
    rightWall.addColorStop(0, "rgba(4, 8, 17, 0.98)");
    rightWall.addColorStop(0.68, "rgba(7, 16, 29, 0.88)");
    rightWall.addColorStop(1, "rgba(7, 17, 31, 0.14)");
    ctx.fillStyle = rightWall;
    ctx.beginPath();
    ctx.moveTo(W, 112);
    ctx.lineTo(1112, 112);
    ctx.lineTo(1071, GROUND);
    ctx.lineTo(W, GROUND);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(139, 132, 255, 0.25)";
    ctx.beginPath();
    ctx.moveTo(1112, 112);
    ctx.lineTo(1071, GROUND);
    ctx.stroke();

    // Ceiling gantries and hanging cables.
    ctx.strokeStyle = "rgba(126, 210, 255, 0.11)";
    ctx.lineWidth = 1;
    for (const x of [352, 536, 736, 936]) {
      ctx.beginPath();
      ctx.moveTo(x, 82);
      ctx.lineTo(x + 8, 136);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(123, 149, 210, 0.12)";
    ctx.beginPath();
    ctx.moveTo(112, 90);
    ctx.lineTo(350, 125);
    ctx.lineTo(720, 125);
    ctx.lineTo(1080, 90);
    ctx.stroke();

    // Floor sill and hazard markings.
    ctx.fillStyle = "rgba(5, 11, 20, 0.9)";
    ctx.fillRect(0, GROUND - 8, W, 10);
    ctx.strokeStyle = "rgba(96, 237, 255, 0.28)";
    ctx.beginPath();
    ctx.moveTo(0, GROUND - 8);
    ctx.lineTo(W, GROUND - 8);
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let x = 1120; x < W; x += 26) {
      ctx.fillStyle = "#ffe07a";
      ctx.beginPath();
      ctx.moveTo(x, GROUND - 6);
      ctx.lineTo(x + 13, GROUND - 6);
      ctx.lineTo(x + 24, GROUND + 12);
      ctx.lineTo(x + 11, GROUND + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Small illuminated wall signage.
    text("LAUNCH BAY 07", 42, 398, {
      size: 9,
      weight: 700,
      color: "rgba(118, 237, 255, 0.26)",
      font: MONO_FONT,
      spacing: 2.8,
    });
    text("OUTBOUND // STAGE 01", W - 46, 128, {
      size: 8,
      weight: 600,
      color: "rgba(174, 159, 255, 0.3)",
      align: "right",
      font: MONO_FONT,
      spacing: 1.8,
    });

    // Dim floor base below the deck line (the shared perspective grid overlays it).
    const floor = ctx.createLinearGradient(0, GROUND, 0, H);
    floor.addColorStop(0, "rgba(7, 17, 28, 0.9)");
    floor.addColorStop(1, "rgba(2, 5, 11, 0.98)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.restore();
  }

  function drawBackground() {
    if (game.stage === 0 || game.bg === "intro") {
      drawIntroBackdrop();
      return;
    }

    const bg =
      game.bg === "background2" && background2Processed
        ? background2Processed
        : images[game.bg];
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = "#0a1020";
      ctx.fillRect(0, 0, W, H);
    }

    if (game.bg === "background1") {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(4, 10, 28, 0.16)");
      g.addColorStop(0.55, "rgba(5, 9, 20, 0.06)");
      g.addColorStop(1, "rgba(4, 7, 16, 0.58)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(1, 10, 22, 0.18)");
      g.addColorStop(0.42, "rgba(2, 8, 18, 0.06)");
      g.addColorStop(0.78, "rgba(2, 8, 16, 0.33)");
      g.addColorStop(1, "rgba(1, 4, 11, 0.62)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(72, 167, 191, 0.055)";
      for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
      }

      // Pull the eye toward the fight and away from the source clip's captions.
      const captionShade = ctx.createLinearGradient(0, 420, 0, GROUND);
      captionShade.addColorStop(0, "rgba(3, 10, 19, 0)");
      captionShade.addColorStop(0.4, "rgba(3, 10, 19, 0.16)");
      captionShade.addColorStop(1, "rgba(2, 7, 15, 0.34)");
      ctx.fillStyle = captionShade;
      ctx.fillRect(0, 420, W, GROUND - 420);
    }

    if (game.stage === 3) {
      const pulse = (Math.sin(game.time * 3.2) * 0.5 + 0.5) * 0.14;
      const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.7, `rgba(70, 12, 24, ${pulse})`);
      g.addColorStop(1, `rgba(120, 10, 30, ${pulse + 0.14})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawLightShafts() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const t = game.time;
    for (let i = 0; i < 3; i += 1) {
      const x = 920 + Math.sin(t * 0.07 + i * 2.1) * 100 + i * 70;
      const g = ctx.createLinearGradient(x, 0, x - 260, H);
      g.addColorStop(0, i === 1 ? "rgba(255, 219, 154, 0.05)" : "rgba(126, 232, 255, 0.045)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 100, 0);
      ctx.lineTo(x - 160, H);
      ctx.lineTo(x - 330, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMotes() {
    const t = game.time;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of game.motes) {
      const a = m.alpha * (0.65 + 0.35 * Math.sin(t * 1.8 + m.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = game.stage === 3 ? "#b6d9ff" : "#c6f8ff";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (game.stage >= 2) {
      ctx.save();
      ctx.strokeStyle = "rgba(143, 228, 255, 0.2)";
      ctx.lineWidth = 1;
      for (const r of game.rain) {
        ctx.globalAlpha = r.alpha;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + r.drift * 0.3, r.y + r.length);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (game.stage === 3) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const s of game.stars) {
        const a = 0.1 + 0.28 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.globalAlpha = a;
        ctx.fillStyle = "#9fe3ff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawFloor() {
    const accent =
      game.stage === 1
        ? "rgba(100, 242, 255,"
        : game.stage === 2
          ? "rgba(255, 224, 112,"
          : game.stage === 3
            ? "rgba(102, 202, 255,"
            : "rgba(100, 242, 255,";

    // Darken the floor for gameplay readability while keeping the source art visible.
    const floorGrad = ctx.createLinearGradient(0, GROUND - 18, 0, H);
    floorGrad.addColorStop(0, "rgba(4, 8, 18, 0)");
    floorGrad.addColorStop(0.22, "rgba(4, 8, 18, 0.32)");
    floorGrad.addColorStop(1, "rgba(2, 4, 11, 0.56)");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, GROUND - 18, W, H - GROUND + 18);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, GROUND, W, H - GROUND);
    ctx.clip();

    // Perspective grid.
    ctx.strokeStyle = `${accent} 0.085)`;
    ctx.lineWidth = 1;
    const vpX = W / 2;
    const vpY = GROUND - 280;
    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(vpX + i * 22, vpY);
      ctx.lineTo(vpX + i * 150, H + 30);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i += 1) {
      const y = GROUND + 8 + i * i * 4.6;
      ctx.globalAlpha = 0.9 - i * 0.11;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `${accent} 0.65)`;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = `${accent} 0.65)`;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    ctx.lineTo(W, GROUND);
    ctx.stroke();
    ctx.restore();

    // Tiny moving sparks skimming the floor.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const t = game.time;
    for (let i = 0; i < 10; i += 1) {
      const x = ((t * (18 + i * 3) + i * 143) % (W + 100)) - 50;
      const y = GROUND + 18 + ((i * 31) % 76);
      ctx.globalAlpha = 0.1 + 0.16 * Math.sin(t * 1.7 + i);
      ctx.fillStyle = game.stage === 2 ? "#ffe585" : "#84f4ff";
      ctx.fillRect(x, y, 16 + (i % 3) * 8, 1);
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------------
     Rendering — intro stage
     --------------------------------------------------------------------- */
  function drawIntroTitle() {
    const t = game.time;
    text("PROLOGUE // LAUNCH BAY 07", 82, 58, {
      size: 11,
      weight: 700,
      color: "rgba(146, 234, 255, 0.7)",
      font: MONO_FONT,
      spacing: 2.6,
    });

    ctx.save();
    const grad = ctx.createLinearGradient(78, 96, 690, 190);
    grad.addColorStop(0, "#f8feff");
    grad.addColorStop(0.4, "#76f6ff");
    grad.addColorStop(0.74, "#9f8cff");
    grad.addColorStop(1, "#ff6ea9");
    ctx.font = `900 92px ${DISPLAY_FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(81, 225, 255, 0.36)";
    ctx.shadowBlur = 34;
    ctx.fillText("ADVENTURE", 78, 169);
    ctx.restore();

    // A small chromatic ghost / glitch accent.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.font = `900 92px ${DISPLAY_FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
    ctx.fillStyle = "#ff5b9a";
    ctx.fillText("ADVENTURE", 80, 168);
    ctx.restore();

    text("直升轮椅大冒险", 82, 214, {
      size: 19,
      weight: 700,
      color: "#eaf9ff",
      spacing: 3,
    });
    text("A SIDE-SCROLLING BULLET-HELL FLIGHT", 254, 214, {
      size: 9,
      weight: 600,
      color: "rgba(196, 232, 255, 0.46)",
      font: MONO_FONT,
      spacing: 1.5,
    });

    const lineY = 236;
    const lg = ctx.createLinearGradient(82, lineY, 560, lineY);
    lg.addColorStop(0, "rgba(106, 244, 255, 0.8)");
    lg.addColorStop(0.55, "rgba(144, 134, 255, 0.3)");
    lg.addColorStop(1, "rgba(144, 134, 255, 0)");
    ctx.fillStyle = lg;
    ctx.fillRect(82, lineY, 490, 1);

    // Tiny ship/pilot marker above the player.
    const p = game.player;
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = "rgba(121, 243, 255, 0.5)";
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - PLAYER_HALF - 12);
      ctx.lineTo(p.x, p.y - PLAYER_HALF - 32);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      text("PLAYER", p.x, p.y - PLAYER_HALF - 42, {
        size: 9,
        weight: 700,
        color: "rgba(128, 243, 255, 0.72)",
        align: "center",
        font: MONO_FONT,
        spacing: 2,
      });
    }
  }

  function drawInstructionCards() {
    const t = game.time;
    const baseX = 626;
    const bob = Math.sin(t * 1.2) * 2;

    // Card 01 — movement
    let x = baseX;
    let y = 250 + bob;
    let w = 430;
    let h = 122;
    drawGlassCard(x, y, w, h, "rgba(86, 234, 255, 0.78)");
    drawKeycap(x + 17, y + 22, 36, 32, "W", "#6ff4ff");
    drawKeycap(x + 8, y + 63, 36, 32, "A", "#6ff4ff");
    drawKeycap(x + 50, y + 63, 36, 32, "S", "#6ff4ff");
    drawKeycap(x + 92, y + 63, 36, 32, "D", "#6ff4ff");
    text("飞行控制", x + 152, y + 34, {
      size: 17,
      weight: 800,
      color: "#f4fbff",
      spacing: 1.5,
    });
    text("W 升空 · S 加速下落", x + 152, y + 66, {
      size: 13,
      weight: 500,
      color: "rgba(205, 239, 255, 0.75)",
    });
    text("A / D 左右移动 · 松开 W 会受重力下坠", x + 152, y + 91, {
      size: 12,
      weight: 500,
      color: "rgba(165, 211, 235, 0.55)",
    });
    text("01", x + w - 24, y + 20, {
      size: 9,
      color: "rgba(117, 238, 255, 0.4)",
      font: MONO_FONT,
      align: "right",
      spacing: 1,
    });

    // Card 02 — shooting
    x = baseX;
    y = 386 - bob * 0.5;
    w = 430;
    h = 100;
    drawGlassCard(x, y, w, h, "rgba(255, 208, 100, 0.76)");
    drawKeycap(x + 18, y + 54, 121, 30, "SPACE", "#ffd063");
    text("能量射击", x + 158, y + 30, {
      size: 17,
      weight: 800,
      color: "#f4fbff",
      spacing: 1.5,
    });
    text("按住空格持续发射", x + 158, y + 59, {
      size: 12.5,
      weight: 500,
      color: "rgba(216, 239, 255, 0.64)",
    });
    text("02", x + w - 24, y + 20, {
      size: 9,
      color: "rgba(255, 217, 123, 0.42)",
      font: MONO_FONT,
      align: "right",
    });

    // Card 03 — goal
    x = baseX;
    y = 493 + bob * 0.5;
    w = 430;
    h = 76;
    drawGlassCard(x, y, w, h, "rgba(144, 133, 255, 0.72)");
    drawArrowIcon(x + 25, y + 39, 34, "#9a8cff");
    text("一路向右", x + 78, y + 27, {
      size: 15,
      weight: 800,
      color: "#f4fbff",
      spacing: 1.2,
    });
    text("越过最右侧边界，进入 STAGE 01", x + 78, y + 52, {
      size: 12,
      weight: 500,
      color: "rgba(213, 226, 255, 0.64)",
    });
    text("03", x + w - 24, y + 20, {
      size: 9,
      color: "rgba(168, 157, 255, 0.46)",
      font: MONO_FONT,
      align: "right",
    });
  }

  function drawGlassCard(x, y, w, h, accent) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    fillRoundRect(x, y, w, h, 13, "rgba(4, 9, 20, 0.68)");
    ctx.restore();

    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "rgba(255,255,255,0.045)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.008)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    roundedRectPath(x, y, w, h, 13);
    ctx.fillStyle = grad;
    ctx.fill();

    strokeRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, 13, "rgba(148, 206, 255, 0.14)", 1);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x, y + 15, 2, h - 30);
    ctx.restore();

    // Subtle corner ticks.
    ctx.save();
    ctx.strokeStyle = "rgba(186, 231, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w - 18, y + 1);
    ctx.lineTo(x + w - 6, y + 1);
    ctx.moveTo(x + w - 1, y + 30);
    ctx.lineTo(x + w - 1, y + 42);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrowIcon(cx, cy, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - size / 2, cy);
    ctx.lineTo(cx + size / 3, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + size / 3, cy - 8);
    ctx.lineTo(cx + size / 2 + 2, cy);
    ctx.lineTo(cx + size / 3, cy + 8);
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawPortal(x, y, options = {}) {
    const {
      label = "STAGE 01",
      active = true,
      accent = "#6ff3ff",
      height = 218,
      width = 108,
      showPrompt = false,
    } = options;
    const top = y - height;
    const left = x - width / 2;
    const right = x + width / 2;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 3.4);

    ctx.save();
    // Ambient glow.
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(x, y - height * 0.42, 10, x, y - height * 0.42, 170);
    glow.addColorStop(0, active ? `rgba(105, 244, 255, ${0.15 + pulse * 0.07})` : "rgba(255, 80, 100, 0.06)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 180, y - height - 120, 360, height + 160);
    ctx.restore();

    // Portal interior.
    const inside = ctx.createLinearGradient(0, top, 0, y);
    inside.addColorStop(0, active ? "rgba(21, 77, 101, 0.12)" : "rgba(40, 12, 20, 0.1)");
    inside.addColorStop(1, active ? "rgba(34, 160, 214, 0.25)" : "rgba(80, 16, 30, 0.22)");
    fillRoundRect(left + 8, top + 16, width - 16, height - 16, 42, inside);

    // Scan lines inside the portal.
    ctx.save();
    roundedRectPath(left + 8, top + 16, width - 16, height - 16, 42);
    ctx.clip();
    ctx.strokeStyle = active ? "rgba(132, 247, 255, 0.19)" : "rgba(255, 113, 124, 0.15)";
    ctx.lineWidth = 1;
    for (let yy = top + 20; yy < y; yy += 8) {
      ctx.beginPath();
      ctx.moveTo(left, yy + Math.sin(yy * 0.1 + game.time * 2) * 3);
      ctx.lineTo(right, yy);
      ctx.stroke();
    }
    // Rising chevrons.
    for (let i = 0; i < 3; i += 1) {
      const cy = y - 30 - ((game.time * 46 + i * 48) % 150);
      ctx.globalAlpha = clamp(1 - (y - cy) / 175, 0, 1) * 0.5;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 15, cy + 7);
      ctx.lineTo(x, cy);
      ctx.lineTo(x + 15, cy + 7);
      ctx.stroke();
    }
    ctx.restore();

    // Rails.
    ctx.save();
    ctx.strokeStyle = active ? accent : "rgba(255, 89, 111, 0.7)";
    ctx.shadowColor = active ? accent : "rgba(255, 70, 95, 0.8)";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.moveTo(left, y - 8);
    ctx.lineTo(left, top + 30);
    ctx.quadraticCurveTo(left, top, left + 32, top);
    ctx.moveTo(right, y - 8);
    ctx.lineTo(right, top + 30);
    ctx.quadraticCurveTo(right, top, right - 32, top);
    ctx.stroke();
    ctx.restore();

    // Top plaque.
    fillRoundRect(x - 54, top - 17, 108, 26, 6, "rgba(3, 9, 18, 0.88)");
    strokeRoundRect(x - 54, top - 17, 108, 26, 6, active ? "rgba(110, 242, 255, 0.42)" : "rgba(255, 96, 117, 0.34)", 1);
    text(label, x, top - 3, {
      size: 9,
      weight: 700,
      color: active ? "#b9fbff" : "rgba(255, 160, 170, 0.8)",
      align: "center",
      font: MONO_FONT,
      spacing: 1.2,
    });

    // Base light.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const base = ctx.createRadialGradient(x, y, 2, x, y, 68);
    base.addColorStop(0, active ? `rgba(118, 250, 255, ${0.28 + pulse * 0.18})` : "rgba(255, 88, 110, 0.14)");
    base.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(x, y, 78, 15, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (showPrompt) {
      const promptAlpha = 0.55 + pulse * 0.35;
      text("继续向右", x - 4, y - height - 50, {
        size: 13,
        weight: 700,
        color: `rgba(211, 250, 255, ${promptAlpha})`,
        align: "center",
        spacing: 2,
      });
      text("KEEP MOVING RIGHT", x, y - height - 34, {
        size: 8,
        weight: 600,
        color: "rgba(151, 226, 255, 0.45)",
        align: "center",
        font: MONO_FONT,
        spacing: 1.4,
      });
    }
  }

  function drawIntroScene() {
    drawPortal(1201, GROUND, {
      label: "STAGE 01",
      active: true,
      accent: "#6ff3ff",
      showPrompt: game.player.x > W - 320,
    });

    // Floor path chevrons leading right.
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(game.time * 3);
    ctx.strokeStyle = "rgba(116, 241, 255, 0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i += 1) {
      const ax = 480 + i * 82 + ((game.time * 26) % 82);
      const ay = GROUND - 18;
      ctx.beginPath();
      ctx.moveTo(ax, ay - 6);
      ctx.lineTo(ax + 12, ay + 3);
      ctx.lineTo(ax, ay + 12);
      ctx.stroke();
    }
    ctx.restore();

    drawIntroTitle();
    drawInstructionCards();

    if (game.player.x > W - 250) {
      const pulse = 0.6 + 0.4 * Math.sin(game.time * 8);
      text("进入关卡", W - 150, GROUND - 260, {
        size: 14,
        weight: 800,
        color: `rgba(220, 253, 255, ${pulse})`,
        align: "center",
        spacing: 2,
      });
    }
  }

  function drawPrologueFooter() {
    ctx.save();
    ctx.globalAlpha = 0.86;
    const y = H - 32;
    fillRoundRect(34, y - 16, 492, 32, 16, "rgba(4, 9, 18, 0.54)");
    strokeRoundRect(34.5, y - 15.5, 491, 31, 16, "rgba(126, 204, 255, 0.14)", 1);
    text("W 升空", 52, y, {
      size: 11,
      weight: 700,
      color: "rgba(190, 242, 255, 0.82)",
      spacing: 1,
    });
    text("·", 104, y, { size: 11, color: "rgba(140, 210, 240, 0.4)" });
    text("S 加速下落", 120, y, {
      size: 11,
      weight: 700,
      color: "rgba(190, 242, 255, 0.82)",
      spacing: 1,
    });
    text("·", 196, y, { size: 11, color: "rgba(140, 210, 240, 0.4)" });
    text("A / D 移动", 212, y, {
      size: 11,
      weight: 700,
      color: "rgba(190, 242, 255, 0.82)",
      spacing: 1,
    });
    text("·", 284, y, { size: 11, color: "rgba(140, 210, 240, 0.4)" });
    text("SPACE 射击", 300, y, {
      size: 11,
      weight: 700,
      color: "rgba(255, 224, 135, 0.9)",
      spacing: 1,
    });
    ctx.restore();

    text("建议开启声音 · 按住 SPACE 连发", W - 32, H - 32, {
      size: 10,
      weight: 500,
      color: "rgba(177, 219, 245, 0.42)",
      align: "right",
      font: MONO_FONT,
      spacing: 0.5,
    });

    if (game.cheat) drawCheatBadge(W - 174, H - 66);
  }

  /* ---------------------------------------------------------------------
     Rendering — player / boss / bullets
     --------------------------------------------------------------------- */
  function drawMice() {
    const m = game.mice;
    if (!m) return;

    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "#02050b";
    ctx.beginPath();
    ctx.ellipse(m.x, GROUND + 4, 36, 7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    drawSprite("mice", m.x, m.y, m.drawW, m.drawH, {
      filter:
        m.flash > 0
          ? `brightness(${1.2 + m.flash * 2.2}) saturate(1.2)`
          : null,
    });

    if (m.pulse > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = m.pulse * 0.45;
      ctx.strokeStyle = "#80f6ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y - 8, 36 + (1 - m.pulse) * 26, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const t = game.time;
    const blink = 0.42 + 0.18 * Math.sin(t * 3.2);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.strokeStyle = "rgba(111, 243, 255, 0.85)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i += 1) {
      const ay = m.y - 38 - i * 8 + Math.sin(t * 2.4 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(m.x - 8, ay + 5);
      ctx.lineTo(m.x, ay);
      ctx.lineTo(m.x + 8, ay + 5);
      ctx.stroke();
    }
    ctx.restore();

    text("MICE", m.x, GROUND + 22, {
      size: 8,
      weight: 700,
      color: "rgba(142, 239, 255, 0.6)",
      align: "center",
      font: MONO_FONT,
      spacing: 2.4,
    });
    text("↑ UP", m.x + 34, GROUND + 22, {
      size: 7.5,
      weight: 600,
      color: "rgba(255, 221, 129, 0.52)",
      font: MONO_FONT,
      spacing: 0.6,
    });
  }

  function drawShadows() {
    const p = game.player;
    if (p && !p.dead) {
      const hRatio = clamp(1 - (GROUND - p.y) / 700, 0.4, 1);
      ctx.save();
      ctx.globalAlpha = 0.2 * hRatio;
      ctx.fillStyle = "#02050b";
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND + 4, 30 * hRatio, 7 * hRatio, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const b = game.boss;
    if (b) {
      const hRatio = clamp(1 - (GROUND - b.y) / 900, 0.4, 1);
      ctx.save();
      ctx.globalAlpha = 0.23 * hRatio;
      ctx.fillStyle = "#02050b";
      ctx.beginPath();
      ctx.ellipse(b.x, GROUND + 4, b.hitW * 0.58 * hRatio, 14 * hRatio, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (!p || p.dead) return;

    // Afterimages.
    ctx.save();
    for (const g of game.ghosts) {
      const a = (g.life / g.maxLife) * 0.15;
      drawSprite("player", g.x, g.y, PLAYER_W, PLAYER_H, {
        flip: g.face < 0,
        alpha: a,
        filter: "brightness(1.7) saturate(1.4)",
      });
    }
    ctx.restore();

    const blink = p.invuln > 0 && Math.floor(game.time * 22) % 2 === 0;
    const low = p.hp <= 30;
    const auraPulse = 0.5 + 0.5 * Math.sin(game.time * (low ? 8 : 2.5));

    if (low) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 100);
      grad.addColorStop(0, `rgba(255, 70, 95, ${0.06 + auraPulse * 0.06})`);
      grad.addColorStop(1, "rgba(255, 40, 70, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - 110, p.y - 110, 220, 220);
      ctx.restore();
    }

    drawSprite("player", p.x, p.y, PLAYER_W, PLAYER_H, {
      flip: p.face < 0,
      alpha: blink ? 0.42 : 1,
      rotation: clamp(p.vx / 3800, -0.08, 0.08),
      filter: p.invuln > 0.2 ? "brightness(1.25)" : null,
    });

    // Thruster glow beneath the wheelchair.
    if (keys.has("KeyW") || keys.has("ArrowUp")) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(p.x, p.y + PLAYER_HALF - 8, 2, p.x, p.y + PLAYER_HALF - 8, 42);
      g.addColorStop(0, "rgba(110, 244, 255, 0.55)");
      g.addColorStop(0.5, "rgba(96, 150, 255, 0.15)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 45, p.y + PLAYER_HALF - 50, 90, 80);
      ctx.restore();
    }

    // Muzzle flash.
    if (p.muzzle > 0) {
      const mx = p.x + p.face * (PLAYER_W / 2 - 8);
      const my = p.y - 6;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(mx, my, 1, mx, my, 17);
      g.addColorStop(0, "rgba(255, 247, 205, 0.9)");
      g.addColorStop(0.4, "rgba(255, 190, 95, 0.35)");
      g.addColorStop(1, "rgba(255, 110, 50, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, 17, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBossTelegraph() {
    const b = game.boss;
    if (
      !b ||
      b.kind !== "boss3" ||
      !b.active ||
      (b.dashState !== "charge" && b.dashState !== "dash")
    ) {
      return;
    }

    const dashing = b.dashState === "dash";
    const locked = b.dashLocked || dashing;
    const dx = dashing ? b.dashDirX : Math.cos(b.dashAngle);
    const dy = dashing ? b.dashDirY : Math.sin(b.dashAngle);
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 18);
    const alpha = dashing ? 0.45 : locked ? 0.62 + pulse * 0.25 : 0.35 + pulse * 0.14;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    if (!dashing) {
      const reach = 1500;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255, 58, 88, ${alpha * 0.16})`;
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + dx * reach, b.y + dy * reach);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 207, 128, ${alpha})`;
      ctx.lineWidth = locked ? 2.4 : 1.5;
      ctx.setLineDash(locked ? [13, 8] : [7, 12]);
      ctx.beginPath();
      ctx.moveTo(b.x + dx * 40, b.y + dy * 40);
      ctx.lineTo(b.x + dx * reach, b.y + dy * reach);
      ctx.stroke();
      ctx.setLineDash([]);

      const perpX = -dy;
      const perpY = dx;
      for (let i = 1; i <= 7; i += 1) {
        const cx = b.x + dx * i * 165;
        const cy = b.y + dy * i * 165;
        if (cx < -40 || cx > W + 40 || cy < -40 || cy > H + 40) continue;
        ctx.strokeStyle = `rgba(255, 167, 112, ${alpha * 0.65})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - dx * 7 - perpX * 7, cy - dy * 7 - perpY * 7);
        ctx.lineTo(cx + dx * 7, cy + dy * 7);
        ctx.lineTo(cx - dx * 7 + perpX * 7, cy - dy * 7 + perpY * 7);
        ctx.stroke();
      }
      ctx.restore();

      if (locked) {
        const tx = clamp(b.dashTargetX, 30, W - 30);
        const ty = clamp(b.dashTargetY, 80, GROUND - 20);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(255, 94, 112, ${0.5 + pulse * 0.4})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tx, ty, 23 + pulse * 7, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tx - 32, ty);
        ctx.lineTo(tx - 10, ty);
        ctx.moveTo(tx + 10, ty);
        ctx.lineTo(tx + 32, ty);
        ctx.moveTo(tx, ty - 32);
        ctx.lineTo(tx, ty - 10);
        ctx.moveTo(tx, ty + 10);
        ctx.lineTo(tx, ty + 32);
        ctx.stroke();
        ctx.restore();
        text("CHARGE", tx, ty - 52, {
          size: 9,
          weight: 800,
          color: "rgba(255, 160, 135, 0.8)",
          align: "center",
          font: MONO_FONT,
          spacing: 2.2,
        });
      }
    } else {
      // A hot streak behind the charging boss.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const tailX = b.x - dx * 420;
      const tailY = b.y - dy * 420;
      const grad = ctx.createLinearGradient(tailX, tailY, b.x, b.y);
      grad.addColorStop(0, "rgba(255, 82, 97, 0)");
      grad.addColorStop(0.55, "rgba(255, 96, 95, 0.12)");
      grad.addColorStop(1, "rgba(255, 216, 154, 0.38)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 25;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawBoss() {
    const b = game.boss;
    if (!b) return;

    const theme = b.theme || BOSS_THEME.boss1;
    const dying = b.dying;
    const shakeX = dying ? rand(-4, 4) : 0;
    const shakeY = dying ? rand(-4, 4) : 0;
    const scale = b.spawnScale ?? 1;
    const w = b.drawW * scale;
    const h = b.drawH * scale;

    // Aura ring behind the boss.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(b.x + shakeX, b.y + shakeY);
    ctx.rotate(game.time * 0.4);
    ctx.strokeStyle = theme.accentSoft;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 10]);
    ctx.beginPath();
    ctx.ellipse(0, 0, b.drawW * 0.72, b.drawH * 0.5, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = theme.accentSoft;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.hitW * 1.1, b.hitH * 0.62, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    if (b.firePulse > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = b.firePulse * 2.5;
      const g = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, b.drawH * 0.7);
      g.addColorStop(0, theme.accentSoft);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.drawH * 0.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const flip = b.artFacesLeft ? b.face > 0 : b.face < 0;
    drawSprite(b.sprite, b.x + shakeX, b.y + shakeY, w, h, {
      flip,
      rotation: b.rot || 0,
      alpha: dying ? 0.48 + Math.sin(game.time * 40) * 0.14 : 1,
      filter: b.flash > 0 ? "brightness(1.9) saturate(1.25)" : null,
      shadowColor: theme.accentSoft,
      shadowBlur: b.kind === "boss3" ? 24 : 16,
    });

    // A narrow accent below the boss silhouette.
    if (!dying) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(b.x - b.hitW * 0.33, b.y + h / 2 - 6, b.hitW * 0.66, 1);
      ctx.restore();
    }
  }

  function drawPlayerBullets() {
    for (const b of game.playerBullets) {
      if (!b) continue;
      drawSprite("playerbullet", b.x, b.y, 13, 12, {
        rotation: 0.08 + Math.sin(b.age * 30) * 0.05,
      });
    }
  }

  function drawEnemyBullets() {
    for (const b of game.enemyBullets) {
      if (!b) continue;
      const style = BULLET_STYLE[b.kind];
      drawSprite(b.sprite, b.x, b.y, style.w, style.h, {
        rotation: b.rot,
      });
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of game.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1) * p.alpha;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === "star") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size * (0.6 + a);
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const ang = (i / 4) * TAU;
          const inner = (ang + Math.PI / 4);
          ctx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s);
          ctx.lineTo(Math.cos(inner) * s * 0.3, Math.sin(inner) * s * 0.3);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.shape === "spark") {
        const len = Math.max(2, Math.hypot(p.vx, p.vy) * 0.035);
        const angle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillRect(-len, -p.size / 2, len * 2, p.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of game.shockwaves) {
      const a = s.life / s.maxLife;
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (0.4 + a * 0.8);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    for (const d of game.damageTexts) {
      const a = clamp(d.life / d.maxLife, 0, 1);
      text(d.text, d.x, d.y, {
        size: 15,
        weight: 800,
        color: d.color,
        align: "center",
        alpha: a,
        font: DISPLAY_FONT,
        shadow: { color: "rgba(0,0,0,0.5)", blur: 5 },
      });
    }
  }

  /* ---------------------------------------------------------------------
     Rendering — HUD
     --------------------------------------------------------------------- */
  function drawPlayerHUD() {
    const p = game.player;
    if (!p) return;
    const x = 26;
    const y = 22;
    const w = 342;
    const h = 78;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 20;
    fillRoundRect(x, y, w, h, 12, "rgba(4, 9, 18, 0.68)");
    ctx.restore();
    strokeRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12, "rgba(130, 213, 255, 0.16)", 1);
    fillRoundRect(x, y + 13, 2, h - 26, 1, "#76f2ff");

    // Diamond emblem.
    ctx.save();
    ctx.translate(x + 27, y + 27);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "rgba(110, 242, 255, 0.9)";
    ctx.fillRect(-4, -4, 8, 8);
    ctx.strokeStyle = "rgba(110, 242, 255, 0.3)";
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();

    text("PLAYER", x + 48, y + 26, {
      size: 12,
      weight: 800,
      color: "rgba(235, 250, 255, 0.9)",
      font: DISPLAY_FONT,
      spacing: 2.2,
    });
    text("ADVENTURER", x + 123, y + 27, {
      size: 7.5,
      weight: 600,
      color: "rgba(144, 209, 240, 0.42)",
      font: MONO_FONT,
      spacing: 1.4,
    });

    const hp = Math.max(0, p.hp);
    const disp = clamp(p.displayHp, 0, 100);
    const hpColor = hp <= 30 ? "#ff5d7d" : hp <= 60 ? "#ffcf6a" : "#7df4d1";
    text(String(Math.round(hp)).padStart(3, "0"), x + w - 46, y + 26, {
      size: 17,
      weight: 800,
      color: hp <= 30 ? "#ff879c" : "#ecfdff",
      align: "right",
      font: DISPLAY_FONT,
      spacing: 1,
    });
    text("/ 100", x + w - 20, y + 28, {
      size: 8,
      weight: 600,
      color: "rgba(174, 219, 240, 0.45)",
      align: "right",
      font: MONO_FONT,
    });

    const barX = x + 20;
    const barY = y + 49;
    const barW = w - 40;
    const barH = 11;
    fillRoundRect(barX, barY, barW, barH, 5.5, "rgba(2, 6, 13, 0.7)");
    strokeRoundRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1, 6, "rgba(150, 220, 255, 0.12)", 1);
    const fillW = barW * (disp / 100);
    if (fillW > 0.5) {
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, hp <= 30 ? "#ff3f62" : "#4ef4cf");
      g.addColorStop(0.6, hp <= 30 ? "#ff7b68" : "#70e8ff");
      g.addColorStop(1, hp <= 30 ? "#ffc56f" : "#ffd166");
      fillRoundRect(barX, barY, fillW, barH, 5.5, g);
      fillRoundRect(barX + 2, barY + 2, Math.max(0, fillW - 4), 2, 1, "rgba(255,255,255,0.23)");
    }
    for (let i = 1; i < 10; i += 1) {
      ctx.fillStyle = "rgba(2, 6, 14, 0.34)";
      ctx.fillRect(barX + (barW / 10) * i, barY, 1, barH);
    }
    text("HP", barX, barY - 9, {
      size: 7,
      weight: 700,
      color: "rgba(143, 205, 230, 0.55)",
      font: MONO_FONT,
      spacing: 1,
    });

    if (p.invuln > 0.2) {
      text("SHIELD", x + w - 20, barY + 23, {
        size: 7,
        weight: 700,
        color: "rgba(110, 244, 255, 0.55)",
        align: "right",
        font: MONO_FONT,
        spacing: 1,
      });
    }
  }

  function drawBossHUD() {
    const b = game.boss;
    if (!b || !b.maxHp || b.kind === "rooster") return;
    const x = 402;
    const y = 22;
    const w = 486;
    const h = 62;
    const theme = b.theme || BOSS_THEME.boss1;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 18;
    fillRoundRect(x, y, w, h, 12, "rgba(4, 9, 18, 0.64)");
    ctx.restore();
    strokeRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12, "rgba(150, 215, 255, 0.14)", 1);
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x, y + 13, 2, h - 26);
    ctx.globalAlpha = 1;

    text(b.name, x + 18, y + 23, {
      size: 12,
      weight: 800,
      color: "rgba(241, 252, 255, 0.92)",
      font: DISPLAY_FONT,
      spacing: 1.8,
    });
    ctx.save();
    ctx.font = `800 12px ${DISPLAY_FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.8px";
    const bossNameWidth = ctx.measureText(b.name).width;
    ctx.restore();
    text(b.cn, x + 18 + bossNameWidth + 10, y + 23, {
      size: 10,
      weight: 600,
      color: theme.accent,
      spacing: 1,
      alpha: 0.78,
    });
    text(`${Math.ceil(b.hp)} / ${b.maxHp}`, x + w - 18, y + 23, {
      size: 9,
      weight: 700,
      color: "rgba(189, 229, 248, 0.56)",
      align: "right",
      font: MONO_FONT,
      spacing: 0.4,
    });

    const barX = x + 18;
    const barY = y + 38;
    const barW = w - 36;
    const barH = 10;
    fillRoundRect(barX, barY, barW, barH, 5, "rgba(2, 6, 13, 0.78)");
    const hpRatio = clamp(b.hpDisplay / b.maxHp, 0, 1);
    if (hpRatio > 0.002) {
      const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      g.addColorStop(0, theme.accent);
      g.addColorStop(0.62, theme.accent);
      g.addColorStop(1, "#ff5d78");
      fillRoundRect(barX, barY, Math.max(2, barW * hpRatio), barH, 5, g);
      fillRoundRect(barX + 2, barY + 2, Math.max(0, barW * hpRatio - 4), 2, 1, "rgba(255,255,255,0.28)");
    }
    for (let i = 1; i < 16; i += 1) {
      ctx.fillStyle = "rgba(3, 7, 15, 0.32)";
      ctx.fillRect(barX + (barW / 16) * i, barY, 1, barH);
    }
    text("BOSS", barX, barY - 7, {
      size: 7,
      weight: 700,
      color: "rgba(159, 214, 238, 0.5)",
      font: MONO_FONT,
      spacing: 1,
    });
  }

  function drawStageChip() {
    if (game.stage < 1) return;
    const x = W - 170;
    const y = 22;
    const w = 144;
    const h = 66;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 18;
    fillRoundRect(x, y, w, h, 12, "rgba(4, 9, 18, 0.66)");
    ctx.restore();
    strokeRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12, "rgba(142, 211, 255, 0.14)", 1);
    ctx.fillStyle = game.stage === 2 ? "#ffe275" : game.stage === 3 ? "#77d9ff" : "#76f2ff";
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x, y + 13, 2, h - 26);
    ctx.globalAlpha = 1;

    text("STAGE", x + 18, y + 22, {
      size: 8,
      weight: 700,
      color: "rgba(159, 217, 243, 0.5)",
      font: MONO_FONT,
      spacing: 1.4,
    });
    const label =
      game.stage === 3 ? "FINAL / 03" : `0${game.stage} / 03`;
    text(label, x + 18, y + 44, {
      size: 16,
      weight: 800,
      color: "#ecfdff",
      font: DISPLAY_FONT,
      spacing: 1,
      shadow: { color: "rgba(93, 230, 255, 0.25)", blur: 10 },
    });
    ctx.save();
    const total = 3;
    for (let i = 0; i < total; i += 1) {
      const done = i + 1 < game.stage;
      const active = i + 1 === game.stage;
      ctx.fillStyle = done
        ? "rgba(112, 244, 210, 0.9)"
        : active
          ? "#7aefff"
          : "rgba(161, 208, 235, 0.2)";
      const sw = active ? 16 : 8;
      ctx.fillRect(x + w - 18 - (total - i) * 12 - (active ? 4 : 0), y + 48, sw, 2);
    }
    ctx.restore();
  }

  function drawFightFooter() {
    const accent =
      game.stage === 1 ? "rgba(124, 243, 255, 0.95)" : game.stage === 2 ? "rgba(255, 226, 117, 0.95)" : "rgba(122, 216, 255, 0.95)";
    fillRoundRect(W - 250, H - 34, 224, 22, 11, "rgba(4, 9, 18, 0.5)");
    text("WASD 移动", W - 236, H - 23, {
      size: 9,
      weight: 600,
      color: "rgba(197, 233, 251, 0.52)",
      font: MONO_FONT,
      spacing: 0.7,
    });
    text("SPACE 射击", W - 150, H - 23, {
      size: 9,
      weight: 600,
      color: accent,
      font: MONO_FONT,
      spacing: 0.7,
      alpha: 0.82,
    });
    text(`${formatTime(game.stageTime)}`, W - 54, H - 23, {
      size: 9,
      weight: 600,
      color: "rgba(153, 203, 228, 0.35)",
      align: "right",
      font: MONO_FONT,
    });
  }

  function drawCheatBadge(x, y) {
    const w = 142;
    const h = 24;
    const pulse = 0.55 + 0.45 * Math.sin(game.time * 5.4);
    fillRoundRect(x, y, w, h, 12, "rgba(20, 12, 4, 0.72)");
    strokeRoundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12, "rgba(255, 201, 101, 0.36)", 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(x + 14, y + h / 2, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
    text("CHEAT // GOD MODE", x + 25, y + h / 2 + 0.5, {
      size: 8.5,
      weight: 700,
      color: "rgba(255, 227, 160, 0.92)",
      font: MONO_FONT,
      spacing: 0.7,
      alpha: 0.88,
    });
  }

  function drawHUD() {
    if (game.mode === "intro" || game.mode === "gameover" || game.mode === "complete") {
      return;
    }
    drawPlayerHUD();
    drawBossHUD();
    drawStageChip();
    drawFightFooter();
    if (game.cheat) drawCheatBadge(26, 109);
  }

  function drawToast() {
    if (!game.toast) return;
    const t = game.toast;
    const a = clamp(Math.min(t.time / 0.2, (t.duration - t.time) / 0.5), 0, 1);
    if (a <= 0) return;
    const y = H - 104;
    ctx.save();
    ctx.globalAlpha = a;
    const w = 330;
    fillRoundRect(W / 2 - w / 2, y - 29, w, 58, 11, "rgba(4, 9, 18, 0.92)");
    strokeRoundRect(W / 2 - w / 2 + 0.5, y - 28.5, w - 1, 57, 11, "rgba(158, 226, 255, 0.16)", 1);
    ctx.fillStyle = t.accent || "#6ff4ff";
    ctx.fillRect(W / 2 - w / 2, y - 15, 2, 30);
    text(t.text, W / 2, y - 5, {
      size: 14,
      weight: 800,
      color: "#f4fdff",
      align: "center",
      spacing: 2,
    });
    text(t.sub || "", W / 2, y + 15, {
      size: 9,
      weight: 500,
      color: "rgba(176, 224, 247, 0.55)",
      align: "center",
      font: MONO_FONT,
      spacing: 0.8,
    });
    ctx.restore();
  }

  function drawStageBanner() {
    const b = game.stageBanner;
    if (!b) return;
    const t = b.time;
    const dur = b.duration;
    const fadeIn = clamp(t / 0.28, 0, 1);
    const fadeOut = clamp((dur - t) / 0.45, 0, 1);
    const a = Math.min(fadeIn, fadeOut);
    if (a <= 0) return;
    const slide = (1 - easeOutCubic(clamp(t / 0.5, 0, 1))) * 34;
    const y = 278;

    ctx.save();
    ctx.globalAlpha = a;
    const band = ctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, "rgba(3, 7, 15, 0)");
    band.addColorStop(0.17, "rgba(3, 7, 15, 0.6)");
    band.addColorStop(0.5, "rgba(3, 7, 15, 0.8)");
    band.addColorStop(0.83, "rgba(3, 7, 15, 0.6)");
    band.addColorStop(1, "rgba(3, 7, 15, 0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 70, W, 140);

    ctx.strokeStyle = "rgba(158, 224, 255, 0.17)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(250 - slide, y - 50);
    ctx.lineTo(W - 250 + slide, y - 50);
    ctx.moveTo(250 - slide, y + 52);
    ctx.lineTo(W - 250 + slide, y + 52);
    ctx.stroke();

    ctx.fillStyle = b.accent || "#6ff3ff";
    ctx.fillRect(W / 2 - 135 - slide, y - 48, 30, 2);
    ctx.fillRect(W / 2 + 105 + slide, y + 50, 30, 2);

    text(b.title, W / 2, y - 12, {
      size: b.title.length > 9 ? 42 : 51,
      weight: 900,
      color: "#f5fdff",
      align: "center",
      font: DISPLAY_FONT,
      spacing: 4,
      shadow: { color: b.accent || "#6ff3ff", blur: 26 },
    });
    text(b.sub, W / 2, y + 30, {
      size: 11,
      weight: 600,
      color: "rgba(200, 236, 255, 0.64)",
      align: "center",
      spacing: 2.3,
    });
    ctx.restore();
  }

  /* ---------------------------------------------------------------------
     Rendering — overlays
     --------------------------------------------------------------------- */
  function drawDamageVignette() {
    if (game.damageVignette <= 0.001) return;
    const a = game.damageVignette;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, "rgba(255, 40, 72, 0)");
    g.addColorStop(0.7, `rgba(255, 32, 66, ${0.18 * a})`);
    g.addColorStop(1, `rgba(255, 22, 55, ${0.52 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawLowHpVignette() {
    const p = game.player;
    if (!p || game.mode === "intro" || game.mode === "complete" || game.mode === "gameover") return;
    if (p.hp > 30 || p.dead) return;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 6);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, "rgba(255, 30, 60, 0)");
    g.addColorStop(1, `rgba(255, 20, 50, ${0.1 + pulse * 0.13})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTransitionOverlay() {
    if (!game.transition) return;
    const a = game.transition.alpha;
    ctx.fillStyle = `rgba(3, 6, 13, ${a})`;
    ctx.fillRect(0, 0, W, H);
    if (a > 0.7) {
      const aa = (a - 0.7) / 0.3;
      ctx.save();
      ctx.globalAlpha = aa * 0.65;
      text("ADVENTURE", W / 2, H / 2 - 2, {
        size: 24,
        weight: 800,
        color: "#dffbff",
        align: "center",
        font: DISPLAY_FONT,
        spacing: 7,
        shadow: { color: "rgba(106, 241, 255, 0.35)", blur: 18 },
      });
      ctx.restore();
    }
  }

  function drawIntroFade() {
    if (game.introFade <= 0.001) return;
    ctx.fillStyle = `rgba(2, 4, 10, ${game.introFade})`;
    ctx.fillRect(0, 0, W, H);
  }

  function drawActionButton(label, sub, hover) {
    const b = game.overButton;
    ctx.save();
    const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    if (hover) {
      grad.addColorStop(0, "rgba(122, 247, 255, 0.98)");
      grad.addColorStop(1, "rgba(143, 133, 255, 0.98)");
    } else {
      grad.addColorStop(0, "rgba(24, 58, 82, 0.92)");
      grad.addColorStop(1, "rgba(28, 38, 73, 0.92)");
    }
    fillRoundRect(b.x, b.y, b.w, b.h, 8, grad);
    strokeRoundRect(
      b.x + 0.5,
      b.y + 0.5,
      b.w - 1,
      b.h - 1,
      8,
      hover ? "rgba(236, 255, 255, 0.7)" : "rgba(123, 226, 255, 0.32)",
      1
    );
    if (hover) {
      text(label, b.x + b.w / 2, b.y + b.h / 2 - 5, {
        size: 16,
        weight: 800,
        color: "#06101a",
        align: "center",
        spacing: 1.7,
      });
      text(sub, b.x + b.w / 2, b.y + b.h / 2 + 14, {
        size: 8,
        weight: 700,
        color: "rgba(4, 20, 30, 0.6)",
        align: "center",
        font: MONO_FONT,
        spacing: 1.2,
      });
    } else {
      text(label, b.x + b.w / 2, b.y + b.h / 2 - 5, {
        size: 16,
        weight: 800,
        color: "#eaffff",
        align: "center",
        spacing: 1.7,
      });
      text(sub, b.x + b.w / 2, b.y + b.h / 2 + 14, {
        size: 8,
        weight: 600,
        color: "rgba(158, 231, 255, 0.48)",
        align: "center",
        font: MONO_FONT,
        spacing: 1.2,
      });
    }
    ctx.restore();

    drawKeycap(b.x - 33, b.y + b.h / 2 - 14, 29, 28, "R", "#78f1ff", false);
  }

  function drawGameOverOverlay() {
    const t = game.modeTime;
    const a = clamp(t / 0.45, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(3, 5, 12, 0.8)";
    ctx.fillRect(0, 0, W, H);

    // Broken horizontal bands.
    ctx.globalAlpha = a * 0.2;
    for (let i = 0; i < 8; i += 1) {
      const yy = 100 + i * 78;
      ctx.fillStyle = i % 2 ? "#ff4e73" : "#7ef3ff";
      ctx.fillRect(0, yy, W, 1);
    }
    ctx.globalAlpha = a;

    const red = "rgba(255, 95, 123, 0.9)";
    text("MISSION FAILED", W / 2, 188, {
      size: 11,
      weight: 800,
      color: red,
      align: "center",
      font: MONO_FONT,
      spacing: 4,
    });
    ctx.save();
    const grad = ctx.createLinearGradient(W / 2 - 290, 230, W / 2 + 290, 310);
    grad.addColorStop(0, "#ffe0e5");
    grad.addColorStop(0.45, "#ff7894");
    grad.addColorStop(1, "#ffbe6e");
    ctx.font = `900 66px ${DISPLAY_FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "5px";
    ctx.fillStyle = grad;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 62, 98, 0.3)";
    ctx.shadowBlur = 30;
    ctx.fillText("冒险终止", W / 2, 265);
    ctx.restore();

    text(
      `你倒在了 STAGE 0${Math.max(1, game.stage)} · 调整呼吸，再来一次`,
      W / 2,
      326,
      {
        size: 13,
        weight: 500,
        color: "rgba(218, 232, 250, 0.62)",
        align: "center",
        spacing: 0.6,
      }
    );

    const elapsed = (game.adventureEnd || game.time) - (game.adventureStart || game.time);
    text(`FLIGHT TIME  ${formatTime(elapsed)}`, W / 2, 366, {
      size: 9,
      weight: 600,
      color: "rgba(159, 215, 239, 0.4)",
      align: "center",
      font: MONO_FONT,
      spacing: 1.2,
    });

    drawActionButton("回到初始界面", "RETURN TO THE BEGINNING", game.pointer.hoverButton);
    text("或按 R 返回起点", W / 2, 522, {
      size: 10,
      weight: 500,
      color: "rgba(173, 214, 236, 0.42)",
      align: "center",
      spacing: 0.6,
    });
    ctx.restore();
  }

  function drawCompleteOverlay() {
    const t = game.modeTime;
    const a = clamp(t / 0.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(3, 5, 12, 0.76)";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(W / 2, 300, 20, W / 2, 300, 460);
    glow.addColorStop(0, "rgba(255, 216, 115, 0.11)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    text("THE END OF THE LINE", W / 2, 153, {
      size: 10,
      weight: 800,
      color: "rgba(255, 219, 118, 0.78)",
      align: "center",
      font: MONO_FONT,
      spacing: 4.4,
    });

    ctx.save();
    const grad = ctx.createLinearGradient(W / 2 - 420, 210, W / 2 + 420, 290);
    grad.addColorStop(0, "#fff9e0");
    grad.addColorStop(0.35, "#ffd873");
    grad.addColorStop(0.72, "#87f2ff");
    grad.addColorStop(1, "#a58cff");
    ctx.font = `900 55px ${DISPLAY_FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
    ctx.fillStyle = grad;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255, 216, 115, 0.3)";
    ctx.shadowBlur = 38;
    ctx.fillText("ADVENTURE COMPLETE", W / 2, 236);
    ctx.restore();

    text("Over", W / 2, 297, {
      size: 14,
      weight: 600,
      color: "rgba(226, 241, 255, 0.64)",
      align: "center",
      spacing: 1.4,
    });

    const elapsed = (game.adventureEnd || game.time) - (game.adventureStart || game.time);
    const stats = [
      ["CLEAR TIME", formatTime(elapsed)],
      ["REMAINING HP", `${Math.max(0, Math.ceil(game.player.hp))} / 100`],
      ["STAGES CLEARED", "03 / 03"],
    ];
    const sw = 152;
    const gap = 22;
    const totalW = stats.length * sw + (stats.length - 1) * gap;
    stats.forEach(([label, value], i) => {
      const x = W / 2 - totalW / 2 + i * (sw + gap);
      fillRoundRect(x, 340, sw, 60, 8, "rgba(9, 17, 31, 0.62)");
      strokeRoundRect(x + 0.5, 340.5, sw - 1, 59, 8, "rgba(160, 222, 255, 0.13)", 1);
      text(label, x + sw / 2, 356, {
        size: 7.5,
        weight: 600,
        color: "rgba(156, 209, 234, 0.48)",
        align: "center",
        font: MONO_FONT,
        spacing: 1,
      });
      text(value, x + sw / 2, 380, {
        size: 17,
        weight: 800,
        color: "#f4fdff",
        align: "center",
        font: DISPLAY_FONT,
        spacing: 1.1,
      });
    });

    drawActionButton("重新开始", "PLAY AGAIN FROM THE BEGINNING", game.pointer.hoverButton);
    text("按 R 或 ENTER 重新开始", W / 2, 526, {
      size: 10,
      weight: 500,
      color: "rgba(255, 229, 164, 0.45)",
      align: "center",
      spacing: 0.7,
    });
    ctx.restore();
  }

  function drawFlashes() {
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(235, 252, 255, ${clamp(game.flash, 0, 0.9) * 0.65})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------------------------------------------------------------
     Main render
     --------------------------------------------------------------------- */
  function render() {
    ctx.setTransform(view.sx, 0, 0, view.sy, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#050812";
    ctx.fillRect(0, 0, W, H);

    const shakeX = game.shake > 0 ? rand(-game.shake, game.shake) : 0;
    const shakeY = game.shake > 0 ? rand(-game.shake, game.shake) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawLightShafts();
    drawMotes();
    drawFloor();
    drawShadows();
    drawMice();

    if (game.mode === "intro") {
      drawIntroScene();
      drawPlayerBullets();
      drawPlayer();
      drawParticles();
      drawPrologueFooter();
    } else {
      if (game.stage === 1 && game.exitReady) {
        drawPortal(1200, GROUND, {
          label: "STAGE 02",
          active: true,
          accent: "#6ff3ff",
          showPrompt: game.player.x > W - 360,
        });
      }
      drawBossTelegraph();
      drawBoss();
      drawEnemyBullets();
      drawPlayerBullets();
      drawPlayer();
      drawParticles();
    }

    ctx.restore();

    drawDamageVignette();
    drawLowHpVignette();
    drawHUD();
    drawToast();
    drawStageBanner();
    drawFlashes();

    if (game.mode === "gameover") drawGameOverOverlay();
    if (game.mode === "complete") drawCompleteOverlay();

    drawTransitionOverlay();
    drawIntroFade();
  }

  /* ---------------------------------------------------------------------
     Resize / loop / boot
     --------------------------------------------------------------------- */
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(rect.width * view.dpr));
    const targetH = Math.max(1, Math.round(rect.height * view.dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    view.sx = canvas.width / W;
    view.sy = canvas.height / H;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  let lastTime = 0;

  function loop(now) {
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = clamp(dt, 0, 0.033);
    if (game.mode !== "boot") {
      try {
        update(dt);
        render();
      } catch (error) {
        // Keep the animation loop alive even if a single frame hits a bug.
        console.error("Adventure runtime error", error);
      }
    }
    requestAnimationFrame(loop);
  }

  function loadImages() {
    const entries = Object.entries(IMAGE_SRC);
    let loaded = 0;
    return new Promise((resolve, reject) => {
      entries.forEach(([key, src]) => {
        const img = new Image();
        img.onload = () => {
          images[key] = img;
          loaded += 1;
          if (loadingBar) loadingBar.style.width = `${(loaded / entries.length) * 100}%`;
          if (loaded === entries.length) resolve();
        };
        img.onerror = () => {
          reject(new Error(`无法加载素材：${src}`));
        };
        img.src = src;
      });
    });
  }

  function applyDebugScenario() {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("debug");
    if (!scenario) return;
    game.introFade = 0;
    game.transition = null;

    if (scenario === "intro") return;
    if (scenario === "stage1") {
      setupStage1();
      game.mode = "fight";
      game.modeTime = 0;
      game.boss.x = 968;
      game.boss.y = 310;
      game.boss.active = true;
      game.stageBanner = null;
      game.player.x = 225;
      game.player.y = 360;
      game.player.hp = 76;
    } else if (scenario === "stage2") {
      setupStage2();
      game.mode = "fight";
      game.stage = 2;
      game.bg = "background2";
      game.boss = makeBoss2(1000, 322);
      game.boss.active = true;
      game.boss.hp = 420;
      game.boss.hpDisplay = 420;
      game.stageBanner = null;
      game.player.x = 230;
      game.player.y = 390;
      game.player.hp = 62;
      stopMusic();
    } else if (scenario === "stage3") {
      setupStage1();
      game.stage = 3;
      game.bg = "background2";
      game.mode = "fight";
      game.boss = makeBoss3(990, 322);
      game.boss.active = true;
      game.boss.hp = 540;
      game.boss.hpDisplay = 540;
      game.stageBanner = null;
      game.player.x = 238;
      game.player.y = 390;
      game.player.hp = 43;
      stopMusic();
    } else if (scenario === "gameover") {
      setupStage2();
      game.stage = 2;
      game.player.hp = 0;
      game.player.dead = true;
      game.mode = "gameover";
      game.modeTime = 1;
      game.adventureStart = game.time - 84;
      game.adventureEnd = game.time;
      game.boss = null;
      game.stageBanner = null;
      game.toast = null;
      game.enemyBullets.length = 0;
    } else if (scenario === "complete") {
      setupStage1();
      game.stage = 3;
      game.bg = "background2";
      game.mode = "complete";
      game.modeTime = 1;
      game.boss = null;
      game.stageBanner = null;
      game.toast = null;
      game.enemyBullets.length = 0;
      game.player.hp = 58;
      game.adventureStart = game.time - 117;
      game.adventureEnd = game.time;
    }
  }

  async function init() {
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", keyDown, { passive: false, capture: true });
    window.addEventListener("keyup", keyUp, { passive: false });
    window.addEventListener("blur", () => keys.clear());
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    try {
      resizeCanvas();
      loadingText.textContent = "Loading…";
      await loadImages();
      setupAudioTracks();
      prepareBackground2();
      initAtmosphere();
      resetToIntro();
      resizeCanvas();
      applyDebugScenario();
      if (loadingEl) loadingEl.classList.add("is-hidden");
      requestAnimationFrame(loop);
    } catch (error) {
      if (loadingText) loadingText.textContent = "失败，请通过本地服务器打开此页面。";
      if (loadingBar) loadingBar.style.background = "#ff5b79";
      console.error(error);
    }
  }

  // A small, harmless debug hook for testing and curious tinkerers.
  window.adventureDebug = {
    game,
    startStage1: setupStage1,
    startStage2: setupStage2,
    startStage3,
    reset: resetToIntro,
    setKey(code, down = true) {
      if (down) keys.add(code);
      else keys.delete(code);
    },
    tick(seconds = 1 / 60) {
      const step = 1 / 60;
      const frames = Math.max(1, Math.round(seconds / step));
      for (let i = 0; i < frames; i += 1) update(step);
      render();
    },
  };

  init();
})();
