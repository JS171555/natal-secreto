export const FLAKE_ARM_PATH = 'M12 12V2.4M12 5.4 9.4 3.2M12 5.4l2.6-2.2M12 8.8 10 7.1M12 8.8l2-1.7';

let flakePath;
function getFlakePath() {
  if (flakePath) return flakePath;
  const arm = new Path2D(FLAKE_ARM_PATH);
  flakePath = new Path2D();
  for (let i = 0; i < 6; i++) {
    const transform = new DOMMatrix().translate(12, 12).rotate(i * 60).translate(-12, -12);
    flakePath.addPath(arm, transform);
  }
  return flakePath;
}

/** Desenha o mesmo floco de seis braços usado no loading, centrado em (x, y). */
export function drawSnowflake(ctx, x, y, size, rotation = 0) {
  const scale = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  ctx.strokeStyle = '#F5F7FF';
  ctx.fillStyle = '#F5F7FF';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(getFlakePath());
  ctx.beginPath();
  ctx.arc(12, 12, 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
