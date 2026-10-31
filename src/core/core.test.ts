import { expect, test } from 'bun:test';
import contenido from '../../ejemplo/niveles/tortilleria.json' with { type: 'json' };
import { resolverRuta } from './assets';
import { DialogueRuntime, type Escenario } from './dialogo';
import { GameState, leerSave } from './estado';
import { ajustarAlPiso, avanzar, dentroPoligono } from './geometria';
import type { TiledMap } from './mapa';
import { validar } from './validar';

const tmj: TiledMap = await Bun.file(new URL('../../ejemplo/niveles/tortilleria.tmj', import.meta.url)).json();
const copia = () => structuredClone(contenido) as any;

test('el ejemplo de la Tortillería valida y une mapa↔contenido', () => {
  const r = validar({ config: contenido, mapa: tmj, minijuegos: ['Tortilleria'] });
  expect(r.errores).toEqual([]);
  const m = r.nivel!.mundo;
  expect(m.npcs.tortu!.puntoInteraccion).toEqual({ x: 760, y: 470 });
  expect(m.npcs.tortu!.pie).toEqual({ x: 950, y: 420 });
  expect(m.props[0]).toMatchObject({ clase: 'comal', asset: 'comal', pie: { x: 1040, y: 440 }, pisable: false });
  expect(m.ancho).toBe(2400);
});

test('errores de cada fase con mensajes accionables', () => {
  const sinFabrica = validar({ config: contenido, mapa: tmj, minijuegos: [] });
  expect(sinFabrica.errores).toContain('"juego": "Tortilleria" usado en npcs.tortu.dialogo[1].dice[2] pero no registrado en el host');

  const c = copia();
  c.npcs.tortu.dialogo[0].cuando = 'globo';
  c.npcs.tortu.alVolver.siNo = 'no_existe';
  c.npcs.tortu.dialogo[1].dice[0].camina = 'frente_tortileria';
  const r = validar({ config: c, mapa: tmj });
  expect(r.errores).toContain('condición "globo" usada en npcs.tortu.dialogo[0] pero no está en estado.objetivos ni estado.variables');
  expect(r.errores).toContain('secuencia "no_existe" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"');

  const c2 = copia();
  c2.npcs.tortu.dialogo[1].dice[0].camina = 'frente_tortileria';
  expect(validar({ config: c2, mapa: tmj }).errores).toContain('camina "frente_tortileria" en npcs.tortu.dialogo[1].dice[0]: no hay punto con ese nombre');

  const c3 = copia();
  c3.npcs.tito = { dialogo: [] };
  expect(validar({ config: c3, mapa: tmj }).errores).toContain('npcs.tito no tiene objeto de clase npc en la capa "npcs"');

  const c4 = copia();
  c4.npcs.tortu.dialogo[0] = { cuando: 'tengo tortillas' };
  expect(validar({ config: c4, mapa: tmj }).errores[0]).toStartWith('npcs.tortu.dialogo[0].dice:');

  const m = structuredClone(tmj);
  m.layers = m.layers.filter((l) => l.name !== 'piso');
  m.layers.find((l) => l.name === 'decorado')!.objects![0]!.type = 'lámpara';
  const rm = validar({ config: contenido, mapa: m });
  expect(rm.errores).toContain('mapa: falta la capa requerida "piso"');
  expect(rm.errores).toContain('mapa: objeto #20 "comal" en "decorado" tiene clase desconocida "lámpara"');
});

test('modo legacy: sin mapa, layout y coordenadas del JSON', () => {
  const c = copia();
  Object.assign(c.mundo, { ancho: 2000, piso: [405, 505], inicio: 260 });
  c.npcs = [{ id: 'tortu', x: 535, y: 480, radio: 140, dialogo: c.npcs.tortu.dialogo, alVolver: c.npcs.tortu.alVolver }];
  c.layout = [{ tipo: 'cajas', x: [380, 1110, 1600] }];
  c.salida.x = 40;
  c.npcs[0].dialogo[1].dice[0] = { camina: 300 };
  c.comentarios.general[0] = { quien: 'tommy', texto: 'Wow!' };
  const r = validar({ config: c });
  expect(r.errores).toEqual([]);
  expect(r.nivel!.mundo.props).toHaveLength(3);
  expect(r.warnings.some((w) => w.includes('npcs como arreglo'))).toBe(true);
  expect(r.warnings.some((w) => w.includes('"quien" en una línea'))).toBe(true);
  expect(r.nivel!.contenido.comentarios.general![0]!.dice).toBe('tommy');
});

test('condiciones, {faltan} y objetivoCompleto', () => {
  const e = new GameState({ objetivos: ['tortillas', 'aguacates', 'limones'], variables: ['globo'], lista: { tortillas: 'las tortillas', aguacates: 'los aguacates', limones: 'los limones' } });
  const completos: string[] = [];
  e.onObjetivo = (id) => completos.push(id);
  expect(e.interpolar('Faltan {faltan}.')).toBe('Faltan las tortillas, los aguacates y los limones.');
  e.set('tortillas', true);
  e.set('tortillas', true);
  expect(completos).toEqual(['tortillas']);
  expect(e.cumple('tengo tortillas')).toBe(true);
  expect(e.cumple('no tengo limones')).toBe(true);
  expect(e.cumple(['tengo tortillas', 'globo'])).toBe(false);
  expect(e.cumple({ alguno: ['globo', 'tengo tortillas'] })).toBe(true);
  e.aplicar({ aguacates: true, limones: 1 });
  expect(e.cumple('objetivosCompletos')).toBe(true);
});

test('geometría: piso, ajuste y deslizamiento', () => {
  const piso = [{ x: 0, y: 420 }, { x: 2400, y: 420 }, { x: 2400, y: 530 }, { x: 0, y: 530 }];
  const q = ajustarAlPiso({ x: 500, y: 100 }, [piso]);
  expect(q.x).toBeCloseTo(500, 0);
  expect(dentroPoligono(q, piso)).toBe(true);
  // Bloqueado en diagonal por el borde superior: se desliza en x.
  const p = avanzar({ x: 100, y: 421 }, { x: 200, y: 300 }, 240, 110, 0.1, (v) => dentroPoligono(v, piso));
  expect(p).toEqual({ x: 124, y: 421 });
});

test('assets: lista blanca y ".."', () => {
  const root = 'https://assets.pardalis.mx/aventura/';
  const cdn = ['https://assets.pardalis.mx'];
  expect(resolverRuta('spr_tommy', '.webp', root, cdn, 'https://pardalis.mx/')).toBe('https://assets.pardalis.mx/aventura/spr_tommy.webp');
  expect(resolverRuta('voz/a.ogg', '.mp3', root, cdn, 'https://pardalis.mx/')).toBe('https://assets.pardalis.mx/aventura/voz/a.ogg');
  expect(() => resolverRuta('../secreto', '.webp', root, cdn, 'https://pardalis.mx/')).toThrow();
  expect(() => resolverRuta('https://evil.com/x.png', '', root, cdn, 'https://pardalis.mx/')).toThrow();
  expect(() => resolverRuta('x', '.webp', 'http://assets.pardalis.mx/', cdn, 'https://pardalis.mx/')).toThrow();
});

test('save: v1 se migra a v2', () => {
  expect(leerSave('{"v":1,"estado":{"tortillas":true}}', 'tortilleria')).toEqual({ v: 2, nivel: 'tortilleria', estado: { tortillas: true } });
});

test('DialogueRuntime: ramas, charlas, juego → alVolver, ocupado y abort', async () => {
  const { nivel } = validar({ config: contenido, mapa: tmj });
  const c = nivel!.contenido;
  const log: string[] = [];
  let exito = false;
  const esc: Escenario = {
    linea: async (_l, texto) => { log.push(texto); },
    elegir: async () => 0,
    efecto: async (n) => { log.push(`efecto:${n}`); },
    camina: async (_q, d) => { log.push(`camina:${d}`); },
    juego: async () => ({ exito, otorgar: exito ? { tortillas: true } : undefined }),
  };
  const estado = new GameState(c.estado);
  const rt = new DialogueRuntime(c, estado, esc);

  const p = rt.hablar('npcs', 'tortu');
  expect(rt.hablar('npcs', 'tortu')).toBe(false); // ocupado, sin colas
  await p;
  expect(log).toEqual(['camina:frente_tortilleria', '¡Cuidado, el comal está caliente!', '¡Otro día lo intentamos!']);
  expect(estado.get('charlas.tortu')).toBe(true);

  log.length = 0;
  exito = true;
  await rt.hablar('npcs', 'tortu');
  expect(log).toEqual(['camina:frente_tortilleria', '¡Cuidado, el comal está caliente!', 'efecto:magia', 'Thank you!']);

  log.length = 0;
  await rt.hablar('npcs', 'tortu');
  expect(log).toEqual(['¡Que te aprovechen!']);

  // abort libera un paso que nunca termina
  const colgado = new DialogueRuntime(c, new GameState(c.estado), { ...esc, camina: () => new Promise(() => {}) });
  const q = colgado.hablar('npcs', 'tortu');
  colgado.abort();
  await q;
  expect(colgado.activo).toBe(false);
});
