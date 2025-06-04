/**
 * @template T 
 * @param {number} i 
 * @param {number} j 
 * @param {(i: number, j: number) => T} defaultValue
 * @returns {T[][]}
 */
export default function gen2dArray(i, j, defaultValue = () => null) {
  return Array.from({ length: i }, (_, y) => Array.from({ length: j }, (_, x) => defaultValue(y, x)));
}
