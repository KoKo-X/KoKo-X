(() => {
  const staticCanvas = document.querySelector("#staticNetworkCanvas");
  const canvas = document.querySelector("#networkCanvas");
  if (!staticCanvas || !canvas) return;

  const staticCtx = staticCanvas.getContext("2d");
  const ctx = canvas.getContext("2d");
  if (!staticCtx || !ctx) return;

  const pointer = { x: 0, y: 0, active: false };
  const particles = [];
  const staticParticles = [];
  const staticLinks = [];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tiltPermissionButton = document.querySelector("[data-tilt-permission]");
  const OVERSCAN = 160;
  const NEUTRAL_BETA = 65;
  const NEUTRAL_GAMMA = 0;

  let width = 0;
  let height = 0;
  let surfaceWidth = 0;
  let surfaceHeight = 0;
  let scrollRatio = 0;
  let lastFrame = 0;
  let tiltX = 0;
  let tiltY = 0;
  let fallbackParallaxX = 0;
  let fallbackParallaxY = 0;
  let hasDeviceTilt = false;
  let resizeTimer = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const drawStaticNetwork = () => {
    staticCtx.clearRect(0, 0, surfaceWidth, surfaceHeight);
    staticCtx.lineWidth = 1.2;

    staticLinks.forEach(([from, to, distance]) => {
      const a = staticParticles[from];
      const b = staticParticles[to];
      const alpha = clamp(1 - distance / (Math.max(width, height) * 0.34), 0.18, 0.74);
      staticCtx.globalAlpha = alpha;
      staticCtx.strokeStyle = "rgba(18, 137, 96, 1)";
      staticCtx.beginPath();
      staticCtx.moveTo(a.x, a.y);
      staticCtx.lineTo(b.x, b.y);
      staticCtx.stroke();
    });

    staticCtx.globalAlpha = 1;
    staticCtx.fillStyle = "rgba(15, 125, 88, 0.68)";
    staticParticles.forEach((particle) => {
      staticCtx.beginPath();
      staticCtx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      staticCtx.fill();
    });
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

    const dynamicCount = Math.min(74, Math.max(44, Math.floor(width / 20)));
    if (isInitialLayout) {
      for (let index = 0; index < dynamicCount; index += 1) {
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
      for (let index = 0; index < staticCount; index += 1) {
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

    staticParticles.forEach((particle, index) => {
      const nearest = staticParticles
        .map((point, pointIndex) => ({
          index: pointIndex,
          distance: Math.hypot(particle.x - point.x, particle.y - point.y),
        }))
        .filter((item) => item.index !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      nearest.forEach(({ index: targetIndex, distance }) => {
        if (index < targetIndex && distance < Math.max(width, height) * 0.34) {
          staticLinks.push([index, targetIndex, distance]);
        }
      });
    });

    drawStaticNetwork();
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
    ctx.fillStyle = "rgba(23, 176, 110, 0.78)";
    ctx.lineWidth = 1.3;

    const drift = scrollRatio * 80;
    const parallaxDrawX = (hasDeviceTilt ? tiltX : fallbackParallaxX) * 10;
    const parallaxDrawY = (hasDeviceTilt ? tiltY : fallbackParallaxY) * 10;

    particles.forEach((particle) => {
      if (!prefersReducedMotion) {
        particle.x += particle.vx + scrollRatio * 0.12;
        particle.y += particle.vy;
      }

      if (particle.x < 16 || particle.x > surfaceWidth - 16) {
        particle.vx *= -1;
        particle.x = clamp(particle.x, 16, surfaceWidth - 16);
      }
      if (particle.y < 16 || particle.y > surfaceHeight - 16) {
        particle.vy *= -1;
        particle.y = clamp(particle.y, 16, surfaceHeight - 16);
      }

      particle.drawX = particle.x + Math.sin((particle.y + drift) * 0.004) * 18 + parallaxDrawX;
      particle.drawY = particle.y + Math.cos((particle.x + drift) * 0.003) * 12 + parallaxDrawY;

      ctx.beginPath();
      ctx.arc(particle.drawX, particle.drawY, particle.r * 1.5, 0, Math.PI * 2);
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

    for (let index = 0; index < particles.length; index += 1) {
      for (let targetIndex = index + 1; targetIndex < particles.length; targetIndex += 1) {
        const a = particles[index];
        const b = particles[targetIndex];
        const midpointX = (a.drawX + b.drawX) / 2;
        const midpointY = (a.drawY + b.drawY) / 2;
        const zone = Math.hypot(midpointX - centerX, midpointY - centerY) / maxRadius;
        if (zone > connectionLimit) continue;

        const distance = Math.hypot(a.drawX - b.drawX, a.drawY - b.drawY);
        const maxDistance = zone <= innerNetwork
          ? Math.min(220, Math.max(150, width * 0.16))
          : Math.min(170, Math.max(118, width * 0.12));

        if (distance >= maxDistance) continue;

        const distanceAlpha = 1 - distance / maxDistance;
        const zoneAlpha = zone <= innerNetwork
          ? 0.76
          : (0.22 + outerReveal * 0.52) * clamp((connectionLimit - zone) / 0.08, 0.25, 1);

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

    if (pointer.active && !prefersReducedMotion) {
      particles.forEach((particle) => {
        const distance = Math.hypot(pointer.x - particle.drawX, pointer.y - particle.drawY);
        if (distance >= 180) return;

        ctx.globalAlpha = 1 - distance / 180;
        ctx.strokeStyle = "rgba(46, 216, 187, 0.42)";
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(particle.drawX, particle.drawY);
        ctx.stroke();
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
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollRatio = clamp(window.scrollY / maxScroll, 0, 1);
  };

  const handleOrientation = (event) => {
    if (typeof event.beta !== "number" || typeof event.gamma !== "number") return;
    hasDeviceTilt = true;
    tiltY += (clamp((event.beta - NEUTRAL_BETA) / 28, -1, 1) - tiltY) * 0.12;
    tiltX += (clamp((event.gamma - NEUTRAL_GAMMA) / 24, -1, 1) - tiltX) * 0.12;
  };

  const enableTilt = () => {
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
    if (
      !tiltPermissionButton
      || prefersReducedMotion
      || !isTouchDevice
      || !("DeviceOrientationEvent" in window)
    ) {
      return;
    }

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

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  const observeReveal = (element) => {
    if (!(element instanceof HTMLElement) || element.dataset.revealReady) return;
    element.dataset.revealReady = "true";
    element.classList.add("reveal");
    revealObserver.observe(element);
  };

  document.querySelectorAll(
    ".hero-content, main > .section, main > .wide-band"
  ).forEach(observeReveal);

  const dynamicContentObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(".category-card, .store-card")) observeReveal(node);
        node.querySelectorAll?.(".category-card, .store-card").forEach(observeReveal);
      });
    });
  });
  dynamicContentObserver.observe(document.querySelector("main"), { childList: true, subtree: true });

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
  document.documentElement.addEventListener("mouseleave", () => {
    pointer.active = false;
  });

  resize();
  updateScroll();
  enableTilt();
  draw(34);
})();
