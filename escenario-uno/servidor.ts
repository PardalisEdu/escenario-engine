// Servidor para jugar el Escenario Uno en la computadora. Uso: `bun run jugar` y abrir http://localhost:3000
//
// Bun arma la página (`index.html` y el TypeScript que importa) y este archivo sirve, tal cual,
// los demás archivos de la carpeta: los niveles con sus mapas, imágenes y manifiestos.

import { join } from 'node:path';
import pagina from './index.html';

const CARPETA_DEL_ESCENARIO = import.meta.dir;
const PUERTO_POR_DEFECTO = 3000;
const puerto = Number(process.env.PUERTO ?? PUERTO_POR_DEFECTO);

/** Lo único que se sirve además de la página: los niveles. Así no se asoma `node_modules` ni el código. */
const CARPETA_PUBLICA = '/niveles/';

const servidor = Bun.serve({
  port: puerto,
  development: true,
  routes: { '/': pagina },
  async fetch(peticion) {
    const ruta = decodeURIComponent(new URL(peticion.url).pathname);
    if (!ruta.startsWith(CARPETA_PUBLICA) || ruta.split('/').includes('..')) {
      return new Response('ruta no permitida', { status: 400 });
    }

    const archivo = Bun.file(join(CARPETA_DEL_ESCENARIO, ruta));
    if (!(await archivo.exists())) {
      return new Response(`no existe ${ruta}`, { status: 404 });
    }
    return new Response(archivo);
  },
});

console.log(`Escenario Uno en ${servidor.url}`);
