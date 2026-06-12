(() => {
  const canvas = document.getElementById("shop-engine-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const staticCanvas = document.createElement("canvas");
  const staticCtx = staticCanvas.getContext("2d", { alpha: true });
  const particlePool = [];
  const frameBudget = {
    fps: 30,
    dprCap: 1.5,
    particleCap: 110,
  };
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    angle: 20,
    rpm: 65,
    targetRpm: 65,
    idleRpm: 65,
    maxRpm: 800,
    scrollY: window.scrollY,
    scrollBoost: 0,
    chromeOffset: 0,
    lastTime: performance.now(),
    lastDrawTime: 0,
    visible: !document.hidden,
    particles: [],
  };

  const cycleColors = ["#4fc3ff", "#8dd0ff", "#ff7a2f", "#a8adb6"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const themePalettes = {
    dark: {
      grid: "rgba(255,255,255,0.04)",
      cylinder: "rgba(235,241,250,0.28)",
      pipe: "rgba(255,255,255,0.2)",
      chamberAlphaTop: "5f",
      chamberAlphaBottom: "07",
      rod: "rgba(255,255,255,0.4)",
      rodShadow: "rgba(0,0,0,0.28)",
      pistonTop: "rgba(248,250,255,0.8)",
      pistonBottom: "rgba(122,132,146,0.74)",
      pistonStroke: "rgba(255,255,255,0.32)",
      ring: "rgba(255,255,255,0.3)",
      crankIdle: "rgba(255,255,255,0.52)",
      crankPower: "rgba(255,122,47,0.7)",
      crankPin: "rgba(255,255,255,0.8)",
      valveStroke: "rgba(225,232,242,0.38)",
      valveFill: "rgba(225,232,242,0.48)",
      plugStroke: "rgba(255,255,255,0.32)",
      plugFill: "rgba(255,255,255,0.58)",
    },
    light: {
      grid: "rgba(27,29,28,0.055)",
      cylinder: "rgba(27,29,28,0.28)",
      pipe: "rgba(27,29,28,0.18)",
      chamberAlphaTop: "3f",
      chamberAlphaBottom: "09",
      rod: "rgba(27,29,28,0.38)",
      rodShadow: "rgba(255,255,255,0.32)",
      pistonTop: "rgba(70,76,82,0.48)",
      pistonBottom: "rgba(122,132,146,0.34)",
      pistonStroke: "rgba(27,29,28,0.24)",
      ring: "rgba(27,29,28,0.24)",
      crankIdle: "rgba(27,29,28,0.42)",
      crankPower: "rgba(255,122,47,0.72)",
      crankPin: "rgba(27,29,28,0.56)",
      valveStroke: "rgba(27,29,28,0.3)",
      valveFill: "rgba(27,29,28,0.34)",
      plugStroke: "rgba(27,29,28,0.26)",
      plugFill: "rgba(27,29,28,0.28)",
    },
  };

  function currentPalette() {
    return document.body.classList.contains("is_light_theme") ? themePalettes.light : themePalettes.dark;
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, frameBudget.dprCap);
    state.width = window.innerWidth;
    state.height = window.innerHeight;

    for (const target of [canvas, staticCanvas]) {
      target.width = Math.floor(state.width * state.dpr);
      target.height = Math.floor(state.height * state.dpr);
      target.style.width = `${state.width}px`;
      target.style.height = `${state.height}px`;
    }

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    staticCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    updateChromeOffset();
    drawStaticBackdrop();
  }

  function drawStaticBackdrop() {
    const palette = currentPalette();
    staticCtx.clearRect(0, 0, state.width, state.height);
    staticCtx.strokeStyle = palette.grid;
    staticCtx.lineWidth = 1;

    const gap = state.width < 620 ? 46 : 58;
    for (let x = 0; x < state.width + gap; x += gap) {
      staticCtx.beginPath();
      staticCtx.moveTo(x, 0);
      staticCtx.lineTo(x, state.height);
      staticCtx.stroke();
    }

    for (let y = 0; y < state.height + gap; y += gap) {
      staticCtx.beginPath();
      staticCtx.moveTo(0, y);
      staticCtx.lineTo(state.width, y);
      staticCtx.stroke();
    }
  }

  function updateChromeOffset() {
    const header = document.querySelector(".shop_header");
    const menu = document.querySelector(".shop_menu_bar");
    const fixedTopHeight = (header?.offsetHeight || 0) + (menu?.offsetHeight || 0);
    state.chromeOffset = clamp(fixedTopHeight * 0.7, 44, state.width < 760 ? 88 : 76);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function getCycle(angle) {
    const cycleAngle = ((angle % 720) + 720) % 720;
    const index = Math.floor(cycleAngle / 180);
    return {
      angle: cycleAngle,
      index,
      color: cycleColors[index],
      progress: (cycleAngle % 180) / 180,
    };
  }

  function cyclicProgress(angle, start, end) {
    let normalizedAngle = ((angle % 720) + 720) % 720;
    let normalizedEnd = end;
    if (normalizedEnd < start) normalizedEnd += 720;
    if (normalizedAngle < start) normalizedAngle += 720;
    if (normalizedAngle < start || normalizedAngle > normalizedEnd) return null;
    return (normalizedAngle - start) / (normalizedEnd - start);
  }

  function camLift(angle, start, end, baseLift, peakLift) {
    const progress = cyclicProgress(angle, start, end);
    if (progress === null) return baseLift;
    return baseLift + Math.sin(progress * Math.PI) * peakLift;
  }

  function isIgnitionWindow(angle) {
    const cycleAngle = ((angle % 720) + 720) % 720;
    return cycleAngle >= 350 && cycleAngle <= 372;
  }

  function updateScrollBoost(dt) {
    const y = window.scrollY;
    const velocity = Math.abs(y - state.scrollY) / Math.max(dt, 0.016);
    state.scrollY = y;

    const instantBoost = reducedMotion ? 0 : clamp(velocity / 2600, 0, 1);
    state.scrollBoost = Math.max(instantBoost, state.scrollBoost * Math.pow(0.015, dt));
    state.targetRpm = state.idleRpm + state.scrollBoost * (state.maxRpm - state.idleRpm);
  }

  function addParticle(x, y, vx, vy, life, radius, color, maxY = null) {
    if (state.particles.length > frameBudget.particleCap) return;

    const particle = particlePool.pop() || {};
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.radius = radius;
    particle.color = color;
    particle.maxY = maxY;
    state.particles.push(particle);
  }

  function releaseParticle(index) {
    const particle = state.particles[index];
    state.particles[index] = state.particles[state.particles.length - 1];
    state.particles.pop();
    if (particlePool.length < 180) particlePool.push(particle);
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.52, dt);
      particle.vy *= Math.pow(0.52, dt);
      if (particle.maxY !== null && particle.y > particle.maxY) {
        particle.y = particle.maxY;
        particle.vy = -Math.abs(particle.vy) * 0.18;
      }
      if (particle.life <= 0) releaseParticle(i);
    }
  }

  function emitCycleParticles(engine, cycle, pistonY) {
    if (reducedMotion || Math.random() > 0.72) return;

    const scale = engine.scale;
    const valveAngle = 0.42;
    const intakeFlow = {
      x: engine.cx - engine.cylinderWidth * 0.27,
      y: engine.top + 54 * scale,
      dx: Math.sin(valveAngle),
      dy: Math.cos(valveAngle),
    };
    const exhaustFlow = {
      x: engine.cx + engine.cylinderWidth * 0.27,
      y: engine.top + 54 * scale,
      dx: Math.sin(valveAngle),
      dy: -Math.cos(valveAngle),
    };
    const plugTip = {
      x: engine.cx,
      y: engine.top + 42 * scale,
    };
    const pistonTop = pistonY - engine.pistonHeight;
    const flameLimitY = pistonTop - 14 * scale;

    if (cycle.index === 0) {
      const speed = 62 + Math.random() * 44;
      const spread = (Math.random() - 0.5) * 18;
      addParticle(
        intakeFlow.x - intakeFlow.dx * 22 * scale + (Math.random() - 0.5) * 5 * scale,
        intakeFlow.y - intakeFlow.dy * 12 * scale + Math.random() * 4 * scale,
        intakeFlow.dx * speed + spread,
        intakeFlow.dy * speed + spread * 0.25,
        0.9,
        2 + Math.random() * 2,
        "79, 198, 255",
      );
    }

    if (isIgnitionWindow(cycle.angle) || (cycle.index === 2 && cycle.angle < 395)) {
      for (let i = 0; i < 4; i += 1) {
        addParticle(
          plugTip.x + (Math.random() - 0.5) * 14 * scale,
          plugTip.y + Math.random() * 10 * scale,
          (Math.random() - 0.5) * 74,
          24 + Math.random() * 42,
          0.5,
          3 + Math.random() * 5,
          "255, 122, 47",
          flameLimitY,
        );
      }
    }

    if (cycle.index === 3) {
      const speed = 82 + Math.random() * 78;
      const spread = (Math.random() - 0.5) * 20;
      addParticle(
        exhaustFlow.x + (Math.random() - 0.5) * 5 * scale,
        exhaustFlow.y + Math.random() * 4 * scale,
        exhaustFlow.dx * speed + spread,
        exhaustFlow.dy * speed + spread * 0.25,
        1,
        2 + Math.random() * 3,
        "178, 184, 194",
      );
    }
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${particle.color}, ${alpha * 0.58})`;
      ctx.arc(particle.x, particle.y, particle.radius * (1.25 - alpha * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBackdrop() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.drawImage(staticCanvas, 0, 0, state.width, state.height);
  }

  function drawEngine() {
    const palette = currentPalette();
    const minSide = Math.min(state.width, state.height);
    const scale = clamp(minSide / 760, 0.58, 1.05);
    const engine = {
      cx: state.width * 0.5,
      top: state.height * (state.width < 760 ? 0.15 : 0.11) + state.chromeOffset,
      cylinderWidth: 190 * scale,
      cylinderHeight: 360 * scale,
      pistonHeight: 72 * scale,
      crankRadius: 76 * scale,
      crankY: state.height * (state.width < 760 ? 0.67 : 0.68) + state.chromeOffset,
      scale,
    };

    const crankAngle = (state.angle * Math.PI) / 180;
    const crankX = engine.cx + Math.sin(crankAngle) * engine.crankRadius;
    const crankPinY = engine.crankY - Math.cos(crankAngle) * engine.crankRadius;
    const pistonTopClearance = 88 * scale;
    const pistonBottomClearance = 24 * scale;
    const pistonTravel =
      engine.cylinderHeight - pistonTopClearance - pistonBottomClearance - engine.pistonHeight;
    const pistonY =
      engine.top +
      pistonTopClearance +
      engine.pistonHeight +
      ((1 - Math.cos(crankAngle)) / 2) * pistonTravel;
    const cycle = getCycle(state.angle);
    const chamberTop = engine.top + 24 * scale;
    const chamberBottom = pistonY - engine.pistonHeight * 0.12;
    const intakeLift = camLift(cycle.angle, 705, 190, 2, 16) * scale;
    const exhaustLift = camLift(cycle.angle, 520, 15, 2, 16) * scale;

    emitCycleParticles(engine, cycle, pistonY);

    ctx.save();
    ctx.globalAlpha = state.width < 620 ? 0.62 : 0.72;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = palette.cylinder;
    ctx.lineWidth = 4 * scale;
    roundedRect(
      engine.cx - engine.cylinderWidth / 2,
      engine.top,
      engine.cylinderWidth,
      engine.cylinderHeight,
      18 * scale,
    );
    ctx.stroke();

    const chamberGradient = ctx.createLinearGradient(0, chamberTop, 0, chamberBottom);
    chamberGradient.addColorStop(0, `${cycle.color}${palette.chamberAlphaTop}`);
    chamberGradient.addColorStop(1, `${cycle.color}${palette.chamberAlphaBottom}`);
    ctx.fillStyle = chamberGradient;
    roundedRect(
      engine.cx - engine.cylinderWidth * 0.38,
      chamberTop,
      engine.cylinderWidth * 0.76,
      Math.max(20, chamberBottom - chamberTop),
      12 * scale,
    );
    ctx.fill();

    ctx.strokeStyle = palette.pipe;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(engine.cx - engine.cylinderWidth * 0.3, engine.top + 14 * scale);
    ctx.lineTo(engine.cx - engine.cylinderWidth * 0.5, engine.top - 46 * scale);
    ctx.lineTo(engine.cx - engine.cylinderWidth * 0.86, engine.top - 46 * scale);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(engine.cx + engine.cylinderWidth * 0.3, engine.top + 14 * scale);
    ctx.lineTo(engine.cx + engine.cylinderWidth * 0.5, engine.top - 46 * scale);
    ctx.lineTo(engine.cx + engine.cylinderWidth * 0.9, engine.top - 46 * scale);
    ctx.stroke();

    drawValve(engine.cx - engine.cylinderWidth * 0.27, engine.top + 18 * scale, -1, intakeLift, scale);
    drawValve(engine.cx + engine.cylinderWidth * 0.27, engine.top + 18 * scale, 1, exhaustLift, scale);
    drawSparkPlug(engine, cycle);

    ctx.strokeStyle = palette.rod;
    ctx.lineWidth = 11 * scale;
    ctx.beginPath();
    ctx.moveTo(engine.cx, pistonY);
    ctx.lineTo(crankX, crankPinY);
    ctx.stroke();
    ctx.strokeStyle = palette.rodShadow;
    ctx.lineWidth = 4 * scale;
    ctx.stroke();

    const pistonGradient = ctx.createLinearGradient(0, pistonY - engine.pistonHeight, 0, pistonY);
    pistonGradient.addColorStop(0, palette.pistonTop);
    pistonGradient.addColorStop(1, palette.pistonBottom);
    ctx.fillStyle = pistonGradient;
    roundedRect(
      engine.cx - engine.cylinderWidth * 0.39,
      pistonY - engine.pistonHeight,
      engine.cylinderWidth * 0.78,
      engine.pistonHeight,
      10 * scale,
    );
    ctx.fill();
    ctx.strokeStyle = palette.pistonStroke;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(engine.cx - engine.cylinderWidth * 0.33, pistonY - engine.pistonHeight + (18 + i * 13) * scale);
      ctx.lineTo(engine.cx + engine.cylinderWidth * 0.33, pistonY - engine.pistonHeight + (18 + i * 13) * scale);
      ctx.stroke();
    }

    ctx.strokeStyle = palette.ring;
    ctx.lineWidth = 14 * scale;
    ctx.beginPath();
    ctx.arc(engine.cx, engine.crankY, engine.crankRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = cycle.index === 2 ? palette.crankPower : palette.crankIdle;
    ctx.lineWidth = 7 * scale;
    ctx.beginPath();
    ctx.moveTo(engine.cx, engine.crankY);
    ctx.lineTo(crankX, crankPinY);
    ctx.stroke();

    ctx.fillStyle = palette.crankPin;
    ctx.beginPath();
    ctx.arc(crankX, crankPinY, 11 * scale, 0, Math.PI * 2);
    ctx.fill();

    drawParticles();
    ctx.restore();
  }

  function drawValve(x, y, direction, lift, scale) {
    const palette = currentPalette();
    ctx.save();
    ctx.translate(x, y + lift);
    ctx.rotate(direction * 0.42);
    ctx.strokeStyle = palette.valveStroke;
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(0, -38 * scale);
    ctx.lineTo(0, 28 * scale);
    ctx.stroke();
    ctx.fillStyle = palette.valveFill;
    ctx.beginPath();
    ctx.ellipse(0, 34 * scale, 24 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSparkPlug(engine, cycle) {
    const palette = currentPalette();
    const scale = engine.scale;
    const x = engine.cx;
    const y = engine.top - 10 * scale;
    ctx.strokeStyle = palette.plugStroke;
    ctx.lineWidth = 5 * scale;
    ctx.beginPath();
    ctx.moveTo(x, y - 54 * scale);
    ctx.lineTo(x, y + 30 * scale);
    ctx.stroke();

    ctx.fillStyle = palette.plugFill;
    roundedRect(x - 12 * scale, y - 50 * scale, 24 * scale, 44 * scale, 5 * scale);
    ctx.fill();

    if (isIgnitionWindow(cycle.angle)) {
      ctx.strokeStyle = "rgba(255,220,92,0.92)";
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y + 32 * scale);
      ctx.lineTo(x - 12 * scale, y + 48 * scale);
      ctx.lineTo(x + 9 * scale, y + 40 * scale);
      ctx.lineTo(x - 2 * scale, y + 58 * scale);
      ctx.stroke();
    }
  }

  function frame(now) {
    if (!state.visible) {
      state.lastTime = now;
      requestAnimationFrame(frame);
      return;
    }

    const frameInterval = 1000 / frameBudget.fps;
    if (now - state.lastDrawTime < frameInterval) {
      requestAnimationFrame(frame);
      return;
    }

    const dt = Math.min((now - state.lastTime) / 1000, 0.08);
    state.lastTime = now;
    state.lastDrawTime = now;

    updateScrollBoost(dt);
    state.rpm = lerp(state.rpm, state.targetRpm, 1 - Math.pow(0.018, dt));
    state.angle += (state.rpm * 6 * dt) / 2.3;

    updateParticles(dt);
    drawBackdrop();
    drawEngine();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("shop-theme-change", drawStaticBackdrop);
  document.addEventListener("visibilitychange", () => {
    state.visible = !document.hidden;
  });
  requestAnimationFrame(frame);
})();
