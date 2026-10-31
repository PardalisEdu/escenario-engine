#!/usr/bin/env bun
// escenario-engine validar <mapa.tmj> <contenido.json> [--minijuegos A,B]
// Sin <mapa.tmj> (un solo argumento) valida en modo legacy. Sale con código 1 si hay errores.
import { dirname, resolve } from 'node:path';
import { resolverTilesets, type TiledMap } from './core/mapa';
import { validar } from './core/validar';

const args = process.argv.slice(2);
const i = args.indexOf('--minijuegos');
const minijuegos = i >= 0 ? args.splice(i, 2)[1]?.split(',') : undefined;
const [cmd, ...rutas] = args;

if (cmd !== 'validar' || rutas.length < 1 || rutas.length > 2) {
  console.error('uso: escenario-engine validar [mapa.tmj] <contenido.json> [--minijuegos A,B]');
  process.exit(2);
}

const leer = (ruta: string) => Bun.file(ruta).json();
const [rutaMapa, rutaContenido] = rutas.length === 2 ? rutas : [undefined, rutas[0]!];
let mapa: TiledMap | undefined;
try {
  if (rutaMapa) mapa = await resolverTilesets(await leer(rutaMapa), (r) => leer(resolve(dirname(rutaMapa), r)));
} catch (e) {
  console.error(`✗ parse: no se pudo leer el mapa: ${(e as Error).message}`);
  process.exit(1);
}
const r = validar({ config: await Bun.file(rutaContenido!).text(), mapa, minijuegos });

for (const w of r.warnings) console.warn(`⚠ ${w}`);
for (const e of r.errores) console.error(`✗ ${e}`);
console.log(r.errores.length ? `\n${r.errores.length} error(es), ${r.warnings.length} warning(s)` : `✓ ${rutaContenido} es válido (${r.warnings.length} warning(s))`);
process.exit(r.errores.length ? 1 : 0);
