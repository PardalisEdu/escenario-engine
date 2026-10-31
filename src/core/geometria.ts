// Geometría simple del piso, huellas y hotspots (§7.3). Sin motor de física.
import type { Vec } from './esquema';

export type Forma =
  | { tipo: 'rect' | 'elipse'; x: number; y: number; w: number; h: number }
  | { tipo: 'poligono'; puntos: Vec[] };

export function dentroPoligono(p: Vec, poly: Vec[]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

export function dentroForma(p: Vec, f: Forma): boolean {
  if (f.tipo === 'poligono') return dentroPoligono(p, f.puntos);
  if (f.tipo === 'rect') return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
  const rx = f.w / 2, ry = f.h / 2;
  return ((p.x - f.x - rx) / rx) ** 2 + ((p.y - f.y - ry) / ry) ** 2 <= 1;
}

export function cajaForma(f: Forma): { x: number; y: number; w: number; h: number } {
  if (f.tipo !== 'poligono') return f;
  const xs = f.puntos.map((p) => p.x), ys = f.puntos.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Punto inferior central («de pie») de una forma. */
export function pieForma(f: Forma): Vec {
  const c = cajaForma(f);
  return { x: c.x + c.w / 2, y: c.y + c.h };
}

const masCercanoEnSegmento = (p: Vec, a: Vec, b: Vec): Vec => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return { x: a.x + t * dx, y: a.y + t * dy };
};

const dist2 = (a: Vec, b: Vec) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Ajusta p al punto más cercano dentro de alguno de los pisos. */
export function ajustarAlPiso(p: Vec, pisos: Vec[][]): Vec {
  if (pisos.some((poly) => dentroPoligono(p, poly))) return p;
  let mejor: Vec = p, d = Infinity, poligono: Vec[] = [], normal: Vec = { x: 0, y: 0 };
  for (const poly of pisos) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      const q = masCercanoEnSegmento(p, a, b);
      const dq = dist2(p, q);
      if (dq < d) {
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        [mejor, d, poligono, normal] = [q, dq, poly, { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }];
      }
    }
  }
  // El borde exacto es ambiguo para dentroPoligono: se empuja 1 px hacia adentro por la normal.
  const dentro = { x: mejor.x + normal.x, y: mejor.y + normal.y };
  return dentroPoligono(dentro, poligono) ? dentro : { x: mejor.x - normal.x, y: mejor.y - normal.y };
}

export const TOLERANCIA_LLEGADA = 6;

/**
 * Un tick de movimiento hacia `destino` con velocidad por eje y deslizamiento sobre bordes.
 * ponytail: línea recta + deslizamiento (§18, pregunta 1). Frente a una huella ancha el
 * personaje se detiene; si hace falta rodear obstáculos, cambiar por A* sobre el polígono.
 */
export function avanzar(pos: Vec, destino: Vec, vx: number, vy: number, dt: number, caminable: (p: Vec) => boolean): Vec {
  const sx = vx * dt, sy = vy * dt;
  const dx = Math.max(-sx, Math.min(sx, destino.x - pos.x));
  const dy = Math.max(-sy, Math.min(sy, destino.y - pos.y));
  const s = Math.sign(dy) || 1;
  const candidatos: [number, number][] = [[dx, dy], [dx, 0], [0, dy], [dx, s * sy], [dx, -s * sy]];
  for (const [ax, ay] of candidatos) {
    if (!ax && !ay) continue;
    const q = { x: pos.x + ax, y: pos.y + ay };
    if (caminable(q)) return q;
  }
  return pos;
}

export const llego = (a: Vec, b: Vec) => dist2(a, b) <= TOLERANCIA_LLEGADA ** 2;
