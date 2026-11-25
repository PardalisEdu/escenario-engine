// Regenera el manifiesto `assets.json` de cada carpeta de assets. Uso: `bun run assets`
// Hay que correrlo cada vez que se agrega, quita o renombra una imagen o un sonido.

import { CARPETAS_DE_ASSETS, COMANDO_DEL_MOTOR } from './niveles.ts';

let huboErrores = false;
for (const carpeta of CARPETAS_DE_ASSETS) {
  const proceso = Bun.spawnSync(['bun', COMANDO_DEL_MOTOR, 'assets', `niveles/${carpeta}`], {
    cwd: `${import.meta.dir}/..`,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (proceso.exitCode !== 0) {
    huboErrores = true;
  }
}
process.exit(huboErrores ? 1 : 0);
