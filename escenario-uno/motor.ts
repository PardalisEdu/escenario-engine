// El motor del juego: `@pardalis/escenario-engine` (versión 3.0).
//
// El paquete todavía no se publica ya construido (le falta la carpeta `dist/` que nombran sus `exports`),
// así que por ahora se importa su código fuente directamente. Cuando el motor se publique,
// este archivo queda en una sola línea:  export * from '@pardalis/escenario-engine';
export { crearEscenario, ErrorDeEscenario } from './node_modules/@pardalis/escenario-engine/src/index.ts';
export type {
  ContextoDeMinijuego,
  Juego,
  Minijuego,
  Partida,
  ResultadoDeMinijuego,
  ValorDeEstado,
} from './node_modules/@pardalis/escenario-engine/src/index.ts';
