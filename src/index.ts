// Punto de entrada del paquete para el navegador. Para validar sin navegador, usa "escenario-engine/validar".
export { EscenarioEngine, type EscenarioOptions, type EventosEscenario } from './engine';
export type { ProyeccionConfig } from './adaptadores/phaser/interfaz';
export type { MiniGameContext, MiniGameFactory } from './adaptadores/phaser/minijuego';
export type { AssetManager } from './adaptadores/phaser/assets';
export type { MiniGameResult } from './core/dialogo';
export type { Contenido, Condicion, Linea, Paso } from './core/esquema';
export type { SaveBlob } from './core/partida';
export type { TiledMap } from './core/mapa-tiled';
export { validar, EscenarioError } from './core/validar';
