const MatrixBackground = (() => {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) {
    return null;
  }

  const ctx = canvas.getContext('2d');
  const IMEI_LENGTH = 15;
  const BASE_HUE = 145;
  const BASE_INTENSITY = 1.0;
  const BASE_SPEED = 0.35; // much slower base speed
  const MIN_FONT = 12;
  const MAX_FONT = 22;

  let width = window.innerWidth;
  let height = window.innerHeight;
  let columns = [];
  let hue = BASE_HUE;
  let intensity = BASE_INTENSITY;
  let speedMultiplier = 1;
  let lastScrollY = window.scrollY;
  let scrollTimeout = null;

  const generateIMEI = () => Array.from({ length: IMEI_LENGTH }, () => Math.floor(Math.random() * 10)).join('');

  const setupColumns = () => {
    columns = [];
    let x = 0;
    while (x < width + MAX_FONT) {
      const fontSize = Math.floor(Math.random() * (MAX_FONT - MIN_FONT + 1)) + MIN_FONT;
      const spacing = fontSize * 0.9;
      const speed = BASE_SPEED + Math.random() * 0.25;
      columns.push({
        x,
        fontSize,
        drop: Math.random() * (height / fontSize),
        sequence: generateIMEI(),
        speed
      });
      x += spacing;
    }
  };

  const resizeCanvas = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    setupColumns();
  };

  const draw = () => {
    ctx.fillStyle = 'rgba(4, 12, 24, 0.22)';
    ctx.fillRect(0, 0, width, height);

    const headColor = `hsla(${hue}, 85%, 70%, ${Math.min(1, 0.75 * intensity)})`;
    const trailColor = `hsla(${hue}, 70%, 55%, ${Math.min(0.7, 0.45 * intensity)})`;

    columns.forEach((col) => {
      ctx.font = `${col.fontSize}px "Source Code Pro", "Fira Code", monospace`;
      const columnHeight = col.fontSize * IMEI_LENGTH;
      const y = col.drop * col.fontSize;

      for (let i = 0; i < IMEI_LENGTH; i += 1) {
        const char = col.sequence.charAt(i);
        const yPos = y - i * col.fontSize;
        if (yPos < -col.fontSize || yPos > height + col.fontSize) {
          continue;
        }
        ctx.fillStyle = i === 0 ? headColor : trailColor;
        ctx.fillText(char, col.x, yPos);
      }

      if (y > height + columnHeight && Math.random() > 0.97) {
        col.drop = 0;
        col.sequence = generateIMEI();
      }

      col.drop += col.speed * speedMultiplier;
    });

    requestAnimationFrame(draw);
  };

  const handleScroll = () => {
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    lastScrollY = currentY;

    const direction = delta > 0 ? 1 : (delta < 0 ? -1 : 0);
    const magnitude = Math.min(1.0, Math.abs(delta) / 160);

    hue = BASE_HUE + direction * 18 * magnitude;
    intensity = BASE_INTENSITY + magnitude * 0.5;
    speedMultiplier = 1 + magnitude * (direction >= 0 ? 1.2 : 0.6);

    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      hue = BASE_HUE;
      intensity = BASE_INTENSITY;
      speedMultiplier = 1;
    }, 200);
  };

  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', handleScroll, { passive: true });

  resizeCanvas();
  requestAnimationFrame(draw);

  return {
    refresh: resizeCanvas
  };
})();
