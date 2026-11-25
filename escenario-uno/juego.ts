// El anfitrión del Escenario Uno: crea el juego con el motor, le entrega los minijuegos y decide lo que
// el motor deja en manos del sitio: guardar la partida, dibujar la lista del mandado y mostrar el final.
//
// Direcciones útiles mientras se desarrolla:
//   /?nivel=mercado            entra directo a un nivel (casa, mercado o comedor)
//   /?nivel=mercado&depurar    además muestra las guías del mapa y activa la cámara libre (tecla C)
//   /?minijuego=Balero         abre un minijuego solo (ver interfaz/probar-minijuego.ts)
//   /?nueva                    olvida la partida guardada y empieza de cero

import { conAvisos } from './interfaz/avisar-de-minijuegos.ts';
import { crearPantallaDeCarga } from './interfaz/pantalla-de-carga.ts';
import { borrarPartida, guardarPartida, leerPartidaGuardada } from './interfaz/partida-guardada.ts';
import { crearInterfaz } from './interfaz/interfaz.ts';
import type { Interfaz } from './interfaz/interfaz.ts';
import { probarMinijuego } from './interfaz/probar-minijuego.ts';
import { MINIJUEGOS } from './minijuegos/todos.ts';
import { crearEscenario } from './motor.ts';

const NIVELES = {
  casa: '/niveles/casa/nivel.json',
  mercado: '/niveles/mercado/nivel.json',
  comedor: '/niveles/comedor/nivel.json',
};
const NIVEL_INICIAL = 'casa';
/** El destino con el que termina el último nivel. No es un nivel: aquí se muestra la pantalla del final. */
const DESTINO_DEL_FINAL = 'Fin';

const elementoDelJuego = document.querySelector<HTMLElement>('#juego');
const elementoDeLaInterfaz = document.querySelector<HTMLElement>('#interfaz');
const aviso = document.querySelector<HTMLElement>('#aviso');
const elementoDeCarga = document.querySelector<HTMLElement>('#cargando');
const barraDeCarga = document.querySelector<HTMLElement>('#cargando-avance');
if (elementoDelJuego === null || elementoDeLaInterfaz === null || aviso === null) {
  throw new Error('a la página le falta el elemento #juego, #interfaz o #aviso');
}
if (elementoDeCarga === null || barraDeCarga === null) {
  throw new Error('a la página le falta el elemento #cargando o #cargando-avance');
}
const pantallaDeCarga = crearPantallaDeCarga(elementoDeCarga, barraDeCarga);

const direccion = new URLSearchParams(location.search);
const minijuegoPorProbar = direccion.get('minijuego');

if (minijuegoPorProbar !== null) {
  pantallaDeCarga.quitar();
  await abrirMesaDePruebas(elementoDelJuego, minijuegoPorProbar);
} else {
  await empezarElJuego(elementoDelJuego, elementoDeLaInterfaz, aviso);
}

async function empezarElJuego(lugarDelJuego: HTMLElement, lugarDeLaInterfaz: HTMLElement, lugarDelAviso: HTMLElement): Promise<void> {
  if (direccion.has('nueva')) {
    borrarPartida();
  }
  const nivelPedido = leerNivelDeLaDireccion();

  // La interfaz se crea después que el juego, pero los minijuegos necesitan avisarle desde antes.
  let interfaz: Interfaz | undefined;
  const minijuegos = conAvisos(MINIJUEGOS, (hayMinijuego) => interfaz?.esconderPorMinijuego(hayMinijuego));

  try {
    const juego = await crearEscenario(lugarDelJuego, {
      niveles: NIVELES,
      nivel: nivelPedido ?? NIVEL_INICIAL,
      minijuegos,
      // Si la dirección pide un nivel, se entra a ese sin la partida guardada (que podría nombrar otro).
      partida: nivelPedido === undefined ? leerPartidaGuardada() : null,
      depurar: direccion.has('depurar'),
      alCargar: (progreso) => pantallaDeCarga.avanzar(progreso),
    });
    pantallaDeCarga.quitar();
    interfaz = crearInterfaz(lugarDeLaInterfaz, juego);
    const interfazCreada = interfaz;

    juego.on('guardar', (partida) => guardarPartida(partida));
    juego.on('salida', (destino) => {
      if (destino === DESTINO_DEL_FINAL) {
        // La aventura terminó: la próxima vez se empieza de nuevo.
        borrarPartida();
        interfazCreada.mostrarElFinal();
      }
    });
    juego.on('error', (error) => console.error('[escenario-uno] el juego avisó de un error:', error.problemas));
    addEventListener('pagehide', () => {
      interfazCreada.destruir();
      juego.destruir();
    });
  } catch (error) {
    // Un nivel mal escrito se explica en la propia página: cada problema en su línea.
    pantallaDeCarga.quitar();
    const problemas = error instanceof Error && 'problemas' in error ? error.problemas : undefined;
    lugarDelAviso.hidden = false;
    lugarDelAviso.textContent = Array.isArray(problemas) ? problemas.join('\n') : String(error);
    console.error(error);
  }
}

async function abrirMesaDePruebas(lugarDelJuego: HTMLElement, nombre: string): Promise<void> {
  if (!Object.hasOwn(MINIJUEGOS, nombre)) {
    lugarDelJuego.textContent = `No existe el minijuego "${nombre}". Los que hay: ${Object.keys(MINIJUEGOS).join(', ')}`;
    return;
  }
  let config: unknown = {};
  const configDeLaDireccion = direccion.get('config');
  if (configDeLaDireccion !== null) {
    config = JSON.parse(configDeLaDireccion);
  }
  await probarMinijuego(lugarDelJuego, MINIJUEGOS[nombre]!, config); // `hasOwn` acaba de comprobar que existe
}

/** El nivel que pide la dirección de la página con `?nivel=...`, si es uno de los del escenario. */
function leerNivelDeLaDireccion(): string | undefined {
  const pedido = direccion.get('nivel');
  if (pedido === null || !Object.hasOwn(NIVELES, pedido)) return undefined;
  return pedido;
}
