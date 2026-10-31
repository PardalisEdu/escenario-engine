/**
 * Compatibilidad con el formato v1 (§15).
 *
 * Dos trabajos:
 * 1. `normalizarFormatoViejo`: antes de validar, convierte formas viejas del JSON a la forma 2.0
 *    y deja una advertencia de deprecación por cada una.
 * 2. `construirMundoSinMapa`: cuando no hay mapa de Tiled, arma el modelo del mundo con las
 *    coordenadas escritas en el JSON (layout, mundo.piso, x/y de los NPCs, salida.x...).
 */
import type { Diagnostico } from './diagnostico';
import type { Contenido, ElementoLayout } from './esquema';
import type { Forma } from './geometria';
import { CATALOGO_DE_DECORADO, mundoVacio, type Mundo } from './mundo';

type ObjetoJson = Record<string, unknown>;

function esObjeto(valor: unknown): valor is ObjetoJson {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Modifica `json` en el lugar. Formas viejas que se aceptan:
 * - "npcs" como arreglo con "id" en cada NPC     → objeto indexado por id
 * - "camara.margen"                              → "camara.zonaMuerta"
 * - "quien" como hablante de una línea           → "dice"
 */
export function normalizarFormatoViejo(json: ObjetoJson, diagnostico: Diagnostico): void {
  if (Array.isArray(json.npcs)) {
    diagnostico.advertencia('npcs como arreglo está deprecado; usa un objeto indexado por id');
    const porId: ObjetoJson = {};
    for (const npc of json.npcs) {
      if (esObjeto(npc)) porId[String(npc.id)] = npc;
    }
    json.npcs = porId;
  }

  const mundo = json.mundo;
  if (esObjeto(mundo) && esObjeto(mundo.camara) && mundo.camara.margen !== undefined) {
    diagnostico.advertencia('mundo.camara.margen está deprecado; usa zonaMuerta');
    mundo.camara.zonaMuerta ??= mundo.camara.margen;
    delete mundo.camara.margen;
  }

  renombrarQuienEnLineas(json, '', diagnostico);
}

/** En v1 el hablante de una línea se escribía "quien"; hoy es "dice". Recorre todo el JSON. */
function renombrarQuienEnLineas(valor: unknown, ruta: string, diagnostico: Diagnostico): void {
  if (Array.isArray(valor)) {
    valor.forEach((elemento, i) => renombrarQuienEnLineas(elemento, `${ruta}[${i}]`, diagnostico));
    return;
  }
  if (!esObjeto(valor)) return;

  // Es una línea vieja si trae "quien" y "texto", y no es un paso "camina" (donde "quien" sí es válido).
  const esLineaVieja = typeof valor.quien === 'string' && 'texto' in valor && !('dice' in valor) && !('camina' in valor);
  if (esLineaVieja) {
    diagnostico.advertencia(`${ruta}: "quien" en una línea está deprecado; usa "dice"`);
    valor.dice = valor.quien;
    delete valor.quien;
  }

  for (const [clave, hijo] of Object.entries(valor)) {
    renombrarQuienEnLineas(hijo, ruta === '' ? clave : `${ruta}.${clave}`, diagnostico);
  }
}

/** Arma el mundo con las coordenadas del JSON v1. */
export function construirMundoSinMapa(contenido: Contenido, diagnostico: Diagnostico): Mundo {
  const [anchoLogico, altoLogico] = contenido.mundo.logico;
  const mundo = mundoVacio(contenido.mundo.ancho ?? anchoLogico, contenido.mundo.alto ?? altoLogico);

  // mundo.piso: [y de arriba, y de abajo] de la banda caminable. Se vuelve un rectángulo a todo lo ancho.
  const [pisoArriba, pisoAbajo] = contenido.mundo.piso ?? [altoLogico * 0.6, altoLogico * 0.75];
  const mitadDelPiso = (pisoArriba + pisoAbajo) / 2;
  mundo.pisos.push([
    { x: 0, y: pisoArriba },
    { x: mundo.ancho, y: pisoArriba },
    { x: mundo.ancho, y: pisoAbajo },
    { x: 0, y: pisoAbajo },
  ]);

  mundo.iniciosDelJugador.push({ x: contenido.mundo.inicio ?? 200, y: mitadDelPiso, mira: 'derecha', descripcion: 'mundo.inicio' });

  // En v1 el orden lo daba "depth". Una capa con depth mayor que 0 iba delante de los personajes.
  const capasOrdenadas = [...(contenido.mundo.capas ?? [])].sort((a, b) => a.depth - b.depth);
  for (const capa of capasOrdenadas) {
    mundo.capas.push({ asset: capa.asset, parallax: capa.parallax, x: 0, y: 0, alFrente: capa.depth > 0 });
  }

  const idsUsados = new Set<string>();
  const agregarLayout = (elementos: ElementoLayout[], ruta: string) =>
    agregarElementosDeLayout(mundo, elementos, ruta, pisoArriba, idsUsados, diagnostico);

  agregarLayout(contenido.layout ?? [], 'layout');

  for (const [id, npc] of Object.entries(contenido.npcs)) {
    if (npc.x === undefined) continue; // la validación cruzada reportará que le faltan coordenadas
    const y = npc.y ?? mitadDelPiso;
    const radio = npc.radio ?? 140;
    let hotspot: Forma;
    if (npc.forma) {
      hotspot = { tipo: 'rect', x: npc.x - npc.forma.w / 2, y: y - npc.forma.h, ancho: npc.forma.w, alto: npc.forma.h };
    } else {
      hotspot = { tipo: 'elipse', x: npc.x - radio, y: y - radio, ancho: radio * 2, alto: radio * 2 };
    }
    mundo.npcs[id] = { descripcion: `npcs.${id}`, puntoDePie: { x: npc.x, y }, hotspot, mira: 'izquierda' };
    idsUsados.add(id);
    agregarLayout(npc.props ?? [], `npcs.${id}.props`);
  }

  const salidaX = contenido.salida?.x;
  if (salidaX !== undefined) {
    mundo.salida = {
      descripcion: 'salida',
      puntoDePie: { x: salidaX, y: pisoAbajo },
      hotspot: { tipo: 'rect', x: salidaX - 60, y: pisoArriba - 150, ancho: 120, alto: pisoAbajo - pisoArriba + 150 },
      mira: 'derecha',
      puntoInteraccion: { x: salidaX, y: mitadDelPiso },
      conFlecha: true,
    };
  }

  const enfoques = contenido.mundo.camara.enfoques ?? [];
  enfoques.forEach((enfoque, orden) => {
    mundo.enfoquesDeCamara.push({ x: enfoque.x, y: enfoque.y ?? mundo.alto / 2, orden, zoom: enfoque.zoom ?? 1 });
  });

  return mundo;
}

/**
 * Agrega los props de un "layout" v1. Ejemplo: { "tipo": "cajas", "x": [380, 1110, 1600] }
 * crea tres cajas apoyadas en el borde de arriba del piso.
 */
function agregarElementosDeLayout(
  mundo: Mundo,
  elementos: ElementoLayout[],
  ruta: string,
  yPorDefecto: number,
  idsUsados: Set<string>,
  diagnostico: Diagnostico,
): void {
  elementos.forEach((elemento, i) => {
    const descripcion = `${ruta}[${i}]`;
    const catalogo = Object.hasOwn(CATALOGO_DE_DECORADO, elemento.tipo) ? CATALOGO_DE_DECORADO[elemento.tipo] : undefined;
    if (!catalogo) {
      diagnostico.error(`${descripcion}: tipo desconocido "${elemento.tipo}"`);
      return;
    }

    const id = typeof elemento.id === 'string' ? elemento.id : undefined;
    if (id !== undefined) {
      if (idsUsados.has(id)) diagnostico.error(`${descripcion}: id "${id}" repetido`);
      idsUsados.add(id);
    }

    const posicionesX = Array.isArray(elemento.x) ? (elemento.x as number[]) : [Number(elemento.x ?? 0)];
    // Sin "asset", la imagen se llama como el tipo ("cajas"). El puesto sin imagen se dibuja con figuras.
    const assetPorDefecto = elemento.tipo === 'puesto' ? undefined : elemento.tipo;

    for (const x of posicionesX) {
      mundo.props.push({
        descripcion,
        clase: elemento.tipo,
        asset: typeof elemento.asset === 'string' ? elemento.asset : assetPorDefecto,
        puntoDePie: { x, y: Number(elemento.y ?? yPorDefecto) },
        ancho: Number(elemento.ancho ?? 0),
        alto: Number(elemento.alto ?? 0),
        volteadoHorizontal: false,
        pisable: typeof elemento.pisable === 'boolean' ? elemento.pisable : catalogo.pisablePorDefecto,
        ajusteDeProfundidad: Number(elemento.profundidad ?? 0),
        altoDeHuella: typeof elemento.huella === 'number' ? elemento.huella : undefined,
        encima: catalogo.encima,
        id,
        lona: typeof elemento.lona === 'string' ? elemento.lona : undefined,
        letrero: typeof elemento.letrero === 'string' ? elemento.letrero : undefined,
      });
    }
  });
}
