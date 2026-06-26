const staticCanvas = document.querySelector("#staticNetworkCanvas");
const staticCtx = staticCanvas.getContext("2d");
const canvas = document.querySelector("#networkCanvas");
const ctx = canvas.getContext("2d");
const pointer = { x: 0, y: 0, active: false };
const particles = [];
const staticParticles = [];
const staticLinks = [];
let width = 0;
let height = 0;
let scrollRatio = 0;
let lastFrame = 0;
let tiltX = 0;
let tiltY = 0;
let fallbackParallaxX = 0;
let fallbackParallaxY = 0;
let hasDeviceTilt = false;
let surfaceWidth = 0;
let surfaceHeight = 0;
let resizeTimer = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tiltPermissionButton = document.querySelector("[data-tilt-permission]");
const OVERSCAN = 160;

// A relaxed portrait hold: spec says beta=0 flat and beta=90 vertical, so 65deg avoids using a table-flat neutral.
const NEUTRAL_BETA = 65;
const NEUTRAL_GAMMA = 0;

const shops = {
  yamagen: {
    status: "LPあり / 取材コメント",
    name: "ヤマゲンモータース",
    copy: "バイク整備・修理相談。初めての人にも声をかけやすい町のバイク屋さん。",
    area: "千葉県我孫子市",
    tags: "バイク整備 / 地域密着",
    href: "../../bike/yamagenmotors/",
  },
  komorebi: {
    status: "基本掲載 / 食事どころ",
    name: "食堂こもれび",
    copy: "ランチや夕食で立ち寄りやすい、地域の飲食店。",
    area: "千葉県柏市",
    tags: "ランチ / 地域密着",
    href: "../../food/",
  },
  aoba: {
    status: "基本掲載 / 職人相談",
    name: "青葉解体工業",
    copy: "近隣への配慮、見積もり前の相談、現場段取りを大切にする職人事業者。",
    area: "千葉県松戸市",
    tags: "解体 / 近隣配慮",
    href: "../../construction/",
  },
};

const resize = () => {
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  const previousSurfaceWidth = surfaceWidth;
  const previousSurfaceHeight = surfaceHeight;
  const isInitialLayout = width === 0 || height === 0;
  const widthChanged = Math.abs(nextWidth - width) > 4;
  const smallMobileViewportShift = !isInitialLayout
    && !widthChanged
    && Math.abs(nextHeight - height) <= 120;

  // Mobile browser chrome changes the viewport height while scrolling. Keeping
  // the oversized canvas avoids clearing and rebuilding the network each time.
  if (smallMobileViewportShift) return;

  width = nextWidth;
  height = nextHeight;
  surfaceWidth = width + OVERSCAN * 2;
  surfaceHeight = height + OVERSCAN * 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  [staticCanvas, canvas].forEach((layer) => {
    layer.width = Math.floor(surfaceWidth * dpr);
    layer.height = Math.floor(surfaceHeight * dpr);
    layer.style.width = `${surfaceWidth}px`;
    layer.style.height = `${surfaceHeight}px`;
  });
  staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const count = Math.min(74, Math.max(44, Math.floor(width / 20)));
  if (isInitialLayout) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: Math.random() * surfaceWidth,
        y: Math.random() * surfaceHeight,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: Math.random() * 1.8 + 1,
      });
    }
  } else {
    const scaleX = surfaceWidth / previousSurfaceWidth;
    const scaleY = surfaceHeight / previousSurfaceHeight;
    particles.forEach((particle) => {
      particle.x *= scaleX;
      particle.y *= scaleY;
    });
  }

  const staticCount = Math.min(96, Math.max(58, Math.floor(width / 15)));
  staticLinks.length = 0;
  if (isInitialLayout) {
    for (let i = 0; i < staticCount; i += 1) {
      staticParticles.push({
        x: Math.random() * surfaceWidth,
        y: Math.random() * surfaceHeight,
        r: Math.random() * 1.9 + 1.5,
      });
    }
  } else {
    const scaleX = surfaceWidth / previousSurfaceWidth;
    const scaleY = surfaceHeight / previousSurfaceHeight;
    staticParticles.forEach((particle) => {
      particle.x *= scaleX;
      particle.y *= scaleY;
    });
  }

  for (let i = 0; i < staticParticles.length; i += 1) {
    const distances = staticParticles
      .map((point, index) => ({ index, dist: Math.hypot(staticParticles[i].x - point.x, staticParticles[i].y - point.y) }))
      .filter((item) => item.index !== i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    distances.forEach(({ index, dist }) => {
      if (i < index && dist < Math.max(width, height) * 0.34) {
        staticLinks.push([i, index, dist]);
      }
    });
  }

  drawStaticNetwork();
};

const drawStaticNetwork = () => {
  staticCtx.clearRect(0, 0, surfaceWidth, surfaceHeight);
  staticCtx.lineWidth = 1.15;

  staticLinks.forEach(([from, to, dist]) => {
    const a = staticParticles[from];
    const b = staticParticles[to];
    const alpha = clamp(1 - dist / (Math.max(width, height) * 0.34), 0.16, 0.72);
    staticCtx.globalAlpha = alpha;
    staticCtx.strokeStyle = "rgba(18, 137, 96, 1)";
    staticCtx.beginPath();
    staticCtx.moveTo(a.x, a.y);
    staticCtx.lineTo(b.x, b.y);
    staticCtx.stroke();
  });

  staticCtx.globalAlpha = 1;
  staticCtx.fillStyle = "rgba(15, 125, 88, 0.62)";
  staticParticles.forEach((p) => {
    staticCtx.beginPath();
    staticCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    staticCtx.fill();
  });
};

const applyParallax = () => {
  const x = hasDeviceTilt ? tiltX : fallbackParallaxX;
  const y = hasDeviceTilt ? tiltY : fallbackParallaxY;
  staticCanvas.style.transform = `translate3d(${x * 5}px, ${y * 5}px, 0)`;
  canvas.style.transform = `translate3d(${x * 18}px, ${y * 18}px, 0)`;
};

const draw = (time = 0) => {
  if (time - lastFrame < 33) {
    requestAnimationFrame(draw);
    return;
  }
  lastFrame = time;

  ctx.clearRect(0, 0, surfaceWidth, surfaceHeight);
  ctx.fillStyle = "rgba(23, 176, 110, 0.72)";
  ctx.strokeStyle = "rgba(23, 176, 110, 0.3)";
  ctx.lineWidth = 1.25;

  const drift = scrollRatio * 80;
  const parallaxDrawX = (hasDeviceTilt ? tiltX : fallbackParallaxX) * 10;
  const parallaxDrawY = (hasDeviceTilt ? tiltY : fallbackParallaxY) * 10;

  particles.forEach((p) => {
    p.x += p.vx + scrollRatio * 0.12;
    p.y += p.vy;

    if (p.x < 16 || p.x > surfaceWidth - 16) {
      p.vx *= -1;
      p.x = clamp(p.x, 16, surfaceWidth - 16);
    }
    if (p.y < 16 || p.y > surfaceHeight - 16) {
      p.vy *= -1;
      p.y = clamp(p.y, 16, surfaceHeight - 16);
    }

    const px = p.x + Math.sin((p.y + drift) * 0.004) * 18 + parallaxDrawX;
    const py = p.y + Math.cos((p.x + drift) * 0.003) * 12 + parallaxDrawY;

    p.drawX = px;
    p.drawY = py;

    ctx.beginPath();
    ctx.arc(p.drawX, p.drawY, p.r * 1.45, 0, Math.PI * 2);
    ctx.fill();
  });

  const centerX = OVERSCAN + width / 2;
  const centerY = OVERSCAN + height / 2;
  const maxRadius = Math.hypot(width / 2, height / 2);
  const innerNetwork = 0.7;
  const connectionLimit = innerNetwork + scrollRatio * 0.3;
  const outerReveal = clamp((connectionLimit - innerNetwork) / 0.3, 0, 1);
  let innerConnections = 0;
  let outerConnections = 0;

  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const a = particles[i];
      const b = particles[j];
      const midX = (a.drawX + b.drawX) / 2;
      const midY = (a.drawY + b.drawY) / 2;
      const zone = Math.hypot(midX - centerX, midY - centerY) / maxRadius;

      if (zone > connectionLimit) continue;

      const dx = a.drawX - b.drawX;
      const dy = a.drawY - b.drawY;
      const dist = Math.hypot(dx, dy);
      const maxDist = zone <= innerNetwork
        ? Math.min(220, Math.max(150, width * 0.16))
        : Math.min(170, Math.max(118, width * 0.12));

      if (dist < maxDist) {
        const distanceAlpha = 1 - dist / maxDist;
        const zoneAlpha = zone <= innerNetwork
          ? 0.74
          : (0.2 + outerReveal * 0.5) * clamp((connectionLimit - zone) / 0.08, 0.25, 1);

        ctx.globalAlpha = distanceAlpha * zoneAlpha;
        ctx.strokeStyle = zone <= innerNetwork
          ? "rgba(23, 176, 110, 1)"
          : "rgba(46, 216, 187, 1)";
        ctx.beginPath();
        ctx.moveTo(a.drawX, a.drawY);
        ctx.lineTo(b.drawX, b.drawY);
        ctx.stroke();

        if (zone <= innerNetwork) {
          innerConnections += 1;
        } else {
          outerConnections += 1;
        }
      }
    }
  }

  if (pointer.active) {
    particles.forEach((p) => {
      const dist = Math.hypot(pointer.x - p.drawX, pointer.y - p.drawY);
      if (dist < 180) {
        ctx.globalAlpha = 1 - dist / 180;
        ctx.strokeStyle = "rgba(46, 216, 187, 0.34)";
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(p.drawX, p.drawY);
        ctx.stroke();
      }
    });
  }

  ctx.globalAlpha = 1;
  window.__portalNetworkStats = {
    innerConnections,
    outerConnections,
    connectionLimit,
    scrollRatio,
  };
  applyParallax();
  requestAnimationFrame(draw);
};

const updateScroll = () => {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  scrollRatio = window.scrollY / max;
};

window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resize, 120);
});
window.addEventListener("scroll", updateScroll, { passive: true });
window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX + OVERSCAN;
  pointer.y = event.clientY + OVERSCAN;
  pointer.active = true;
  if (!hasDeviceTilt && !prefersReducedMotion) {
    fallbackParallaxX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
    fallbackParallaxY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
  }
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

const handleOrientation = (event) => {
  if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;
  hasDeviceTilt = true;
  tiltY += (clamp((event.beta - NEUTRAL_BETA) / 28, -1, 1) - tiltY) * 0.12;
  tiltX += (clamp((event.gamma - NEUTRAL_GAMMA) / 24, -1, 1) - tiltX) * 0.12;
};

const enableTilt = async () => {
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  if (prefersReducedMotion || !isTouchDevice || !("DeviceOrientationEvent" in window)) return;

  tiltPermissionButton.hidden = false;
  tiltPermissionButton.addEventListener("click", async () => {
    try {
      const response = typeof DeviceOrientationEvent.requestPermission === "function"
        ? await DeviceOrientationEvent.requestPermission()
        : "granted";

      if (response === "granted") {
        tiltPermissionButton.hidden = true;
        window.addEventListener("deviceorientation", handleOrientation, { passive: true });
      }
    } catch {
      tiltPermissionButton.textContent = "端末設定を確認";
    }
  });
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  },
  { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
  observer.observe(element);
});

const mapCard = document.querySelector("[data-map-card]");
document.querySelectorAll(".pin").forEach((pin) => {
  pin.addEventListener("click", () => {
    const shop = shops[pin.dataset.shop];
    document.querySelectorAll(".pin").forEach((item) => item.classList.toggle("active", item === pin));
    mapCard.innerHTML = `
      <span class="status">${shop.status}</span>
      <h3>${shop.name}</h3>
      <p>${shop.copy}</p>
      <dl>
        <div><dt>Area</dt><dd>${shop.area}</dd></div>
        <div><dt>Tags</dt><dd>${shop.tags}</dd></div>
      </dl>
      <a href="${shop.href}">詳しく見る</a>
    `;
  });
});

resize();
updateScroll();
enableTilt();
draw();
