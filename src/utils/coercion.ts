/**
 * @file utils/coercion.ts
 * @description Fonctions utilitaires de conversion et de coercion automatique des types.
 * Permet de convertir les chaînes de caractères (URL params, Query string)
 * en types primitifs (number, boolean, string) ou via un transformateur personnalisé.
 */

/**
 * Type représentant une fonction de transformation explicite.
 */
export type ValueTransform<T> = (value: string) => T;

/**
 * Coerce intelligemment une valeur textuelle brute vers un type cible T.
 *
 * Règles de conversion automatique si aucun transformateur n'est fourni :
 * - "true" -> true (boolean)
 * - "false" -> false (boolean)
 * - Représentation numérique valide (ex: "42", "3.14") -> number
 * - Tout autre format -> chaîne de caractères d'origine
 *
 * @template T Le type de retour attendu.
 * @param value La chaîne brute ou undefined.
 * @param transform Fonction de conversion explicite optionnelle (ex: Number, Boolean, BigInt).
 * @returns La valeur convertie dans le type demandé, ou undefined si l'entrée est undefined.
 */
export function coerceValue<T = unknown>(
  value: string | undefined,
  transform?: ValueTransform<T>
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  // 1. Si une fonction de transformation explicite est fournie, on la priorise
  if (typeof transform === "function") {
    return transform(value);
  }

  const trimmed = value.trim();

  // 2. Conversion automatique des booléens
  if (trimmed.toLowerCase() === "true") {
    return true as unknown as T;
  }
  if (trimmed.toLowerCase() === "false") {
    return false as unknown as T;
  }

  // 3. Conversion automatique des nombres
  // On vérifie que la chaîne n'est pas vide et correspond à un nombre valide
  if (trimmed !== "" && !isNaN(Number(trimmed))) {
    return Number(trimmed) as unknown as T;
  }

  // 4. Par défaut, retour de la chaîne d'origine
  return value as unknown as T;
}

/**
 * Convertit un ensemble clé-valeur de paramètres (URL params ou Query params)
 * en un objet avec coercion automatique sur toutes les valeurs.
 *
 * @param record Objet contenant les valeurs sous forme de chaînes de caractères.
 * @returns Nouvel objet dont les valeurs compatibles sont converties (number, boolean).
 */
export function coerceRecord<T extends Record<string, unknown>>(
  record: Record<string, string | string[] | undefined>
): T {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(record)) {
    if (Array.isArray(val)) {
      result[key] = val.map((item) => coerceValue(item));
    } else {
      result[key] = coerceValue(val);
    }
  }

  return result as T;
}
