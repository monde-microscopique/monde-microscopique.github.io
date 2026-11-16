// Écran macro du temps 2 : le grain tombe dans le bécher, rétrécit, puis disparaît (liquide limpide).
// Dessin 2D simple dans l'encart ; la taille du grain suit la fraction d'ions encore dans le cristal.

export function dessinerBecher(ctx, l, h, fraction, tc, fond) {
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, l, h);
  const w = l * 0.56, hb = h * 0.72;
  const x0 = (l - w) / 2, y0 = h * 0.16, fondB = y0 + hb;
  const niveau = y0 + hb * 0.28;
  // Eau
  ctx.fillStyle = 'rgba(160,200,235,0.55)';
  ctx.fillRect(x0 + 2, niveau, w - 4, fondB - niveau - 2);
  ctx.strokeStyle = 'rgba(90,130,170,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 + 2, niveau); ctx.lineTo(x0 + w - 2, niveau); ctx.stroke();
  // Verre du bécher
  ctx.strokeStyle = '#5f6f80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0 - 4, y0); ctx.lineTo(x0, y0 + 4); ctx.lineTo(x0, fondB); ctx.lineTo(x0 + w, fondB); ctx.lineTo(x0 + w, y0 + 4); ctx.lineTo(x0 + w + 4, y0);
  ctx.stroke();
  // Grain : il tombe pendant les 2,5 premières secondes, puis rétrécit avec la dissolution.
  if (fraction > 0.002) {
    const cote = Math.max(1.5, l * 0.11 * Math.cbrt(fraction));
    const chute = Math.min(1, Math.max(0, tc / 2.5));
    const yHaut = y0 - cote - 4, yBas = fondB - cote - 2;
    const y = yHaut + (yBas - yHaut) * chute * chute;
    const x = l / 2 - cote / 2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#60707f';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, cote, cote);
    ctx.strokeRect(x, y, cote, cote);
  }
}
