// Valida los tres niveles con el validador del motor. Uso: `bun run validar`
// Termina con código 1 si algún nivel tiene errores. Las advertencias por voces sin grabar son normales:
// mientras no existan los audios, el juego usa la voz del navegador.

import { COMANDO_DEL_MOTOR, NIVELES, NOMBRES_DE_MINIJUEGOS } from './niveles.ts';

let huboErrores = false;
for (const nivel of NIVELES) {
  const proceso = Bun.spawnSync(
    ['bun', COMANDO_DEL_MOTOR, 'validar', `niveles/${nivel}/nivel.json`, '--minijuegos', NOMBRES_DE_MINIJUEGOS.join(',')],
    { cwd: `${import.meta.dir}/..`, stdout: 'inherit', stderr: 'inherit' },
  );
  if (proceso.exitCode !== 0) {
    huboErrores = true;
  }
}
process.exit(huboErrores ? 1 : 0);
