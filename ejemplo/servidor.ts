// bun ejemplo/servidor.ts → http://localhost:3000 (añade ?debug para ver hotspots, piso y huellas)
import { resolve } from 'node:path';
import index from './index.html';

const CARPETA_NIVELES = resolve(import.meta.dir, 'niveles');

// Assets de relleno: SVG generado por clave, para probar sin el arte real de R2.
const TAM: Record<string, [number, number, string]> = {
  cielo: [2400, 720, '#9fd8f5'], suelo: [2400, 720, 'none'], comal: [160, 120, '#5b5b5b'],
  spr_tommy: [90, 160, '#3b82c4'], spr_tortu: [110, 170, '#3fa34d'], spr_ajolo: [80, 110, '#f29bb8'],
};
function svg(clave: string, frames = 1) {
  const [w, h, color] = TAM[clave] ?? [90, 160, '#3b82c4'];
  let cuerpo = '';
  if (clave === 'cielo') cuerpo = `<rect width="${w}" height="${h}" fill="${color}"/>` + Array.from({ length: 12 }, (_, i) => `<ellipse cx="${i * 220 + 80}" cy="${90 + (i % 3) * 40}" rx="70" ry="24" fill="#fff" opacity=".8"/>`).join('');
  else if (clave === 'suelo') cuerpo = `<rect y="300" width="${w}" height="120" fill="#e9b872"/><rect y="420" width="${w}" height="300" fill="#c99a5b"/>` + Array.from({ length: 10 }, (_, i) => `<rect x="${i * 240 + 30}" y="160" width="180" height="140" fill="#f2a65a" stroke="#8b5a2b" stroke-width="6"/>`).join('');
  else for (let f = 0; f < frames; f++) {
    const x = f * w, dy = f % 2 ? 6 : 0;
    cuerpo += `<rect x="${x + w * 0.15}" y="${h * 0.35 + dy}" width="${w * 0.7}" height="${h * 0.65 - dy}" rx="18" fill="${color}"/><circle cx="${x + w / 2}" cy="${h * 0.22 + dy}" r="${w * 0.3}" fill="#f1c27d"/><circle cx="${x + w * 0.62}" cy="${h * 0.2 + dy}" r="5" fill="#222"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * frames}" height="${h}">${cuerpo}</svg>`;
}

Bun.serve({
  routes: {
    '/': index,
    '/niveles/*': (req) => {
      const relativo = decodeURIComponent(new URL(req.url).pathname.slice('/niveles/'.length));
      const destino = resolve(CARPETA_NIVELES, relativo);
      if (!destino.startsWith(`${CARPETA_NIVELES}/`)) return new Response('prohibido', { status: 403 });
      return new Response(Bun.file(destino));
    },
    '/assets/*': (req) => {
      const nombre = new URL(req.url).pathname.slice('/assets/'.length);
      const clave = nombre.replace(/\.[a-z0-9]+$/i, '');
      const personaje = clave.replace(/_(idle|caminar|hablar)$/, '');
      const esAnim = personaje !== clave;
      if (nombre.endsWith('.json')) {
        const [w, h] = TAM[`spr_${personaje}`] ?? [90, 160];
        const frames = Object.fromEntries([0, 1].map((f) => [`f${f}`, { frame: { x: f * w, y: 0, w, h } }]));
        return Response.json({ frames, meta: { size: { w: w * 2, h } } });
      }
      if (nombre.endsWith('.mp3')) return new Response('sin audio', { status: 404 });
      return new Response(svg(esAnim ? `spr_${personaje}` : clave, esAnim ? 2 : 1), { headers: { 'content-type': 'image/svg+xml' } });
    },
  },
  development: { hmr: true, console: true },
});
console.log('demo en http://localhost:3000');
