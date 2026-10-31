export { EscenarioEngine, type EscenarioOptions, type EventosEscenario, type ProyeccionConfig } from './engine';
export type { MiniGameContext, MiniGameFactory } from './adaptadores/phaser/escena';
export type { AssetManager } from './adaptadores/phaser/assets';
export type { MiniGameResult } from './core/dialogo';
export type { Contenido, Paso, Linea, Condicion } from './core/esquema';
export type { SaveBlob } from './core/estado';
export type { TiledMap } from './core/mapa';
export { validar, EscenarioError } from './core/validar';
