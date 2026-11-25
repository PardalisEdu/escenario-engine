// Pone en mayúscula la primera letra de una frase: «lechuga» → «Lechuga».
// Los nombres de las verduras y los números se guardan en minúsculas porque casi siempre van a media frase.

export function conMayusculaInicial(frase: string): string {
  return frase.charAt(0).toLocaleUpperCase('es') + frase.slice(1);
}
