// La lista de niveles y de carpetas de assets del Escenario Uno, para las herramientas y las pruebas.

/** Los niveles, en el orden en que se juegan. */
export const NIVELES = ['casa', 'mercado', 'comedor'];

/** Cada carpeta con imágenes y sonidos lleva su propio manifiesto `assets.json`. */
export const CARPETAS_DE_ASSETS = ['comun', 'casa', 'mercado', 'comedor'];

/** Los minijuegos que registra el sitio (minijuegos/todos.ts). El validador revisa que los niveles solo pidan estos. */
export const NOMBRES_DE_MINIJUEGOS = ['Balero', 'Cartas', 'Chiles', 'Cobro', 'Rascadita', 'Tostadas', 'Verduleria'];

/** La línea de comandos del motor. Se usa su código fuente porque el paquete todavía no se publica construido. */
export const COMANDO_DEL_MOTOR = 'node_modules/@pardalis/escenario-engine/src/cli.ts';
