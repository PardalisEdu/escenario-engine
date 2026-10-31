/**
 * MapLoader: convierte un mapa de Tiled (.tmj) en el modelo del mundo (§5).
 *
 * Capas que debe tener el mapa (con estos nombres exactos):
 *   capas        grupo de capas de imagen (fondos y frentes con parallax)
 *   decorado     objetos de imagen: cajas, comal, puesto... (catálogo cerrado)
 *   npcs         un objeto de clase "npc" por personaje
 *   interaccion  inicioJugador, punto, salida, zonaComentario, enfoqueCamara
 *   piso         polígonos de clase "piso": por donde se puede caminar
 *
 * Detalles del formato .tmj que se cuidan aquí:
 *   - La clase de un objeto llega en "type" (Tiled 1.10+) o en "class" (Tiled 1.9).
 *   - Las propiedades llegan como lista [{ name, type, value }] y se convierten en objeto.
 *   - Los objetos de imagen tienen su origen abajo a la izquierda; los demás, arriba a la izquierda.
 *   - El "gid" de un objeto de imagen trae banderas de volteo en sus bits altos.
 *   - Los vértices de un polígono son relativos a la x, y del objeto.
 */
import { Diagnostico } from './diagnostico';
import type { Mira, Punto } from './esquema';
import { cajaDeForma, puntoDePie, type Forma } from './geometria';
import { CATALOGO_DE_DECORADO, mundoVacio, type Mundo } from './mundo';

// ─── Formato .tmj (solo los campos que usa el motor) ────────────────────────

export interface TiledPropiedad {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledObjeto {
  id: number;
  name: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  ellipse?: boolean;
  point?: boolean;
  polygon?: Punto[];
  gid?: number;
  properties?: TiledPropiedad[];
}

export interface TiledCapa {
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  name: string;
  layers?: TiledCapa[];
  objects?: TiledObjeto[];
  image?: string;
  x?: number;
  y?: number;
  offsetx?: number;
  offsety?: number;
  parallaxx?: number;
  properties?: TiledPropiedad[];
}

export interface TiledTile {
  id: number;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  properties?: TiledPropiedad[];
}

export interface TiledTileset {
  firstgid: number;
  /** Si existe, el tileset está en un archivo .tsj aparte. */
  source?: string;
  name?: string;
  tiles?: TiledTile[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledCapa[];
  tilesets?: TiledTileset[];
  properties?: TiledPropiedad[];
}

// ─── Reglas del mapa ─────────────────────────────────────────────────────────

const CAPAS_REQUERIDAS = ['capas', 'decorado', 'npcs', 'interaccion', 'piso'];
const CAPAS_DE_OBJETOS = ['decorado', 'npcs', 'interaccion', 'piso'];

/** En qué capa va cada clase. Las clases de decorado (catálogo) van en "decorado". */
const CAPA_DE_CADA_CLASE: Record<string, string> = {
  npc: 'npcs',
  inicioJugador: 'interaccion',
  punto: 'interaccion',
  salida: 'interaccion',
  zonaComentario: 'interaccion',
  enfoqueCamara: 'interaccion',
  piso: 'piso',
};

type TipoDePropiedad = 'string' | 'int' | 'float' | 'bool' | 'objeto';

const PROPIEDADES_DE_DECORADO: Record<string, TipoDePropiedad> = {
  id: 'string',
  pisable: 'bool',
  profundidad: 'int',
  huella: 'int',
  lona: 'string',
  letrero: 'string',
};

/** Propiedades que acepta cada clase y de qué tipo deben ser. */
const PROPIEDADES_DE_CADA_CLASE: Record<string, Record<string, TipoDePropiedad>> = {
  npc: { id: 'string', mira: 'string', puntoInteraccion: 'objeto', radio: 'int' },
  inicioJugador: { mira: 'string' },
  punto: {},
  salida: { puntoInteraccion: 'objeto', flecha: 'bool' },
  zonaComentario: { grupo: 'string', cooldown: 'int' },
  enfoqueCamara: { orden: 'int', zoom: 'float' },
  piso: {},
};

const RADIO_POR_DEFECTO_DE_NPC_PUNTO = 140;

// Bits del gid de Tiled. Los altos indican volteo; el resto es el id real del tile.
const BIT_VOLTEO_HORIZONTAL = 0x80000000;
const MASCARA_DEL_ID_DE_TILE = 0x0fffffff;

function esDeTipo(valor: unknown, tipo: TipoDePropiedad): boolean {
  switch (tipo) {
    case 'string':
      return typeof valor === 'string';
    case 'bool':
      return typeof valor === 'boolean';
    case 'float':
      return typeof valor === 'number';
    case 'int':
    case 'objeto': // una referencia a objeto es el id numérico del objeto
      return Number.isInteger(valor);
  }
}

/** [{ name: "id", value: "tortu" }] → { id: "tortu" } */
function propiedadesComoObjeto(propiedades: TiledPropiedad[] = []): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  for (const propiedad of propiedades) resultado[propiedad.name] = propiedad.value;
  return resultado;
}

/** Quita la barra final que a veces se escribe para indicar un grupo: "capas/" → "capas". */
function nombreDeCapa(capa: TiledCapa): string {
  return capa.name.replace(/\/$/, '');
}

function claseDe(objeto: TiledObjeto): string {
  return objeto.type || objeto.class || '';
}

function describir(objeto: TiledObjeto): string {
  return `objeto #${objeto.id} "${objeto.name}"`;
}

function leerMira(valor: unknown): Mira {
  return valor === 'izquierda' ? 'izquierda' : 'derecha';
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Reemplaza los tilesets externos (.tsj) por su contenido.
 * `leerArchivo` recibe la ruta tal como viene en el mapa (relativa al mapa).
 */
export async function cargarTilesetsExternos(
  mapa: TiledMap,
  leerArchivo: (ruta: string) => Promise<unknown>,
): Promise<TiledMap> {
  const tilesets: TiledTileset[] = [];
  for (const tileset of mapa.tilesets ?? []) {
    if (tileset.source) {
      const externo = (await leerArchivo(tileset.source)) as TiledTileset;
      tilesets.push({ ...externo, firstgid: tileset.firstgid });
    } else {
      tilesets.push(tileset);
    }
  }
  return { ...mapa, tilesets };
}

/** Lee el mapa y deja los errores y advertencias en `diagnostico`. */
export function leerMapaTiled(mapa: TiledMap, diagnostico: Diagnostico): Mundo {
  if (!mapa || typeof mapa !== 'object' || !Array.isArray(mapa.layers)) {
    diagnostico.error('mapa: el archivo .tmj no es un mapa de Tiled válido (falta "layers")');
    return mundoVacio(0, 0);
  }
  return new LectorDeMapaTiled(mapa, diagnostico).leer();
}

// ─── Lector ──────────────────────────────────────────────────────────────────

interface TileConAsset {
  asset?: string;
  ancho: number;
  alto: number;
  descripcion: string;
}

class LectorDeMapaTiled {
  private readonly mundo: Mundo;
  private readonly tilesPorGid = new Map<number, TileConAsset>();
  private readonly objetosPorId = new Map<number, TiledObjeto>();
  /** Para detectar ids repetidos entre NPCs y props: id → descripción del primer objeto que lo usó. */
  private readonly idsUsados = new Map<string, string>();

  constructor(
    private readonly mapa: TiledMap,
    private readonly diagnostico: Diagnostico,
  ) {
    const propiedades = propiedadesComoObjeto(mapa.properties);
    const anchoCalculado = Number(propiedades.ancho ?? (mapa.width ?? 0) * (mapa.tilewidth ?? 0));
    const altoCalculado = Number(propiedades.alto ?? (mapa.height ?? 0) * (mapa.tileheight ?? 0));
    const ancho = Number.isFinite(anchoCalculado) && anchoCalculado > 0 ? anchoCalculado : 0;
    const alto = Number.isFinite(altoCalculado) && altoCalculado > 0 ? altoCalculado : 0;
    if (ancho <= 0 || alto <= 0) {
      diagnostico.error('mapa: las dimensiones del mapa (ancho y alto) deben ser números positivos');
    }
    this.mundo = mundoVacio(ancho, alto);
  }

  leer(): Mundo {
    this.indexarTiles();
    this.indexarObjetos();
    this.revisarCapas();
    this.leerCapasDeImagen();

    for (const capa of this.mapa.layers) {
      const nombre = nombreDeCapa(capa);
      if (!CAPAS_DE_OBJETOS.includes(nombre)) continue;
      for (const objeto of capa.objects ?? []) {
        this.leerObjeto(objeto, nombre);
      }
    }

    this.mundo.enfoquesDeCamara.sort((a, b) => a.orden - b.orden);
    return this.mundo;
  }

  // ── Preparación ──

  private indexarTiles(): void {
    for (const tileset of this.mapa.tilesets ?? []) {
      const nombreTileset = tileset.name ?? tileset.source ?? String(tileset.firstgid);
      for (const tile of tileset.tiles ?? []) {
        const asset = propiedadesComoObjeto(tile.properties).asset;
        this.tilesPorGid.set(tileset.firstgid + tile.id, {
          asset: typeof asset === 'string' ? asset : undefined,
          ancho: tile.imagewidth ?? 0,
          alto: tile.imageheight ?? 0,
          descripcion: `tileset "${nombreTileset}", tile ${tile.id}`,
        });
      }
    }
  }

  private indexarObjetos(): void {
    for (const capa of this.mapa.layers) {
      for (const objeto of capa.objects ?? []) {
        this.objetosPorId.set(objeto.id, objeto);
      }
    }
  }

  private revisarCapas(): void {
    const nombres = this.mapa.layers.map(nombreDeCapa);
    for (const requerida of CAPAS_REQUERIDAS) {
      if (!nombres.includes(requerida)) {
        this.diagnostico.error(`mapa: falta la capa requerida "${requerida}"`);
      }
    }
    for (const capa of this.mapa.layers) {
      const esConocida = CAPAS_REQUERIDAS.includes(nombreDeCapa(capa));
      const seIgnora = propiedadesComoObjeto(capa.properties).ignorar === true;
      if (!esConocida && !seIgnora) {
        this.diagnostico.advertencia(`mapa: capa desconocida "${capa.name}" (agrega la propiedad ignorar: true si es intencional)`);
      }
    }
  }

  /** Las capas de imagen del grupo "capas". Su orden dentro del grupo define el orden de dibujo. */
  private leerCapasDeImagen(): void {
    const grupo = this.mapa.layers.find((capa) => nombreDeCapa(capa) === 'capas');
    for (const capa of grupo?.layers ?? []) {
      if (capa.type !== 'imagelayer') continue;

      const propiedades = propiedadesComoObjeto(capa.properties);
      if (typeof propiedades.asset !== 'string') {
        this.diagnostico.error(`mapa: capa de imagen "${capa.name}" no tiene la propiedad "asset"`);
        continue;
      }

      // Prioridad: propiedad "parallax", luego el parallax nativo de Tiled, luego 1.
      let parallax = 1;
      if (typeof propiedades.parallax === 'number') parallax = propiedades.parallax;
      else if (capa.parallaxx !== undefined) parallax = capa.parallaxx;

      this.mundo.capas.push({
        asset: propiedades.asset,
        parallax,
        x: (capa.x ?? 0) + (capa.offsetx ?? 0),
        y: (capa.y ?? 0) + (capa.offsety ?? 0),
        alFrente: parallax > 1,
      });
    }
  }

  // ── Objetos ──

  private leerObjeto(objeto: TiledObjeto, capa: string): void {
    let clase = claseDe(objeto);

    if (clase === '' && objeto.gid && capa === 'decorado') {
      this.diagnostico.advertencia(`mapa: ${describir(objeto)} en "decorado" no tiene clase; se trata como deco`);
      clase = 'deco';
    }

    const esDecorado = Object.hasOwn(CATALOGO_DE_DECORADO, clase);
    const propiedadesEsperadas = esDecorado
      ? PROPIEDADES_DE_DECORADO
      : Object.hasOwn(PROPIEDADES_DE_CADA_CLASE, clase)
        ? PROPIEDADES_DE_CADA_CLASE[clase]
        : undefined;
    if (!propiedadesEsperadas) {
      this.diagnostico.error(`mapa: ${describir(objeto)} en "${capa}" tiene clase desconocida "${clase}"`);
      return;
    }

    const capaCorrecta = esDecorado ? 'decorado' : CAPA_DE_CADA_CLASE[clase];
    if (capa !== capaCorrecta) {
      this.diagnostico.error(`mapa: ${describir(objeto)} (${clase}) debe ir en la capa "${capaCorrecta}", no en "${capa}"`);
      return;
    }

    const propiedades = propiedadesComoObjeto(objeto.properties);
    if (!this.propiedadesTienenElTipoCorrecto(objeto, clase, propiedades, propiedadesEsperadas)) return;

    switch (clase) {
      case 'npc':
        return this.leerNpc(objeto, propiedades);
      case 'inicioJugador':
        return this.leerInicioDelJugador(objeto, propiedades);
      case 'punto':
        return this.leerPunto(objeto);
      case 'salida':
        return this.leerSalida(objeto, propiedades);
      case 'zonaComentario':
        return this.leerZonaDeComentario(objeto, propiedades);
      case 'enfoqueCamara':
        return this.leerEnfoqueDeCamara(objeto, propiedades);
      case 'piso':
        return this.leerPiso(objeto);
      default:
        return this.leerProp(objeto, clase, propiedades);
    }
  }

  private propiedadesTienenElTipoCorrecto(
    objeto: TiledObjeto,
    clase: string,
    propiedades: Record<string, unknown>,
    esperadas: Record<string, TipoDePropiedad>,
  ): boolean {
    let todoBien = true;
    for (const [nombre, tipo] of Object.entries(esperadas)) {
      const valor = propiedades[nombre];
      if (valor !== undefined && !esDeTipo(valor, tipo)) {
        this.diagnostico.error(`mapa: ${describir(objeto)} (${clase}): propiedad "${nombre}" debe ser ${tipo}`);
        todoBien = false;
      }
    }
    return todoBien;
  }

  private leerNpc(objeto: TiledObjeto, propiedades: Record<string, unknown>): void {
    const id = propiedades.id;
    if (typeof id !== 'string') {
      this.diagnostico.error(`mapa: ${describir(objeto)} (npc): propiedad "id" debe ser string`);
      return;
    }
    if (!this.registrarId(id, objeto)) return;

    const radio = typeof propiedades.radio === 'number' ? propiedades.radio : RADIO_POR_DEFECTO_DE_NPC_PUNTO;
    const hotspot = this.formaDe(objeto, radio);
    // Un NPC dibujado como punto «pisa» justo en ese punto; si es una forma, en el centro de su borde inferior.
    const pie = objeto.point ? { x: objeto.x, y: objeto.y } : puntoDePie(hotspot);

    this.mundo.npcs[id] = {
      descripcion: describir(objeto),
      puntoDePie: pie,
      hotspot,
      mira: leerMira(propiedades.mira),
      puntoInteraccion: this.puntoReferido(objeto, 'puntoInteraccion', propiedades.puntoInteraccion),
    };
  }

  private leerInicioDelJugador(objeto: TiledObjeto, propiedades: Record<string, unknown>): void {
    this.mundo.iniciosDelJugador.push({
      x: objeto.x,
      y: objeto.y,
      mira: leerMira(propiedades.mira),
      descripcion: describir(objeto),
    });
  }

  /** El nombre del objeto es su identificador (p. ej. "frente_tortilleria"). */
  private leerPunto(objeto: TiledObjeto): void {
    if (this.mundo.puntos[objeto.name]) {
      this.diagnostico.error(`mapa: punto "${objeto.name}" repetido (${describir(objeto)})`);
    }
    this.mundo.puntos[objeto.name] = { x: objeto.x, y: objeto.y };
  }

  private leerSalida(objeto: TiledObjeto, propiedades: Record<string, unknown>): void {
    if (this.mundo.salida) {
      this.diagnostico.error(`mapa: solo puede haber un objeto de clase salida (${this.mundo.salida.descripcion} y ${describir(objeto)})`);
      return;
    }
    const hotspot = this.formaDe(objeto);
    this.mundo.salida = {
      descripcion: describir(objeto),
      puntoDePie: puntoDePie(hotspot),
      hotspot,
      mira: 'derecha',
      puntoInteraccion: this.puntoReferido(objeto, 'puntoInteraccion', propiedades.puntoInteraccion),
      conFlecha: propiedades.flecha !== false,
    };
  }

  private leerZonaDeComentario(objeto: TiledObjeto, propiedades: Record<string, unknown>): void {
    this.mundo.zonasDeComentario.push({
      descripcion: `zonaComentario #${objeto.id}`,
      forma: this.formaDe(objeto),
      grupo: typeof propiedades.grupo === 'string' ? propiedades.grupo : 'general',
      esperaEnSegundos: typeof propiedades.cooldown === 'number' ? propiedades.cooldown : 20,
    });
  }

  private leerEnfoqueDeCamara(objeto: TiledObjeto, propiedades: Record<string, unknown>): void {
    this.mundo.enfoquesDeCamara.push({
      x: objeto.x,
      y: objeto.y,
      orden: typeof propiedades.orden === 'number' ? propiedades.orden : 0,
      zoom: typeof propiedades.zoom === 'number' ? propiedades.zoom : 1,
    });
  }

  private leerPiso(objeto: TiledObjeto): void {
    if (!objeto.polygon || objeto.polygon.length < 3) {
      this.diagnostico.error(`mapa: ${describir(objeto)} (piso) debe ser un polígono`);
      return;
    }
    const vertices = objeto.polygon.map((vertice) => ({ x: objeto.x + vertice.x, y: objeto.y + vertice.y }));
    this.mundo.pisos.push(vertices);
  }

  private leerProp(objeto: TiledObjeto, clase: string, propiedades: Record<string, unknown>): void {
    let tile: TileConAsset | undefined;
    if (objeto.gid) {
      const idDeTile = objeto.gid & MASCARA_DEL_ID_DE_TILE;
      tile = this.tilesPorGid.get(idDeTile);
      if (!tile) {
        this.diagnostico.error(`mapa: ${describir(objeto)}: gid ${idDeTile} no está en ningún tileset`);
        return;
      }
      if (!tile.asset) {
        this.diagnostico.error(`${tile.descripcion}: falta la propiedad "asset"`);
        return;
      }
    }

    const id = typeof propiedades.id === 'string' ? propiedades.id : undefined;
    if (id !== undefined && !this.registrarId(id, objeto)) return;

    const caja = cajaDeForma(this.formaDe(objeto));
    const catalogo = CATALOGO_DE_DECORADO[clase]!;

    this.mundo.props.push({
      descripcion: describir(objeto),
      clase,
      asset: tile?.asset,
      puntoDePie: { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto },
      ancho: caja.ancho || tile?.ancho || 0,
      alto: caja.alto || tile?.alto || 0,
      volteadoHorizontal: objeto.gid !== undefined && (objeto.gid & BIT_VOLTEO_HORIZONTAL) !== 0,
      pisable: typeof propiedades.pisable === 'boolean' ? propiedades.pisable : catalogo.pisablePorDefecto,
      ajusteDeProfundidad: typeof propiedades.profundidad === 'number' ? propiedades.profundidad : 0,
      altoDeHuella: typeof propiedades.huella === 'number' ? propiedades.huella : undefined,
      encima: catalogo.encima,
      id,
      lona: typeof propiedades.lona === 'string' ? propiedades.lona : undefined,
      letrero: typeof propiedades.letrero === 'string' ? propiedades.letrero : undefined,
    });
  }

  // ── Ayudantes ──

  /** Registra un id de NPC o prop. Devuelve false (y reporta el error) si ya estaba usado. */
  private registrarId(id: string, objeto: TiledObjeto): boolean {
    const anterior = this.idsUsados.get(id);
    if (anterior) {
      this.diagnostico.error(`mapa: id "${id}" repetido en ${anterior} y ${describir(objeto)}`);
      return false;
    }
    this.idsUsados.set(id, describir(objeto));
    return true;
  }

  /** La forma de un objeto en coordenadas de mundo. Un punto se convierte en un círculo de `radio`. */
  private formaDe(objeto: TiledObjeto, radio = RADIO_POR_DEFECTO_DE_NPC_PUNTO): Forma {
    if (objeto.polygon) {
      const puntos = objeto.polygon.map((vertice) => ({ x: objeto.x + vertice.x, y: objeto.y + vertice.y }));
      return { tipo: 'poligono', puntos };
    }
    if (objeto.point) {
      return { tipo: 'elipse', x: objeto.x - radio, y: objeto.y - radio, ancho: radio * 2, alto: radio * 2 };
    }
    const ancho = objeto.width ?? 0;
    const alto = objeto.height ?? 0;
    if (objeto.gid) {
      // Los objetos de imagen tienen su origen abajo a la izquierda.
      return { tipo: 'rect', x: objeto.x, y: objeto.y - alto, ancho, alto };
    }
    return { tipo: objeto.ellipse ? 'elipse' : 'rect', x: objeto.x, y: objeto.y, ancho, alto };
  }

  /** Resuelve una propiedad de tipo objeto que debe apuntar a un "punto" de la capa interaccion. */
  private puntoReferido(objeto: TiledObjeto, propiedad: string, idReferido: unknown): Punto | undefined {
    // Tiled guarda 0 cuando la propiedad existe pero no apunta a nada.
    if (idReferido === undefined || idReferido === 0) return undefined;

    const referido = this.objetosPorId.get(idReferido as number);
    if (referido && claseDe(referido) === 'punto') {
      return { x: referido.x, y: referido.y };
    }
    this.diagnostico.error(`mapa: ${describir(objeto)}: "${propiedad}" debe referir a un objeto de clase punto`);
    return undefined;
  }
}
