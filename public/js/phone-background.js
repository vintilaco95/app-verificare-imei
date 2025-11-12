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

  const randomBetween = (min, max) => min + Math.random() * (max - min);

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
        pulseOffset: Math.random() * Math.PI * 2,
        scale: randomBetween(0.9, 1.15),
        alpha: randomBetween(0.28, 0.4)
      });
    }
  }

  function renderGlow(glow) {
    const pulse = 0.92 + Math.sin(glow.pulseOffset) * 0.04;
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

  function renderScene() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'screen';

    glows.forEach((glow) => renderGlow(glow));

    ctx.globalCompositeOperation = 'source-over';
  }

  function refresh() {
    configureCanvas();
    initGlows();
    renderScene();
  }

  refresh();
  window.addEventListener('resize', refresh, { passive: true });

  return {
    refresh
  };
})();
