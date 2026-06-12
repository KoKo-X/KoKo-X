(() => {
  const canvas = document.getElementById("engine-gl-canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
  });

  const modeInput = document.getElementById("render-mode");
  const glowInput = document.getElementById("glow-toggle");
  const metricFps = document.getElementById("metric-fps");
  const metricFrame = document.getElementById("metric-frame");
  const metricDpr = document.getElementById("metric-dpr");
  const metricParticles = document.getElementById("metric-particles");

  if (!gl) {
    document.body.classList.add("webgl_unavailable");
    metricFps.textContent = "no GL";
    metricFrame.textContent = "--";
    metricDpr.textContent = "--";
    metricParticles.textContent = "--";
    return;
  }

  const modes = {
    optimized: { fps: 30, dprCap: 1.5, particleCap: 120 },
    quality: { fps: 60, dprCap: 2, particleCap: 150 },
    battery: { fps: 24, dprCap: 1, particleCap: 90 },
  };

  const cycleColors = [
    [0.31, 0.76, 1, 1],
    [0.55, 0.82, 1, 1],
    [1, 0.48, 0.18, 1],
    [0.66, 0.68, 0.72, 1],
  ];

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
    lastTime: performance.now(),
    lastDrawTime: 0,
    visible: !document.hidden,
    particles: [],
    particlePool: [],
    frameTimes: [],
    frameCount: 0,
    metricsLastTime: performance.now(),
  };

  const shapeVertices = [];
  const particleCenters = [];
  const particleData = [];

  const shapeProgram = createProgram(
    `#version 300 es
    in vec2 a_position;
    in vec4 a_color;
    uniform vec2 u_resolution;
    out vec4 v_color;
    void main() {
      vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_color = a_color;
    }`,
    `#version 300 es
    precision mediump float;
    in vec4 v_color;
    out vec4 outColor;
    void main() {
      outColor = v_color;
    }`,
  );

  const particleProgram = createProgram(
    `#version 300 es
    in vec2 a_center;
    in vec4 a_data;
    uniform vec2 u_resolution;
    out vec2 v_local;
    out vec4 v_color;
    void main() {
      int corner = gl_VertexID % 6;
      vec2 offsets[6] = vec2[6](
        vec2(-1.0, -1.0),
        vec2(1.0, -1.0),
        vec2(-1.0, 1.0),
        vec2(-1.0, 1.0),
        vec2(1.0, -1.0),
        vec2(1.0, 1.0)
      );
      vec2 local = offsets[corner];
      vec2 position = a_center + local * a_data.w;
      vec2 clip = (position / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      v_local = local;
      v_color = vec4(a_data.rgb, a_data.a);
    }`,
    `#version 300 es
    precision mediump float;
    in vec2 v_local;
    in vec4 v_color;
    out vec4 outColor;
    void main() {
      float dist = length(v_local);
      float alpha = smoothstep(1.0, 0.08, dist) * v_color.a;
      outColor = vec4(v_color.rgb, alpha);
    }`,
  );

  const shapeVao = gl.createVertexArray();
  const shapeBuffer = gl.createBuffer();
  const particleVao = gl.createVertexArray();
  const particleCenterBuffer = gl.createBuffer();
  const particleDataBuffer = gl.createBuffer();

  const shapeStride = 6 * 4;

  gl.bindVertexArray(shapeVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
  enableAttrib(shapeProgram, "a_position", 2, shapeStride, 0);
  enableAttrib(shapeProgram, "a_color", 4, shapeStride, 2 * 4);

  gl.bindVertexArray(particleVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleCenterBuffer);
  enableAttrib(particleProgram, "a_center", 2, 2 * 4, 0);
  gl.vertexAttribDivisor(gl.getAttribLocation(particleProgram, "a_center"), 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleDataBuffer);
  enableAttrib(particleProgram, "a_data", 4, 4 * 4, 0);
  gl.vertexAttribDivisor(gl.getAttribLocation(particleProgram, "a_data"), 1);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  function enableAttrib(program, name, size, stride, offset) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  }

  function currentMode() {
    return modes[modeInput.value] || modes.optimized;
  }

  function resize() {
    const mode = currentMode();
    state.dpr = Math.min(window.devicePixelRatio || 1, mode.dprCap);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function rgba(r, g, b, a) {
    return [r / 255, g / 255, b / 255, a];
  }

  function colorWithAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
  }

  function getCycle(angle) {
    const cycleAngle = ((angle % 720) + 720) % 720;
    const index = Math.floor(cycleAngle / 180);
    return {
      angle: cycleAngle,
      index,
      color: cycleColors[index],
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
    const instantBoost = clamp(velocity / 2600, 0, 1);
    state.scrollBoost = Math.max(instantBoost, state.scrollBoost * Math.pow(0.015, dt));
    state.targetRpm = state.idleRpm + state.scrollBoost * (state.maxRpm - state.idleRpm);
  }

  function addShapeVertex(x, y, color) {
    shapeVertices.push(x, y, color[0], color[1], color[2], color[3]);
  }

  function addTriangle(a, b, c, color) {
    addShapeVertex(a[0], a[1], color);
    addShapeVertex(b[0], b[1], color);
    addShapeVertex(c[0], c[1], color);
  }

  function addQuad(a, b, c, d, color) {
    addTriangle(a, b, c, color);
    addTriangle(c, b, d, color);
  }

  function addLine(x1, y1, x2, y2, width, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * width * 0.5;
    const ny = (dx / length) * width * 0.5;
    addQuad(
      [x1 - nx, y1 - ny],
      [x1 + nx, y1 + ny],
      [x2 - nx, y2 - ny],
      [x2 + nx, y2 + ny],
      color,
    );
  }

  function addRect(x, y, width, height, color) {
    addQuad([x, y], [x + width, y], [x, y + height], [x + width, y + height], color);
  }

  function addCircle(cx, cy, radius, color, segments = 42) {
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      addTriangle(
        [cx, cy],
        [cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius],
        [cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius],
        color,
      );
    }
  }

  function addRing(cx, cy, radius, width, color, segments = 72) {
    const outer = radius + width * 0.5;
    const inner = Math.max(0, radius - width * 0.5);
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      addQuad(
        [cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner],
        [cx + Math.cos(a0) * outer, cy + Math.sin(a0) * outer],
        [cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner],
        [cx + Math.cos(a1) * outer, cy + Math.sin(a1) * outer],
        color,
      );
    }
  }

  function addEllipse(cx, cy, rx, ry, rotation, color, segments = 36) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const point = (angle) => {
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      return [cx + x * cos - y * sin, cy + x * sin + y * cos];
    };
    for (let i = 0; i < segments; i += 1) {
      addTriangle([cx, cy], point((i / segments) * Math.PI * 2), point(((i + 1) / segments) * Math.PI * 2), color);
    }
  }

  function addRoundedRectApprox(x, y, width, height, radius, color) {
    addRect(x + radius, y, width - radius * 2, height, color);
    addRect(x, y + radius, radius, height - radius * 2, color);
    addRect(x + width - radius, y + radius, radius, height - radius * 2, color);
    addCircle(x + radius, y + radius, radius, color, 16);
    addCircle(x + width - radius, y + radius, radius, color, 16);
    addCircle(x + radius, y + height - radius, radius, color, 16);
    addCircle(x + width - radius, y + height - radius, radius, color, 16);
  }

  function addGrid() {
    const gap = state.width < 620 ? 46 : 58;
    const color = rgba(255, 255, 255, 0.04);
    for (let x = 0; x < state.width + gap; x += gap) {
      addLine(x, 0, x, state.height, 1, color);
    }
    for (let y = 0; y < state.height + gap; y += gap) {
      addLine(0, y, state.width, y, 1, color);
    }
  }

  function addGlow(cycle) {
    if (!glowInput.checked) return;
    const glowColor = colorWithAlpha(cycle.color, 0.075);
    addCircle(state.width * 0.5, state.height * 0.48, state.width * 0.28, glowColor, 80);
    addCircle(state.width * 0.5, state.height * 0.48, state.width * 0.16, colorWithAlpha(cycle.color, 0.055), 64);
  }

  function addParticle(x, y, vx, vy, life, radius, color, maxY = null) {
    if (state.particles.length > currentMode().particleCap) return;
    const particle = state.particlePool.pop() || {};
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
    if (state.particlePool.length < 220) state.particlePool.push(particle);
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
    if (Math.random() > 0.72) return;

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
    const plugTip = { x: engine.cx, y: engine.top + 42 * scale };
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
        [0.31, 0.78, 1],
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
          [1, 0.48, 0.18],
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
        [0.7, 0.72, 0.76],
      );
    }
  }

  function pushParticles() {
    particleCenters.length = 0;
    particleData.length = 0;
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1) * 0.58;
      particleCenters.push(particle.x, particle.y);
      particleData.push(
        particle.color[0],
        particle.color[1],
        particle.color[2],
        alpha,
        particle.radius * (1.25 - alpha * 0.25),
      );
    }
  }

  function buildEngineGeometry(cycle) {
    const minSide = Math.min(state.width, state.height);
    const scale = clamp(minSide / 760, 0.58, 1.05);
    const engine = {
      cx: state.width * 0.5,
      top: state.height * (state.width < 760 ? 0.22 : 0.17),
      cylinderWidth: 190 * scale,
      cylinderHeight: 360 * scale,
      pistonHeight: 72 * scale,
      crankRadius: 76 * scale,
      crankY: state.height * (state.width < 760 ? 0.74 : 0.72),
      scale,
    };

    const crankAngle = (state.angle * Math.PI) / 180;
    const crankX = engine.cx + Math.sin(crankAngle) * engine.crankRadius;
    const crankPinY = engine.crankY - Math.cos(crankAngle) * engine.crankRadius;
    const pistonTopClearance = 88 * scale;
    const pistonBottomClearance = 24 * scale;
    const pistonTravel = engine.cylinderHeight - pistonTopClearance - pistonBottomClearance - engine.pistonHeight;
    const pistonY =
      engine.top +
      pistonTopClearance +
      engine.pistonHeight +
      ((1 - Math.cos(crankAngle)) / 2) * pistonTravel;
    const chamberTop = engine.top + 24 * scale;
    const chamberBottom = pistonY - engine.pistonHeight * 0.12;
    const intakeLift = camLift(cycle.angle, 705, 190, 2, 16) * scale;
    const exhaustLift = camLift(cycle.angle, 520, 15, 2, 16) * scale;

    emitCycleParticles(engine, cycle, pistonY);

    addRoundedRectApprox(
      engine.cx - engine.cylinderWidth / 2,
      engine.top,
      engine.cylinderWidth,
      engine.cylinderHeight,
      18 * scale,
      rgba(235, 241, 250, 0.09),
    );
    addRing(engine.cx, engine.crankY, engine.crankRadius, 14 * scale, rgba(255, 255, 255, 0.22), 72);

    addRoundedRectApprox(
      engine.cx - engine.cylinderWidth * 0.38,
      chamberTop,
      engine.cylinderWidth * 0.76,
      Math.max(20, chamberBottom - chamberTop),
      12 * scale,
      colorWithAlpha(cycle.color, 0.14),
    );

    addLine(
      engine.cx - engine.cylinderWidth * 0.3,
      engine.top + 14 * scale,
      engine.cx - engine.cylinderWidth * 0.5,
      engine.top - 46 * scale,
      2 * scale,
      rgba(255, 255, 255, 0.2),
    );
    addLine(
      engine.cx - engine.cylinderWidth * 0.5,
      engine.top - 46 * scale,
      engine.cx - engine.cylinderWidth * 0.86,
      engine.top - 46 * scale,
      2 * scale,
      rgba(255, 255, 255, 0.2),
    );
    addLine(
      engine.cx + engine.cylinderWidth * 0.3,
      engine.top + 14 * scale,
      engine.cx + engine.cylinderWidth * 0.5,
      engine.top - 46 * scale,
      2 * scale,
      rgba(255, 255, 255, 0.2),
    );
    addLine(
      engine.cx + engine.cylinderWidth * 0.5,
      engine.top - 46 * scale,
      engine.cx + engine.cylinderWidth * 0.9,
      engine.top - 46 * scale,
      2 * scale,
      rgba(255, 255, 255, 0.2),
    );

    addValve(engine.cx - engine.cylinderWidth * 0.27, engine.top + 18 * scale, -1, intakeLift, scale);
    addValve(engine.cx + engine.cylinderWidth * 0.27, engine.top + 18 * scale, 1, exhaustLift, scale);
    addSparkPlug(engine, cycle);

    addLine(engine.cx, pistonY, crankX, crankPinY, 11 * scale, rgba(255, 255, 255, 0.34));
    addLine(engine.cx, pistonY, crankX, crankPinY, 4 * scale, rgba(0, 0, 0, 0.28));

    addRoundedRectApprox(
      engine.cx - engine.cylinderWidth * 0.39,
      pistonY - engine.pistonHeight,
      engine.cylinderWidth * 0.78,
      engine.pistonHeight,
      10 * scale,
      rgba(224, 230, 240, 0.55),
    );
    for (let i = 0; i < 3; i += 1) {
      addLine(
        engine.cx - engine.cylinderWidth * 0.33,
        pistonY - engine.pistonHeight + (18 + i * 13) * scale,
        engine.cx + engine.cylinderWidth * 0.33,
        pistonY - engine.pistonHeight + (18 + i * 13) * scale,
        2 * scale,
        rgba(255, 255, 255, 0.25),
      );
    }

    addLine(
      engine.cx,
      engine.crankY,
      crankX,
      crankPinY,
      7 * scale,
      cycle.index === 2 ? rgba(255, 122, 47, 0.62) : rgba(255, 255, 255, 0.44),
    );
    addCircle(crankX, crankPinY, 11 * scale, rgba(255, 255, 255, 0.72), 32);
  }

  function addValve(x, y, direction, lift, scale) {
    const rotation = direction * 0.42 - Math.PI / 2;
    const stemLength = 66 * scale;
    const cx = x + Math.cos(rotation) * lift;
    const cy = y + lift;
    addLine(
      cx + Math.cos(rotation) * -38 * scale,
      cy + Math.sin(rotation) * -38 * scale,
      cx + Math.cos(rotation) * 28 * scale,
      cy + Math.sin(rotation) * 28 * scale,
      5 * scale,
      rgba(225, 232, 242, 0.3),
    );
    addEllipse(
      cx + Math.cos(rotation) * stemLength * 0.43,
      cy + Math.sin(rotation) * stemLength * 0.43,
      24 * scale,
      7 * scale,
      rotation,
      rgba(225, 232, 242, 0.38),
      28,
    );
  }

  function addSparkPlug(engine, cycle) {
    const scale = engine.scale;
    const x = engine.cx;
    const y = engine.top - 10 * scale;
    addLine(x, y - 54 * scale, x, y + 30 * scale, 5 * scale, rgba(255, 255, 255, 0.3));
    addRoundedRectApprox(x - 12 * scale, y - 50 * scale, 24 * scale, 44 * scale, 5 * scale, rgba(255, 255, 255, 0.42));
    if (isIgnitionWindow(cycle.angle)) {
      addLine(x, y + 32 * scale, x - 12 * scale, y + 48 * scale, 3 * scale, rgba(255, 220, 92, 0.9));
      addLine(x - 12 * scale, y + 48 * scale, x + 9 * scale, y + 40 * scale, 3 * scale, rgba(255, 220, 92, 0.9));
      addLine(x + 9 * scale, y + 40 * scale, x - 2 * scale, y + 58 * scale, 3 * scale, rgba(255, 220, 92, 0.9));
    }
  }

  function renderShapes() {
    gl.useProgram(shapeProgram);
    gl.uniform2f(gl.getUniformLocation(shapeProgram, "u_resolution"), state.width, state.height);
    gl.bindVertexArray(shapeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shapeVertices), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, shapeVertices.length / 6);
  }

  function renderParticles() {
    if (state.particles.length === 0) return;
    pushParticles();
    gl.useProgram(particleProgram);
    gl.uniform2f(gl.getUniformLocation(particleProgram, "u_resolution"), state.width, state.height);
    gl.bindVertexArray(particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, particleCenterBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particleCenters), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, particleDataBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particleData), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, state.particles.length);
  }

  function draw(now) {
    if (!state.visible) {
      state.lastTime = now;
      requestAnimationFrame(draw);
      return;
    }

    const mode = currentMode();
    const frameInterval = 1000 / mode.fps;
    if (now - state.lastDrawTime < frameInterval) {
      requestAnimationFrame(draw);
      return;
    }

    const renderStart = performance.now();
    const dt = Math.min((now - state.lastTime) / 1000, 0.08);
    state.lastTime = now;
    state.lastDrawTime = now;

    updateScrollBoost(dt);
    state.rpm = lerp(state.rpm, state.targetRpm, 1 - Math.pow(0.018, dt));
    state.angle += (state.rpm * 6 * dt) / 2.3;

    const cycle = getCycle(state.angle);
    updateParticles(dt);
    shapeVertices.length = 0;

    addGrid();
    addGlow(cycle);
    buildEngineGeometry(cycle);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderShapes();
    renderParticles();

    const renderCost = performance.now() - renderStart;
    state.frameTimes.push(renderCost);
    if (state.frameTimes.length > 45) state.frameTimes.shift();
    state.frameCount += 1;

    if (now - state.metricsLastTime > 500) {
      const averageCost = state.frameTimes.reduce((sum, cost) => sum + cost, 0) / state.frameTimes.length;
      const fps = (state.frameCount * 1000) / (now - state.metricsLastTime);
      metricFps.textContent = String(Math.round(fps));
      metricFrame.textContent = `${averageCost.toFixed(1)}ms`;
      metricDpr.textContent = state.dpr.toFixed(2);
      metricParticles.textContent = String(state.particles.length);
      state.metricsLastTime = now;
      state.frameCount = 0;
    }

    requestAnimationFrame(draw);
  }

  modeInput.addEventListener("change", resize);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    state.visible = !document.hidden;
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    state.visible = false;
  });

  resize();
  requestAnimationFrame(draw);
})();
