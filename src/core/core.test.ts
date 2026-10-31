// Pruebas del núcleo. Usan el ejemplo de la Tortillería (§14.1) de la carpeta ejemplo/.
import { describe, expect, test } from 'bun:test';
import contenidoTortilleria from '../../ejemplo/niveles/tortilleria.json' with { type: 'json' };
import { resolverUrlDeAsset } from './assets';
import { DialogueRuntime, type AccionesDelMundo, type MiniGameResult } from './dialogo';
import { GameState } from './estado';
import { ajustarAlPiso, avanzarHacia, puntoDentroDePoligono } from './geometria';
import type { TiledMap } from './mapa-tiled';
import { leerPartida } from './partida';
import { validar } from './validar';

const mapaTortilleria: TiledMap = await Bun.file(new URL('../../ejemplo/niveles/tortilleria.tmj', import.meta.url)).json();

/** Una copia del contenido de ejemplo que cada prueba puede modificar. */
function copiaDelContenido(): any {
  return structuredClone(contenidoTortilleria);
}

function copiaDelMapa(): TiledMap {
  return structuredClone(mapaTortilleria);
}

describe('validación', () => {
  test('el ejemplo de la Tortillería es válido y une mapa con contenido', () => {
    const resultado = validar({ config: contenidoTortilleria, mapa: mapaTortilleria, minijuegos: ['Tortilleria'] });

    expect(resultado.errores).toEqual([]);
    const mundo = resultado.nivel!.mundo;
    expect(mundo.ancho).toBe(2400);
    expect(mundo.npcs.tortu!.puntoInteraccion).toEqual({ x: 760, y: 470 });
    expect(mundo.npcs.tortu!.puntoDePie).toEqual({ x: 950, y: 420 });
    expect(mundo.props[0]).toMatchObject({ clase: 'comal', asset: 'comal', puntoDePie: { x: 1040, y: 440 }, pisable: false });
  });

  test('los pasos se convierten a su forma interna con "tipo"', () => {
    const { nivel } = validar({ config: contenidoTortilleria, mapa: mapaTortilleria });
    const pasos = nivel!.contenido.npcs.tortu!.dialogo[1]!.pasos;

    expect(pasos[0]).toEqual({ tipo: 'camina', destino: 'frente_tortilleria', quien: undefined });
    expect(pasos[1]).toMatchObject({ tipo: 'linea', hablante: 'tortu', en: 'hot', es: 'caliente' });
    expect(pasos[2]).toMatchObject({ tipo: 'juego', clave: 'Tortilleria' });
  });

  test('fase 2 (schema): el error apunta a la ruta del JSON', () => {
    const sinCuerpo = copiaDelContenido();
    sinCuerpo.npcs.tortu.dialogo[0] = { cuando: 'tengo tortillas' };
    expect(validar({ config: sinCuerpo, mapa: mapaTortilleria }).errores[0]).toStartWith('npcs.tortu.dialogo[0].dice:');

    const lineaSinTexto = copiaDelContenido();
    lineaSinTexto.secuencias.aun_no_item[0] = { dice: 'tortu' };
    expect(validar({ config: lineaSinTexto, mapa: mapaTortilleria }).errores[0]).toStartWith('secuencias.aun_no_item[0].texto:');
  });

  test('fase 3 (enlaces): minijuegos, condiciones y secuencias', () => {
    const sinFabrica = validar({ config: contenidoTortilleria, mapa: mapaTortilleria, minijuegos: [] });
    expect(sinFabrica.errores).toContain('"juego": "Tortilleria" usado en npcs.tortu.dialogo[1].dice[2] pero no registrado en el host');

    const contenido = copiaDelContenido();
    contenido.npcs.tortu.dialogo[0].cuando = 'globo';
    contenido.npcs.tortu.alVolver.siNo = 'no_existe';
    const errores = validar({ config: contenido, mapa: mapaTortilleria }).errores;
    expect(errores).toContain('condición "globo" usada en npcs.tortu.dialogo[0] pero no está en estado.objetivos ni estado.variables');
    expect(errores).toContain('secuencia "no_existe" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"');
  });

  test('fase 4 (cruce): puntos con nombre y NPCs sin objeto en el mapa', () => {
    const puntoMalEscrito = copiaDelContenido();
    puntoMalEscrito.npcs.tortu.dialogo[1].dice[0].camina = 'frente_tortileria';
    expect(validar({ config: puntoMalEscrito, mapa: mapaTortilleria }).errores).toContain(
      'camina "frente_tortileria" en npcs.tortu.dialogo[1].dice[0]: no hay punto con ese nombre',
    );

    const npcSinMapa = copiaDelContenido();
    npcSinMapa.npcs.tito = { dialogo: [] };
    expect(validar({ config: npcSinMapa, mapa: mapaTortilleria }).errores).toContain('npcs.tito no tiene objeto de clase npc en la capa "npcs"');
  });

  test('errores del mapa: capa faltante y clase desconocida', () => {
    const mapa = copiaDelMapa();
    mapa.layers = mapa.layers.filter((capa) => capa.name !== 'piso');
    mapa.layers.find((capa) => capa.name === 'decorado')!.objects![0]!.type = 'lámpara';

    const errores = validar({ config: contenidoTortilleria, mapa }).errores;
    expect(errores).toContain('mapa: falta la capa requerida "piso"');
    expect(errores).toContain('mapa: objeto #20 "comal" en "decorado" tiene clase desconocida "lámpara"');
  });

  test('formato v1 sin mapa: layout, coordenadas y formas deprecadas', () => {
    const contenido = copiaDelContenido();
    Object.assign(contenido.mundo, { ancho: 2000, piso: [405, 505], inicio: 260 });
    contenido.npcs = [{ id: 'tortu', x: 535, y: 480, radio: 140, dialogo: contenido.npcs.tortu.dialogo, alVolver: contenido.npcs.tortu.alVolver }];
    contenido.npcs[0].dialogo[1].dice[0] = { camina: 300 };
    contenido.layout = [{ tipo: 'cajas', x: [380, 1110, 1600] }];
    contenido.salida.x = 40;
    contenido.comentarios.general[0] = { quien: 'tommy', texto: 'Wow!' };

    const resultado = validar({ config: contenido });
    expect(resultado.errores).toEqual([]);
    expect(resultado.nivel!.mundo.props).toHaveLength(3);
    expect(resultado.advertencias.some((a) => a.includes('npcs como arreglo'))).toBe(true);
    expect(resultado.advertencias.some((a) => a.includes('"quien" en una línea'))).toBe(true);
    expect(resultado.nivel!.contenido.comentarios.general![0]!.hablante).toBe('tommy');
  });
});

describe('estado y condiciones', () => {
  test('condiciones, {faltan} y aviso de objetivo completo', () => {
    const estado = new GameState({
      objetivos: ['tortillas', 'aguacates', 'limones'],
      variables: ['globo'],
      lista: { tortillas: 'las tortillas', aguacates: 'los aguacates', limones: 'los limones' },
    });
    const completados: string[] = [];
    estado.alCompletarObjetivo = (objetivo) => completados.push(objetivo);

    expect(estado.completarTexto('Faltan {faltan}.')).toBe('Faltan las tortillas, los aguacates y los limones.');

    estado.poner('tortillas', true);
    estado.poner('tortillas', true); // repetir no vuelve a avisar
    expect(completados).toEqual(['tortillas']);

    expect(estado.cumple('tengo tortillas')).toBe(true);
    expect(estado.cumple('no tengo limones')).toBe(true);
    expect(estado.cumple(['tengo tortillas', 'globo'])).toBe(false);
    expect(estado.cumple({ alguno: ['globo', 'tengo tortillas'] })).toBe(true);

    estado.ponerVarios({ aguacates: true, limones: 1 });
    expect(estado.cumple('objetivosCompletos')).toBe(true);
  });

  test('una partida v1 se convierte a v2', () => {
    expect(leerPartida('{"v":1,"estado":{"tortillas":true}}', 'tortilleria')).toEqual({
      v: 2,
      nivel: 'tortilleria',
      estado: { tortillas: true },
    });
  });
});

describe('geometría', () => {
  const piso = [{ x: 0, y: 420 }, { x: 2400, y: 420 }, { x: 2400, y: 530 }, { x: 0, y: 530 }];
  const esCaminable = (punto: { x: number; y: number }) => puntoDentroDePoligono(punto, piso);

  test('un toque fuera del piso se ajusta al punto más cercano dentro', () => {
    const ajustado = ajustarAlPiso({ x: 500, y: 100 }, [piso]);
    expect(ajustado.x).toBeCloseTo(500, 0);
    expect(puntoDentroDePoligono(ajustado, piso)).toBe(true);
  });

  test('al chocar en diagonal con el borde, el jugador se desliza en horizontal', () => {
    const siguiente = avanzarHacia({ x: 100, y: 421 }, { x: 200, y: 300 }, { x: 240, y: 110 }, 0.1, esCaminable);
    expect(siguiente).toEqual({ x: 124, y: 421 });
  });
});

describe('rutas de assets', () => {
  const raiz = 'https://assets.pardalis.mx/aventura/';
  const cdn = ['https://assets.pardalis.mx'];
  const pagina = 'https://pardalis.mx/';

  test('agrega la extensión por defecto y respeta la que ya trae', () => {
    expect(resolverUrlDeAsset('spr_tommy', 'imagen', raiz, cdn, pagina)).toBe('https://assets.pardalis.mx/aventura/spr_tommy.webp');
    expect(resolverUrlDeAsset('voz/a.ogg', 'audio', raiz, cdn, pagina)).toBe('https://assets.pardalis.mx/aventura/voz/a.ogg');
  });

  test('rechaza "..", orígenes fuera de la lista blanca y HTTP', () => {
    expect(() => resolverUrlDeAsset('../secreto', 'imagen', raiz, cdn, pagina)).toThrow();
    expect(() => resolverUrlDeAsset('https://evil.com/x.png', 'imagen', raiz, cdn, pagina)).toThrow();
    expect(() => resolverUrlDeAsset('x', 'imagen', 'http://assets.pardalis.mx/', cdn, pagina)).toThrow();
  });
});

describe('DialogueRuntime', () => {
  const { nivel } = validar({ config: contenidoTortilleria, mapa: mapaTortilleria });
  const contenido = nivel!.contenido;

  /** Un mundo falso que solo anota lo que le piden. */
  function mundoDePrueba(registro: string[], resultadoDelMinijuego: () => MiniGameResult): AccionesDelMundo {
    return {
      mostrarLinea: async (_linea, texto) => { registro.push(texto); },
      elegirOpcion: async () => 0,
      reproducirEfecto: async (nombre) => { registro.push(`efecto:${nombre}`); },
      caminar: async (_quien, destino) => { registro.push(`camina:${String(destino)}`); },
      jugarMinijuego: async () => resultadoDelMinijuego(),
    };
  }

  test('ramas, flag charlas, minijuego y alVolver', async () => {
    const registro: string[] = [];
    let ganaElMinijuego = false;
    const estado = new GameState(contenido.estado);
    const runtime = new DialogueRuntime(contenido, estado, mundoDePrueba(registro, () =>
      ganaElMinijuego ? { exito: true, otorgar: { tortillas: true } } : { exito: false },
    ));

    // Primera visita, pierde el minijuego → siNo
    const primeraVisita = runtime.hablarCon('npcs', 'tortu');
    expect(runtime.ocupado).toBe(true);
    await primeraVisita;
    expect(registro).toEqual(['camina:frente_tortilleria', '¡Cuidado, el comal está caliente!', '¡Otro día lo intentamos!']);
    expect(estado.valorDe('charlas.tortu')).toBe(true);

    // Gana el minijuego → siLogrado
    registro.length = 0;
    ganaElMinijuego = true;
    await runtime.hablarCon('npcs', 'tortu');
    expect(registro).toEqual(['camina:frente_tortilleria', '¡Cuidado, el comal está caliente!', 'efecto:magia', 'Thank you!']);

    // Ya tiene tortillas → rama de revisita
    registro.length = 0;
    await runtime.hablarCon('npcs', 'tortu');
    expect(registro).toEqual(['¡Que te aprovechen!']);
  });

  test('mientras hay un diálogo, otro no empieza', async () => {
    const registro: string[] = [];
    const runtime = new DialogueRuntime(contenido, new GameState(contenido.estado), mundoDePrueba(registro, () => ({ exito: false })));
    const primero = runtime.hablarCon('npcs', 'tortu');
    await runtime.hablarCon('npcs', 'tortu'); // se ignora
    await primero;
    expect(registro.filter((r) => r.startsWith('camina'))).toHaveLength(1);
  });

  test('abort() libera un paso que nunca termina', async () => {
    const pasoInfinito = { ...mundoDePrueba([], () => ({ exito: false })), caminar: () => new Promise<void>(() => {}) };
    const runtime = new DialogueRuntime(contenido, new GameState(contenido.estado), pasoInfinito);
    const dialogo = runtime.hablarCon('npcs', 'tortu');
    runtime.abort();
    await dialogo;
    expect(runtime.ocupado).toBe(false);
  });
});
