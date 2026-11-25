// Minijuego «Rascadita»: el puesto de Don Tlacua. Se paga un boleto, se rasca la zona plateada con el dedo
// y debajo SIEMPRE hay un premio de la tabla (aquí todos ganan; el globo desinflado es el premio chistoso).
//
// 1. Se paga el boleto contando monedas.
// 2. Se rasca arrastrando el dedo o el ratón; con teclado, cada espacio o Enter rasca un pedazo.
//    Al destapar más o menos la mitad, el boleto se termina de destapar solo y se celebra el premio.
// Final: la tarjeta con el premio y tres estrellas siempre. Otorga `premio` con el nombre del premio:
//        `globo`, `dulce`, `canica`, `trompo` o `pizarron`.
//
// Configuración que le pasa el nivel:
//   { "precio": 5 }

import type { Minijuego } from '../motor.ts';
import { cobrar } from './comun/cobro.ts';
import { abrirMarco } from './comun/marco.ts';
import type { Marco } from './comun/marco.ts';
import { animar, crear, crearImagen, esperar, leerNumero } from './comun/piezas.ts';
import { armarPremio, mostrarResultado } from './comun/resultado.ts';
import { rascarLaPlata } from './rascadita/plata.ts';
import { crearTablaDePremios, sortearPremio } from './rascadita/premios.ts';
import type { Premio } from './rascadita/premios.ts';
import { lanzarConfeti } from './rascadita/confeti.ts';

const PRECIO_POR_DEFECTO = 5;
const PAUSA_ENTRE_VOCES_EN_MILISEGUNDOS = 2600;
const PAUSA_PARA_VER_EL_PREMIO_EN_MILISEGUNDOS = 1800;
/** Cuántas estrellitas adornan la orilla de arriba del boleto. */
const ESTRELLAS_DE_ADORNO = 3;

/** Las piezas de la pantalla del boleto que cambian al revelar el premio. */
interface PantallaDelBoleto {
  readonly escena: HTMLElement;
  readonly tlacua: HTMLElement;
  readonly ventana: HTMLElement;
  readonly plata: HTMLCanvasElement;
  readonly filaDelPremio: HTMLElement;
}

export const Rascadita: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'amarillo');
  const precio = leerNumero(contexto.config, 'precio', PRECIO_POR_DEFECTO);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const pago = await cobrar(marco, { precio, compra: 'item_boleto' });
    if (!pago) return;

    const premio = sortearPremio();
    const pantalla = armarLaPantalla(marco, premio);
    marco.indicar('¡Rasca tu boleto con el dedo!', ['item_boleto']);
    const destapado = await rascarLaPlata(marco, pantalla.plata);
    if (!destapado) return;

    await revelarElPremio(marco, pantalla, premio);
    await mostrarResultado(marco, { estrellas: 3, cosas: [premio.dibujo], frase: '¡Felicidades! ¡Es todo tuyo!' });
    const otorgar = armarPremio(marco, { loPropio: { premio: premio.nombre }, precio, estrellas: 0 });
    marco.terminar({ exito: true, otorgar });
  }
};

/** Don Tlacua a la izquierda, el boleto grande en medio y la tabla de premios a la derecha. */
function armarLaPantalla(marco: Marco, premio: Premio): PantallaDelBoleto {
  marco.area.replaceChildren();
  const escena = crear('div', 'rascadita-escena', marco.area);
  const tlacua = crearImagen(marco.contexto, 'spr_tlacua', 'rascadita-tlacua', escena);

  const boleto = crear('div', 'rascadita-boleto', escena);
  const adorno = crear('div', 'rascadita-adorno', boleto);
  for (let i = 0; i < ESTRELLAS_DE_ADORNO; i++) {
    crearImagen(marco.contexto, 'item_estrella', 'rascadita-adorno-estrella', adorno);
  }
  // El premio ya está dibujado desde el principio; la plata del `<canvas>` lo tapa hasta que se rasca.
  const ventana = crear('div', 'rascadita-ventana', boleto);
  crearImagen(marco.contexto, premio.dibujo, 'rascadita-premio', ventana);
  const plata = crear('canvas', 'rascadita-plata', ventana);

  const tabla = crearTablaDePremios(marco, escena);
  return { escena, tlacua, ventana, plata, filaDelPremio: tabla.filaDe(premio) };
}

/** Termina de destapar el boleto, celebra con confeti y anuncia el premio en español y en inglés. */
async function revelarElPremio(marco: Marco, pantalla: PantallaDelBoleto, premio: Premio): Promise<void> {
  pantalla.plata.classList.add('rascadita-plata-destapada');
  pantalla.ventana.classList.add('rascadita-ventana-premiada');
  pantalla.filaDelPremio.classList.add('rascadita-fila-ganada');
  animar(pantalla.tlacua, 'rascadita-tlacua-festeja');
  lanzarConfeti(pantalla.escena);
  marco.sonar('sfx_bien');
  marco.decir(premio.anuncio);
  await esperar(PAUSA_ENTRE_VOCES_EN_MILISEGUNDOS, marco.senal);
  marco.decir(premio.enIngles, 'en');
  await esperar(PAUSA_PARA_VER_EL_PREMIO_EN_MILISEGUNDOS, marco.senal);
}
