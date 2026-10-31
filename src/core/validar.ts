// Validación (§12): parse → schema → link-semántico → cruce mapa↔contenido. La fase build ocurre al cargar assets.
// Puro: corre en el navegador y en CI (ver src/cli.ts).
import { clavePaso, contenido as esquemaContenido, rutaZod, type Condicion, type Contenido, type Opcion, type Paso } from './esquema';
import { declarado, referencias } from './estado';
import { dentroPoligono } from './geometria';
import { leerMapa, mundoLegacy, type Mundo, type TiledMap } from './mapa';

/** Tabla global de efectos; el adaptador de Phaser implementa cada uno. */
export const EFECTOS = ['magia', 'confeti'] as const;

export interface Nivel { contenido: Contenido; mundo: Mundo }
export interface Validacion { errores: string[]; warnings: string[]; nivel?: Nivel }

export class EscenarioError extends Error {
  constructor(public errores: string[], public warnings: string[] = []) {
    super(`escenario-engine: ${errores.length} error(es) de validación\n  - ${errores.join('\n  - ')}`);
  }
}

/** Convierte formas v1 aceptadas a la forma 2.0, con warning de deprecación (§15). */
function normalizarLegacy(raw: Record<string, unknown>, warnings: string[]) {
  if (Array.isArray(raw.npcs)) {
    warnings.push('npcs como arreglo está deprecado; usa un objeto indexado por id');
    raw.npcs = Object.fromEntries(raw.npcs.map((n: { id: string }) => [n.id, n]));
  }
  const camara = (raw.mundo as { camara?: Record<string, unknown> } | undefined)?.camara;
  if (camara?.margen !== undefined) {
    warnings.push('mundo.camara.margen está deprecado; usa zonaMuerta');
    camara.zonaMuerta ??= camara.margen;
    delete camara.margen;
  }
  // "quien" en una línea era el hablante en v1 (hoy "dice").
  const walk = (v: unknown, ruta: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${ruta}[${i}]`));
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    if (typeof o.quien === 'string' && 'texto' in o && !('dice' in o) && !('camina' in o)) {
      warnings.push(`${ruta}: "quien" en una línea está deprecado; usa "dice"`);
      o.dice = o.quien;
      delete o.quien;
    }
    for (const [k, x] of Object.entries(o)) walk(x, ruta ? `${ruta}.${k}` : k);
  };
  walk(raw, '');
}

export function validar(entrada: { config: unknown; mapa?: TiledMap; minijuegos?: string[] }): Validacion {
  const errores: string[] = [], warnings: string[] = [];
  const fin = (): Validacion => ({ errores, warnings });

  // 1 · parse
  let raw: unknown = entrada.config;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { errores.push(`parse: contenido JSON inválido: ${(e as Error).message}`); return fin(); }
  }
  if (!raw || typeof raw !== 'object') { errores.push('parse: el contenido debe ser un objeto JSON'); return fin(); }
  raw = structuredClone(raw);
  normalizarLegacy(raw as Record<string, unknown>, warnings);

  // 2 · schema (contenido + mapa)
  const r = esquemaContenido.safeParse(raw);
  if (!r.success) {
    for (const i of r.error.issues) errores.push(`${rutaZod(i.path) || '(raíz)'}: ${i.message}`);
    return fin();
  }
  const c = r.data;
  const lectura = entrada.mapa ? leerMapa(entrada.mapa) : mundoLegacy(c);
  errores.push(...lectura.errores);
  warnings.push(...lectura.warnings);
  const m = lectura.mundo;
  if (errores.length) return fin();

  // 3 · link-semántico
  const cond = (x: Condicion | undefined, ruta: string) => {
    if (x === undefined) return;
    for (const ref of referencias(x)) {
      if (!declarado(ref, c.estado)) errores.push(`condición "${ref}" usada en ${ruta} pero no está en estado.objetivos ni estado.variables`);
    }
  };
  const caminas: { destino: string | number | object; quien?: string; ruta: string }[] = [];

  const visitarPasos = (pasos: Paso[], ruta: string) => pasos.forEach((p, i) => visitar(p, `${ruta}[${i}]`));
  const visitarRef = (x: Paso[] | string, ruta: string) => {
    if (typeof x !== 'string') return visitarPasos(x, ruta);
    if (!c.secuencias[x]) errores.push(`secuencia "${x}" usada en ${ruta} pero no existe en "secuencias"`);
  };
  const visitar = (p: Paso, ruta: string): void => {
    const q = p as any;
    switch (clavePaso(p)) {
      case 'cuando': cond(q.cuando, ruta); visitarPasos(q.dice, `${ruta}.dice`); break;
      case 'elige': {
        const ops = q.opciones as Opcion[];
        ops.forEach((o, i) => { cond(o.cuando, `${ruta}.opciones[${i}]`); visitarRef(o.secuencia, `${ruta}.opciones[${i}].secuencia`); });
        if (ops.every((o) => o.cuando !== undefined)) warnings.push(`${ruta}: todas las opciones de elige tienen condición; si ninguna se cumple, el paso se salta`);
        break;
      }
      case 'juego':
        if (entrada.minijuegos && !entrada.minijuegos.includes(q.juego)) errores.push(`"juego": "${q.juego}" usado en ${ruta} pero no registrado en el host`);
        break;
      case 'camina':
        if (typeof q.camina === 'number') warnings.push(`${ruta}: camina numérico está deprecado; usa { x, y } o un punto con nombre`);
        caminas.push({ destino: q.camina, quien: q.quien, ruta });
        break;
      case 'secuencia': visitarRef(q.secuencia, ruta); break;
      case 'efecto':
        if (!(EFECTOS as readonly string[]).includes(q.efecto)) errores.push(`efecto "${q.efecto}" en ${ruta} no está en la tabla global de efectos (${EFECTOS.join(', ')})`);
        break;
      case 'pon':
        for (const k of Object.keys(q.pon)) if (!declarado(k, c.estado)) errores.push(`"pon" de "${k}" en ${ruta} pero no está en estado.objetivos ni estado.variables`);
        break;
      case 'dice':
        if (!c.meta.personajes[q.dice]) errores.push(`${ruta}: el hablante "${q.dice}" no existe en meta.personajes`);
        break;
    }
  };

  if (c.jugador && !c.meta.personajes[c.jugador.personaje]) errores.push(`jugador.personaje "${c.jugador.personaje}" no existe en meta.personajes`);
  for (const [nombre, pasos] of Object.entries(c.secuencias)) visitarPasos(pasos, `secuencias.${nombre}`);
  for (const tipo of ['npcs', 'interactivos'] as const) {
    for (const [id, n] of Object.entries(c[tipo])) {
      const base = `${tipo}.${id}`;
      let sinCondicion = false;
      n.dialogo.forEach((rama, i) => {
        if (sinCondicion) warnings.push(`${base}.dialogo[${i}]: rama inalcanzable, hay una rama sin condición antes`);
        if (rama.cuando === undefined) sinCondicion = true;
        cond(rama.cuando, `${base}.dialogo[${i}]`);
        visitarPasos(rama.dice, `${base}.dialogo[${i}].dice`);
      });
      if (n.alVolver) {
        cond([n.alVolver.conItem].flat(), `${base}.alVolver.conItem`);
        visitarRef(n.alVolver.siLogrado, `${base}.alVolver.siLogrado`);
        visitarRef(n.alVolver.siNo, `${base}.alVolver.siNo`);
      }
    }
  }
  for (const [g, lineas] of Object.entries(c.comentarios)) visitarPasos(lineas, `comentarios.${g}`);
  if (c.salida) {
    cond(c.salida.requiere, 'salida.requiere');
    cond(c.salida.flecha?.visibleCuando, 'salida.flecha.visibleCuando');
    if (c.salida.siBloqueada) visitarRef(c.salida.siBloqueada, 'salida.siBloqueada');
  }
  if (errores.length) return fin();

  // 4 · cruce mapa↔contenido
  const enMapa = entrada.mapa ? 'mapa' : 'contenido (modo sin mapa)';
  for (const [id, apariciones] of Object.entries(m.ids)) {
    if (apariciones.length > 1) errores.push(`mapa: id "${id}" repetido en objetos ${apariciones.join(' y ')}`);
  }
  for (const [id, e] of Object.entries(m.npcs)) {
    if (!c.npcs[id]) errores.push(`mapa: ${e.ref} (npc) tiene id "${id}", que no existe en npcs`);
  }
  for (const id of Object.keys(c.npcs)) {
    if (!m.npcs[id]) errores.push(entrada.mapa ? `npcs.${id} no tiene objeto de clase npc en la capa "npcs"` : `npcs.${id} no tiene coordenadas x, y`);
  }
  const propsConId = new Map(m.props.filter((p) => p.id).map((p) => [p.id!, p]));
  for (const [id, p] of propsConId) if (!c.interactivos[id]) errores.push(`mapa: ${p.ref} (${p.clase}) tiene id "${id}", que no existe en interactivos`);
  for (const id of Object.keys(c.interactivos)) if (!propsConId.has(id)) errores.push(`interactivos.${id} no tiene un objeto de decorado con ese id en el ${enMapa}`);

  if (!m.pisos.length) errores.push('mapa: la capa "piso" necesita al menos un polígono de clase piso');
  if (m.inicios.length !== 1 || !m.pisos.some((poly) => dentroPoligono(m.inicios[0]!, poly))) {
    errores.push('mapa: inicioJugador debe existir una sola vez y estar dentro de un polígono "piso"');
  }
  for (const z of m.zonas) if (!c.comentarios[z.grupo]) errores.push(`${z.ref.replace('objeto ', 'zonaComentario ')}: grupo "${z.grupo}" no existe en comentarios`);
  if (c.salida && !m.salida) errores.push(entrada.mapa ? 'salida: falta el objeto de clase salida en la capa "interaccion"' : 'salida: falta salida.x');
  if (!c.salida && m.salida) warnings.push(`${m.salida.ref}: hay salida en el mapa pero no "salida" en el contenido`);

  const actores = new Set([...(c.jugador ? [c.jugador.personaje] : []), ...Object.keys(m.npcs)]);
  for (const k of caminas) {
    if (k.quien === undefined && !c.jugador) errores.push(`camina en ${k.ruta}: no hay jugador; indica "quien"`);
    if (k.quien !== undefined && !actores.has(k.quien)) errores.push(`camina en ${k.ruta}: "quien": "${k.quien}" no es el jugador ni un NPC del mapa`);
    if (typeof k.destino === 'string' && !m.puntos[k.destino]) errores.push(`camina "${k.destino}" en ${k.ruta}: no hay punto con ese nombre`);
  }

  if (entrada.mapa) {
    const dup = (cond: unknown, que: string) => cond && warnings.push(`dato duplicado: ${que} se ignora porque manda el mapa`);
    dup(c.layout, 'layout');
    dup(c.mundo.capas, 'mundo.capas');
    dup(c.mundo.piso, 'mundo.piso');
    dup(c.mundo.inicio !== undefined, 'mundo.inicio');
    dup(c.mundo.camara.enfoques, 'mundo.camara.enfoques');
    dup(c.salida?.x !== undefined, 'salida.x');
    for (const [id, n] of Object.entries(c.npcs)) dup(n.x !== undefined || n.radio !== undefined, `las coordenadas de npcs.${id}`);
  } else if (c.mundo.camara.enfoques) {
    warnings.push('mundo.camara.enfoques está deprecado; usa puntos enfoqueCamara en Tiled');
  }
  if (errores.length) return fin();

  return { errores, warnings, nivel: { contenido: c, mundo: m } };
}
