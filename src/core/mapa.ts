// MapLoader: .tmj de Tiled → modelo de mundo (§5). También construye el mismo modelo desde el JSON legacy (§15).
import type { Contenido, Mira, Vec } from './esquema';
import { cajaForma, pieForma, type Forma } from './geometria';

// --- Formato .tmj (solo lo que leemos) ---

export interface TiledPropiedad { name: string; type: string; value: unknown }
export interface TiledObjeto {
  id: number; name: string; type?: string; class?: string;
  x: number; y: number; width?: number; height?: number;
  ellipse?: boolean; point?: boolean; polygon?: Vec[]; gid?: number;
  properties?: TiledPropiedad[];
}
export interface TiledCapa {
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  name: string; class?: string;
  layers?: TiledCapa[]; objects?: TiledObjeto[];
  image?: string; offsetx?: number; offsety?: number; x?: number; y?: number; parallaxx?: number;
  properties?: TiledPropiedad[];
}
export interface TiledTile { id: number; image?: string; imagewidth?: number; imageheight?: number; properties?: TiledPropiedad[] }
export interface TiledTileset { firstgid: number; source?: string; name?: string; tiles?: TiledTile[] }
export interface TiledMap {
  width: number; height: number; tilewidth: number; tileheight: number;
  layers: TiledCapa[]; tilesets?: TiledTileset[]; properties?: TiledPropiedad[];
}

// --- Modelo del mundo ---

export interface Entidad { ref: string; pie: Vec; hotspot: Forma; mira: Mira; puntoInteraccion?: Vec }
export interface Prop {
  ref: string; clase: string; asset?: string;
  pie: Vec; ancho: number; alto: number; flipX: boolean;
  pisable: boolean; profundidad: number; huella?: number; encima: boolean;
  id?: string; lona?: string; letrero?: string;
}
export interface Capa { asset: string; parallax: number; x: number; y: number; frente: boolean }
export interface Mundo {
  ancho: number; alto: number;
  capas: Capa[];
  props: Prop[];
  npcs: Record<string, Entidad>;
  /** Todas las apariciones de cada id (npc o prop), para detectar duplicados. */
  ids: Record<string, string[]>;
  inicios: (Vec & { mira: Mira; ref: string })[];
  salida?: Entidad & { flecha: boolean };
  zonas: { ref: string; forma: Forma; grupo: string; cooldown: number }[];
  enfoques: { x: number; y: number; orden: number; zoom: number }[];
  puntos: Record<string, Vec>;
  pisos: Vec[][];
}

// Catálogo cerrado de clases de decorado (§5.2, §8.8).
const PROPS: Record<string, { pisable: boolean; encima?: boolean }> = {
  puesto: { pisable: false }, cajas: { pisable: false }, cubetas: { pisable: false },
  perritos: { pisable: false }, comal: { pisable: false }, frutas: { pisable: false },
  carritoGlobos: { pisable: false }, carpa: { pisable: false }, pared: { pisable: false },
  flecha: { pisable: true }, papelPicado: { pisable: true, encima: true }, entrada: { pisable: true },
  techo: { pisable: true, encima: true }, deco: { pisable: true },
};
export const CLASES_PROP = Object.keys(PROPS);

type TipoProp = 'string' | 'int' | 'float' | 'bool' | 'object';
const PROPS_CLASE: Record<string, Record<string, TipoProp>> = {
  npc: { id: 'string', mira: 'string', puntoInteraccion: 'object', radio: 'int' },
  inicioJugador: { mira: 'string' },
  punto: {},
  salida: { puntoInteraccion: 'object', flecha: 'bool' },
  zonaComentario: { grupo: 'string', cooldown: 'int' },
  enfoqueCamara: { orden: 'int', zoom: 'float' },
  piso: {},
  puesto: { lona: 'string', letrero: 'string', pisable: 'bool', id: 'string', profundidad: 'int', huella: 'int' },
  ...Object.fromEntries(CLASES_PROP.filter((c) => c !== 'puesto').map((c) => [c, { pisable: 'bool', profundidad: 'int', huella: 'int', id: 'string' }])),
};
const CAPA_DE: Record<string, string> = {
  npc: 'npcs', inicioJugador: 'interaccion', punto: 'interaccion', salida: 'interaccion',
  zonaComentario: 'interaccion', enfoqueCamara: 'interaccion', piso: 'piso',
};
const CAPAS_REQUERIDAS = ['capas', 'decorado', 'npcs', 'interaccion', 'piso'];

const tipoOk = (t: TipoProp, v: unknown) =>
  t === 'string' ? typeof v === 'string' : t === 'bool' ? typeof v === 'boolean'
    : t === 'int' || t === 'object' ? Number.isInteger(v) : typeof v === 'number';

const MASCARA_GID = 0x0fffffff;
const FLIP_H = 0x80000000;

const mundoVacio = (ancho: number, alto: number): Mundo => ({
  ancho, alto, capas: [], props: [], npcs: {}, ids: {}, inicios: [], zonas: [], enfoques: [], puntos: {}, pisos: [],
});

const normalizarProps = (props?: TiledPropiedad[]) => Object.fromEntries((props ?? []).map((p) => [p.name, p.value]));

/** Carga tilesets externos (.tsj) relativos a la URL del mapa. */
export async function resolverTilesets(mapa: TiledMap, leer: (ruta: string) => Promise<unknown>): Promise<TiledMap> {
  const tilesets = await Promise.all((mapa.tilesets ?? []).map(async (ts) =>
    ts.source ? { ...(await leer(ts.source) as TiledTileset), firstgid: ts.firstgid } : ts));
  return { ...mapa, tilesets };
}

export interface Lectura { mundo: Mundo; errores: string[]; warnings: string[] }

export function leerMapa(mapa: TiledMap): Lectura {
  const errores: string[] = [], warnings: string[] = [];
  const mp = normalizarProps(mapa.properties);
  const m = mundoVacio(
    Number(mp.ancho ?? mapa.width * mapa.tilewidth),
    Number(mp.alto ?? mapa.height * mapa.tileheight),
  );

  // gid → tile
  const tiles = new Map<number, { asset?: string; w: number; h: number; ref: string }>();
  for (const ts of mapa.tilesets ?? []) {
    for (const t of ts.tiles ?? []) {
      const asset = normalizarProps(t.properties).asset;
      tiles.set(ts.firstgid + t.id, {
        asset: typeof asset === 'string' ? asset : undefined,
        w: t.imagewidth ?? 0, h: t.imageheight ?? 0,
        ref: `tileset "${ts.name ?? ts.source ?? ts.firstgid}", tile ${t.id}`,
      });
    }
  }

  const porNombre = new Map(mapa.layers.map((c) => [c.name.replace(/\/$/, ''), c]));
  for (const req of CAPAS_REQUERIDAS) if (!porNombre.has(req)) errores.push(`mapa: falta la capa requerida "${req}"`);
  for (const c of mapa.layers) {
    if (!CAPAS_REQUERIDAS.includes(c.name.replace(/\/$/, '')) && normalizarProps(c.properties).ignorar !== true) {
      warnings.push(`mapa: capa desconocida "${c.name}" (agrega la propiedad ignorar: true si es intencional)`);
    }
  }

  // capas/ — capas de imagen con parallax; el orden define la profundidad.
  for (const c of porNombre.get('capas')?.layers ?? []) {
    if (c.type !== 'imagelayer') continue;
    const p = normalizarProps(c.properties);
    if (typeof p.asset !== 'string') { errores.push(`mapa: capa de imagen "${c.name}" no tiene la propiedad "asset"`); continue; }
    const parallax = typeof p.parallax === 'number' ? p.parallax : c.parallaxx ?? 1;
    m.capas.push({ asset: p.asset, parallax, x: (c.x ?? 0) + (c.offsetx ?? 0), y: (c.y ?? 0) + (c.offsety ?? 0), frente: parallax > 1 });
  }

  const objetos = new Map<number, TiledObjeto>();
  for (const c of mapa.layers) for (const o of c.objects ?? []) objetos.set(o.id, o);
  const refDe = (o: TiledObjeto) => `objeto #${o.id} "${o.name}"`;
  const punto = (o: TiledObjeto, prop: string, valor: unknown): Vec | undefined => {
    if (valor === undefined || valor === 0) return undefined;
    const p = objetos.get(valor as number);
    if (p && (p.type || p.class) === 'punto') return { x: p.x, y: p.y };
    errores.push(`mapa: ${refDe(o)}: "${prop}" debe referir a un objeto de clase punto`);
  };
  const formaDe = (o: TiledObjeto, radio = 140): Forma => {
    if (o.polygon) return { tipo: 'poligono', puntos: o.polygon.map((v) => ({ x: o.x + v.x, y: o.y + v.y })) };
    if (o.point) return { tipo: 'elipse', x: o.x - radio, y: o.y - radio, w: radio * 2, h: radio * 2 };
    if (o.gid) return { tipo: 'rect', x: o.x, y: o.y - (o.height ?? 0), w: o.width ?? 0, h: o.height ?? 0 };
    return { tipo: o.ellipse ? 'elipse' : 'rect', x: o.x, y: o.y, w: o.width ?? 0, h: o.height ?? 0 };
  };
  const registrarId = (id: string, o: TiledObjeto) => (m.ids[id] ??= []).push(`#${o.id}`);

  for (const capa of ['decorado', 'npcs', 'interaccion', 'piso']) {
    for (const o of porNombre.get(capa)?.objects ?? []) {
      let clase = o.type || o.class || '';
      const ref = refDe(o);
      if (!clase && o.gid && capa === 'decorado') {
        warnings.push(`mapa: ${ref} en "decorado" no tiene clase; se trata como deco`);
        clase = 'deco';
      }
      const esperadas = PROPS_CLASE[clase];
      if (!esperadas) { errores.push(`mapa: ${ref} en "${capa}" tiene clase desconocida "${clase}"`); continue; }
      if ((CAPA_DE[clase] ?? 'decorado') !== capa) { errores.push(`mapa: ${ref} (${clase}) debe ir en la capa "${CAPA_DE[clase] ?? 'decorado'}", no en "${capa}"`); continue; }
      const p = normalizarProps(o.properties);
      let ok = true;
      for (const [k, t] of Object.entries(esperadas)) {
        if (p[k] !== undefined && !tipoOk(t, p[k])) { errores.push(`mapa: ${ref} (${clase}): propiedad "${k}" debe ser ${t}`); ok = false; }
      }
      if (!ok) continue;
      const mira: Mira = p.mira === 'izquierda' ? 'izquierda' : 'derecha';

      switch (clase) {
        case 'npc': {
          if (typeof p.id !== 'string') { errores.push(`mapa: ${ref} (npc): propiedad "id" debe ser string`); break; }
          registrarId(p.id, o);
          const hotspot = formaDe(o, (p.radio as number) ?? 140);
          m.npcs[p.id] ??= { ref, pie: o.point ? { x: o.x, y: o.y } : pieForma(hotspot), hotspot, mira, puntoInteraccion: punto(o, 'puntoInteraccion', p.puntoInteraccion) };
          break;
        }
        case 'inicioJugador': m.inicios.push({ x: o.x, y: o.y, mira, ref }); break;
        case 'punto':
          if (m.puntos[o.name]) errores.push(`mapa: punto "${o.name}" repetido (${ref})`);
          m.puntos[o.name] = { x: o.x, y: o.y };
          break;
        case 'salida': {
          const hotspot = formaDe(o);
          m.salida = { ref, pie: pieForma(hotspot), hotspot, mira, puntoInteraccion: punto(o, 'puntoInteraccion', p.puntoInteraccion), flecha: p.flecha !== false };
          break;
        }
        case 'zonaComentario':
          m.zonas.push({ ref, forma: formaDe(o), grupo: (p.grupo as string) ?? 'general', cooldown: (p.cooldown as number) ?? 20 });
          break;
        case 'enfoqueCamara': m.enfoques.push({ x: o.x, y: o.y, orden: (p.orden as number) ?? 0, zoom: (p.zoom as number) ?? 1 }); break;
        case 'piso':
          if (!o.polygon || o.polygon.length < 3) errores.push(`mapa: ${ref} (piso) debe ser un polígono`);
          else m.pisos.push(o.polygon.map((v) => ({ x: o.x + v.x, y: o.y + v.y })));
          break;
        default: { // decorado
          const tile = o.gid ? tiles.get(o.gid & MASCARA_GID) : undefined;
          if (o.gid && !tile) { errores.push(`mapa: ${ref}: gid ${o.gid & MASCARA_GID} no está en ningún tileset`); break; }
          if (tile && !tile.asset) { errores.push(`${tile.ref}: falta la propiedad "asset"`); break; }
          if (typeof p.id === 'string') registrarId(p.id, o);
          const caja = cajaForma(formaDe(o));
          m.props.push({
            ref, clase, asset: tile?.asset,
            pie: { x: caja.x + caja.w / 2, y: caja.y + caja.h },
            ancho: caja.w || tile?.w || 0, alto: caja.h || tile?.h || 0,
            flipX: !!o.gid && (o.gid & FLIP_H) !== 0,
            pisable: (p.pisable as boolean) ?? PROPS[clase]!.pisable,
            profundidad: (p.profundidad as number) ?? 0,
            huella: p.huella as number | undefined,
            encima: !!PROPS[clase]!.encima,
            id: p.id as string | undefined, lona: p.lona as string | undefined, letrero: p.letrero as string | undefined,
          });
        }
      }
    }
  }
  m.enfoques.sort((a, b) => a.orden - b.orden);
  return { mundo: m, errores, warnings };
}

/** Modo sin mapa: el mundo sale de layout/mundo/coordenadas del JSON, como en v1. */
export function mundoLegacy(c: Contenido): Lectura {
  const errores: string[] = [], warnings: string[] = [];
  const [lw, lh] = c.mundo.logico;
  const m = mundoVacio(c.mundo.ancho ?? lw, c.mundo.alto ?? lh);
  const [y1, y2] = c.mundo.piso ?? [lh * 0.6, lh * 0.75];
  const medio = (y1 + y2) / 2;
  m.pisos.push([{ x: 0, y: y1 }, { x: m.ancho, y: y1 }, { x: m.ancho, y: y2 }, { x: 0, y: y2 }]);
  m.inicios.push({ x: c.mundo.inicio ?? 200, y: medio, mira: 'derecha', ref: 'mundo.inicio' });
  // La profundidad legacy (depth) se respeta como orden; depth > 0 va al frente.
  const capas = [...(c.mundo.capas ?? [])].sort((a, b) => a.depth - b.depth);
  m.capas = capas.map((k) => ({ asset: k.asset, parallax: k.parallax, x: 0, y: 0, frente: k.depth > 0 }));

  const agregarLayout = (items: { tipo: string; [k: string]: unknown }[], base: string) => items.forEach((it, i) => {
    const cat = PROPS[it.tipo];
    if (!cat) { errores.push(`${base}[${i}]: tipo desconocido "${it.tipo}"`); return; }
    const xs = Array.isArray(it.x) ? it.x as number[] : [Number(it.x ?? 0)];
    for (const x of xs) {
      m.props.push({
        ref: `${base}[${i}]`, clase: it.tipo, asset: (it.asset as string) ?? (it.tipo === 'puesto' ? undefined : it.tipo),
        pie: { x, y: Number(it.y ?? y1) }, ancho: Number(it.ancho ?? 0), alto: Number(it.alto ?? 0), flipX: false,
        pisable: (it.pisable as boolean) ?? cat.pisable, profundidad: Number(it.profundidad ?? 0),
        huella: it.huella as number | undefined, encima: !!cat.encima,
        id: it.id as string | undefined, lona: it.lona as string | undefined, letrero: it.letrero as string | undefined,
      });
      if (typeof it.id === 'string') (m.ids[it.id] ??= []).push(`${base}[${i}]`);
    }
  });
  agregarLayout(c.layout ?? [], 'layout');

  for (const [id, n] of Object.entries(c.npcs)) {
    if (n.x === undefined) continue;
    const y = n.y ?? medio;
    const r = n.radio ?? 140;
    const hotspot: Forma = n.forma
      ? { tipo: 'rect', x: n.x - n.forma.w / 2, y: y - n.forma.h, w: n.forma.w, h: n.forma.h }
      : { tipo: 'elipse', x: n.x - r, y: y - r, w: r * 2, h: r * 2 };
    m.npcs[id] = { ref: `npcs.${id}`, pie: { x: n.x, y }, hotspot, mira: 'izquierda' };
    (m.ids[id] ??= []).push(`npcs.${id}`);
    agregarLayout(n.props ?? [], `npcs.${id}.props`);
  }
  if (c.salida?.x !== undefined) {
    const x = c.salida.x;
    m.salida = { ref: 'salida', pie: { x, y: y2 }, hotspot: { tipo: 'rect', x: x - 60, y: y1 - 150, w: 120, h: y2 - y1 + 150 }, mira: 'derecha', puntoInteraccion: { x, y: medio }, flecha: true };
  }
  for (const [i, e] of (c.mundo.camara.enfoques ?? []).entries()) m.enfoques.push({ x: e.x, y: e.y ?? m.alto / 2, orden: i, zoom: e.zoom ?? 1 });
  return { mundo: m, errores, warnings };
}
