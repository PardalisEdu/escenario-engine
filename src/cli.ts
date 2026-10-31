#!/usr/bin/env bun
/**
 * Valida un nivel sin abrir el juego (para CI). Sale con código 1 si hay errores.
 *
 *   escenario-engine validar <mapa.tmj> <contenido.json> [--minijuegos A,B]
 *   escenario-engine validar <contenido.json>            (formato v1, sin mapa)
 */
import { dirname, resolve } from 'node:path';
import { cargarTilesetsExternos, type TiledMap } from './core/mapa-tiled';
import { validar } from './core/validar';

const USO = 'uso: escenario-engine validar [mapa.tmj] <contenido.json> [--minijuegos A,B]';

function leerArgumentos(argumentos: string[]) {
  const restantes = [...argumentos];
  let minijuegos: string[] | undefined;

  const posicion = restantes.indexOf('--minijuegos');
  if (posicion >= 0) {
    minijuegos = restantes[posicion + 1]?.split(',');
    restantes.splice(posicion, 2);
  }

  const [comando, ...rutas] = restantes;
  if (comando !== 'validar' || rutas.length < 1 || rutas.length > 2) return undefined;

  const conMapa = rutas.length === 2;
  return {
    rutaDelMapa: conMapa ? rutas[0] : undefined,
    rutaDelContenido: conMapa ? rutas[1]! : rutas[0]!,
    minijuegos,
  };
}

async function leerMapa(ruta: string): Promise<TiledMap> {
  const mapa: TiledMap = await Bun.file(ruta).json();
  // Los tilesets externos se buscan junto al mapa.
  return cargarTilesetsExternos(mapa, (rutaDelTileset) => Bun.file(resolve(dirname(ruta), rutaDelTileset)).json());
}

const argumentos = leerArgumentos(process.argv.slice(2));
if (!argumentos) {
  console.error(USO);
  process.exit(2);
}

let mapa: TiledMap | undefined;
if (argumentos.rutaDelMapa) {
  try {
    mapa = await leerMapa(argumentos.rutaDelMapa);
  } catch (error) {
    console.error(`✗ parse: no se pudo leer el mapa: ${(error as Error).message}`);
    process.exit(1);
  }
}

const contenido = await Bun.file(argumentos.rutaDelContenido).text();
const resultado = validar({ config: contenido, mapa, minijuegos: argumentos.minijuegos });

for (const advertencia of resultado.advertencias) console.warn(`⚠ ${advertencia}`);
for (const error of resultado.errores) console.error(`✗ ${error}`);

const resumen = `${resultado.errores.length} error(es), ${resultado.advertencias.length} advertencia(s)`;
if (resultado.errores.length > 0) {
  console.log(`\n${resumen}`);
  process.exit(1);
}
console.log(`✓ ${argumentos.rutaDelContenido} es válido (${resumen})`);
