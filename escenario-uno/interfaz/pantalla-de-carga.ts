// La pantalla de carga: el logo de Pardalis brincando y una barra que avanza con cada dibujo que llega.
// El motor avisa del avance con la opción `alCargar`; dibujar la barra es cosa del sitio.

export interface PantallaDeCarga {
  /** Lo que se le pasa al motor como `alCargar`. */
  avanzar(progreso: { cargados: number; total: number }): void;
  /** Se llama cuando el juego ya se puede jugar (o cuando falló): la pantalla se desvanece. */
  quitar(): void;
}

const PORCENTAJE_COMPLETO = 100;

export function crearPantallaDeCarga(pantalla: HTMLElement, barra: HTMLElement): PantallaDeCarga {
  return {
    avanzar(progreso) {
      if (progreso.total <= 0) return;
      // Al cambiar de nivel la pantalla no vuelve a salir: el motor ya cierra y abre a negro por su cuenta.
      barra.style.width = `${(progreso.cargados / progreso.total) * PORCENTAJE_COMPLETO}%`;
    },
    quitar() {
      pantalla.classList.add('cargando-lista');
    },
  };
}
