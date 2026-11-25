// Las monedas y billetes con que se entrega el cambio: cuáles hacen falta para juntar una cantidad
// y cuál es el dibujo de cada uno.

/** Los valores que tienen dibujo, del más grande al más chico. */
const VALORES_DE_LAS_PIEZAS = [50, 20, 10, 5, 2, 1];
/** De este valor para arriba es billete; lo demás son monedas. */
const VALOR_DEL_BILLETE_MAS_CHICO = 20;

/**
 * Reparte una cantidad de pesos en las menos piezas posibles, de la más grande a la más chica:
 * 15 → [10, 5]. La cantidad debe ser un entero mayor que cero.
 */
export function repartirEnPiezas(cantidad: number): number[] {
  const piezas: number[] = [];
  let falta = cantidad;
  for (const valor of VALORES_DE_LAS_PIEZAS) {
    while (falta >= valor) {
      piezas.push(valor);
      falta -= valor;
    }
  }
  return piezas;
}

export function esBillete(valor: number): boolean {
  return valor >= VALOR_DEL_BILLETE_MAS_CHICO;
}

/** La clave del dibujo de una moneda o billete: 10 → `item_moneda10`, 50 → `item_billete50`. */
export function claveDelDibujoDeLaPieza(valor: number): string {
  if (esBillete(valor)) return `item_billete${valor}`;
  return `item_moneda${valor}`;
}
