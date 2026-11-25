// Pruebas del escenario: los tres niveles deben pasar el validador del motor sin errores,
// y los minijuegos que piden deben ser justo los que el sitio registra.

import { expect, test } from 'bun:test';
import { validarNivel } from './node_modules/@pardalis/escenario-engine/src/validar.ts';
import { NIVELES, NOMBRES_DE_MINIJUEGOS } from './herramientas/niveles.ts';
import { MINIJUEGOS } from './minijuegos/todos.ts';

for (const nivel of NIVELES) {
  test(`el nivel "${nivel}" pasa la validación del motor sin errores`, async () => {
    const resultado = await validarNivel(`${import.meta.dir}/niveles/${nivel}/nivel.json`, {
      minijuegos: NOMBRES_DE_MINIJUEGOS,
    });

    expect(resultado.errores).toEqual([]);
  });
}

test('la lista de minijuegos de las herramientas es la misma que registra el sitio', () => {
  const registrados = Object.keys(MINIJUEGOS).sort();

  expect(registrados).toEqual([...NOMBRES_DE_MINIJUEGOS].sort());
});

test('todos los sonidos y la música que nombran los niveles existen', async () => {
  for (const nivel of NIVELES) {
    const resultado = await validarNivel(`${import.meta.dir}/niveles/${nivel}/nivel.json`, {
      minijuegos: NOMBRES_DE_MINIJUEGOS,
    });
    const avisosDeSonido = resultado.advertencias.filter((advertencia) => advertencia.includes('no sonará'));

    // Los sonidos y la música sí están grabados: si falta uno, es un nombre mal escrito.
    expect(avisosDeSonido).toEqual([]);
  }
});
