const PhoneBackground = (() => {
  const canvas = document.getElementById('phone-canvas');
  if (!canvas || !canvas.getContext) {
    return null;
  }

  const ctx = canvas.getContext('2d', { alpha: true });

  const glows = [];
  let width = 0;
  let height = 0;
  let dpr = window.devicePixelRatio || 1;
  let lastScrollY = window.scrollY || 0;
  let lastTime = performance.now();
  let scrollEnergy = 0;

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function configureCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initGlows() {
    glows.length = 0;
    const count = width < 768 ? 9 : width < 1280 ? 14 : 20;
    for (let i = 0; i < count; i += 1) {
      const baseRadius = randomBetween(160, 320);
      const hue = randomBetween(180, 220);
      const saturation = randomBetween(55, 70);
      const brightness = randomBetween(35, 55);

      glows.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius,
        hue,
        saturation,
        brightness,
        driftX: randomBetween(-0.05, 0.05),
        driftY: randomBetween(-0.04, 0.04),
        pulseOffset: Math.random() * Math.PI * 2,
        pulseSpeed: randomBetween(0.00025, 0.0005),
        baseScale: randomBetween(0.9, 1.15),
        scale: 1,
        targetScale: 1,
        alpha: randomBetween(0.25, 0.42),
        targetAlpha: randomBetween(0.3, 0.45),
        responsiveness: randomBetween(0.55, 1.15)
      });
    }
  }

  function resize() {
    configureCanvas();
    initGlows();
  }

  function wrapGlow(glow) {
    const buffer = glow.baseRadius * 1.5;
    if (glow.x < -buffer) glow.x = width + buffer;
    if (glow.x > width + buffer) glow.x = -buffer;
    if (glow.y < -buffer) glow.y = height + buffer;
    if (glow.y > height + buffer) glow.y = -buffer;
  }

  function handleScroll() {
    const currentY = window.scrollY || 0;
    const delta = currentY - lastScrollY;
    if (delta !== 0) {
      const impulse = clamp(delta / 260, -0.85, 0.85);
      scrollEnergy = clamp(scrollEnergy + impulse * 0.42, -1, 1);

      glows.forEach((glow) => {
        const direction = Math.sign(impulse) || 1;
        const energy = Math.abs(scrollEnergy) * glow.responsiveness;
        glow.targetScale = clamp(glow.baseScale + direction * energy * 0.22, glow.baseScale * 0.75, glow.baseScale * 1.4);
        glow.targetAlpha = clamp(0.24 + energy * 0.1, 0.2, 0.5);
        glow.driftX += direction * 0.012 * glow.responsiveness;
        glow.driftY -= direction * 0.008 * glow.responsiveness;
      });

      lastScrollY = currentY;
    }
  }

  function updateGlow(glow, deltaFactor) {
    glow.pulseOffset += glow.pulseSpeed * deltaFactor * 16;

    glow.scale += (glow.targetScale - glow.scale) * 0.045 * deltaFactor;
    glow.alpha += (glow.targetAlpha - glow.alpha) * 0.04 * deltaFactor;

    glow.driftX *= 0.998;
    glow.driftY *= 0.998;

    glow.x += glow.driftX * deltaFactor * 4;
    glow.y += glow.driftY * deltaFactor * 4;

    wrapGlow(glow);
  }

  function renderGlow(glow) {
    const pulse = 0.85 + Math.sin(glow.pulseOffset) * 0.08;
    const radius = glow.baseRadius * glow.scale * pulse;

    const gradient = ctx.createRadialGradient(glow.x, glow.y, radius * 0.18, glow.x, glow.y, radius);
    gradient.addColorStop(0, `hsla(${glow.hue}, ${glow.saturation}%, ${glow.brightness + 15}%, ${glow.alpha * 0.9})`);
    gradient.addColorStop(0.55, `hsla(${glow.hue + 12}, ${glow.saturation - 10}%, ${glow.brightness}%, ${glow.alpha * 0.55})`);
    gradient.addColorStop(1, `rgba(5, 9, 16, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(frameTime) {
    const deltaTime = Math.min(100, frameTime - lastTime);
    lastTime = frameTime;
    const deltaFactor = deltaTime / 16.6667;

    scrollEnergy *= 0.975;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'screen';

    glows.forEach((glow) => {
      updateGlow(glow, deltaFactor);
      renderGlow(glow);
    });

    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', handleScroll, { passive: true });

  requestAnimationFrame(draw);

  return {
    refresh: resize
  };
})();
