// Los números dichos con palabras, en español y en inglés, para contarlos en voz alta.
// Así el dinero se aprende de oído: «cinco… diez… quince», y el primo lo repite en inglés.

const UNIDADES_EN_ESPANOL = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const DECENAS_EN_ESPANOL = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const UNIDADES_EN_INGLES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const DECENAS_EN_INGLES = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const CIEN = 100;

/** Un número de 0 a 100 con palabras, en español: 35 → «treinta y cinco». Fuera de ese rango, con cifras. */
export function numeroEnEspanol(numero: number): string {
  if (!Number.isInteger(numero) || numero < 0 || numero > CIEN) return String(numero);
  if (numero === CIEN) return 'cien';
  if (numero < UNIDADES_EN_ESPANOL.length) return UNIDADES_EN_ESPANOL[numero]!; // se acaba de comprobar el rango
  const decena = DECENAS_EN_ESPANOL[Math.floor(numero / 10)]!; // de 30 a 99: la lista tiene esas decenas
  const unidad = numero % 10;
  if (unidad === 0) return decena;
  return `${decena} y ${UNIDADES_EN_ESPANOL[unidad]!}`;
}

/** Un número de 0 a 100 con palabras, en inglés: 35 → «thirty-five». Fuera de ese rango, con cifras. */
export function numeroEnIngles(numero: number): string {
  if (!Number.isInteger(numero) || numero < 0 || numero > CIEN) return String(numero);
  if (numero === CIEN) return 'one hundred';
  if (numero < UNIDADES_EN_INGLES.length) return UNIDADES_EN_INGLES[numero]!; // se acaba de comprobar el rango
  const decena = DECENAS_EN_INGLES[Math.floor(numero / 10)]!; // de 20 a 99: la lista tiene esas decenas
  const unidad = numero % 10;
  if (unidad === 0) return decena;
  return `${decena}-${UNIDADES_EN_INGLES[unidad]!}`;
}
