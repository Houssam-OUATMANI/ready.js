/**
 * @file middleware/compose.ts
 * @description Moteur d'exécution de middlewares en cascade (modèle en oignon).
 * Permet à chaque middleware d'exécuter du code avant et après via `await next()`.
 */

import type { Context } from "../context.js";
import type { Handler, Middleware } from "../types/index.js";

/**
 * Compose un tableau de middlewares et gestionnaires en une seule fonction asynchrone.
 *
 * @param middlewares Liste ordonnée des fonctions à exécuter
 * @returns Une fonction acceptant le contexte et exécutant la chaîne
 */
export function compose(middlewares: Array<Middleware | Handler>) {
  return function dispatchChain(context: Context): Promise<Response | unknown> {
    let lastIndex = -1;

    function dispatch(i: number): Promise<Response | unknown> {
      if (i <= lastIndex) {
        return Promise.reject(new Error("next() a été appelé plusieurs fois dans le même middleware"));
      }
      lastIndex = i;

      const fn = middlewares[i];
      if (!fn) {
        // Fin de la chaîne : si une réponse a été préparée, on la renvoie
        return Promise.resolve(context.finalResponse);
      }

      try {
        const next = () => dispatch(i + 1).then(() => {});
        const result = fn(context, next);

        return Promise.resolve(result).then((res) => {
          // Si le handler a retourné directement une Response
          if (res instanceof Response) {
            context.finalResponse = res;
            return res;
          }
          // Si le handler a retourné un objet/valeur JS sérialisable (autre qu'undefined)
          if (res !== undefined && context.finalResponse === null) {
            return context.json(res);
          }
          return context.finalResponse;
        });
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
