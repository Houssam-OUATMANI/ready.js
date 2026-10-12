/**
 * @file middleware/compose.ts
 * @description Cascading middleware pipeline execution engine (Onion Model).
 * Allows each middleware to execute code before and after downstream handlers via `await next()`.
 */

import type { Context } from "../context.js";
import type { Handler, Middleware } from "../types/index.js";

/**
 * Composes an array of middlewares and handlers into a single asynchronous pipeline.
 *
 * @param middlewares Ordered list of middleware/handler functions
 * @returns A composite function taking the context and executing the chain
 */
export function compose(middlewares: Array<Middleware | Handler>) {
  return function dispatchChain(context: Context): Promise<Response | unknown> {
    let lastIndex = -1;

    function dispatch(i: number): Promise<Response | unknown> {
      if (i <= lastIndex) {
        return Promise.reject(new Error("next() was called multiple times in the same middleware"));
      }
      lastIndex = i;

      const fn = middlewares[i];
      if (!fn) {
        // End of the chain: if a response has already been created, return it
        return Promise.resolve(context.finalResponse);
      }

      try {
        const next = () => dispatch(i + 1).then(() => {});
        const result = fn(context, next);

        return Promise.resolve(result).then((res) => {
          // If the handler returned a Response directly
          if (res instanceof Response) {
            context.resHeaders.forEach((val, key) => {
              if (!res.headers.has(key)) {
                try {
                  res.headers.set(key, val);
                } catch {
                  // Ignore if headers are immutable
                }
              }
            });
            context.finalResponse = res;
            return res;
          }
          // If the handler returned a serializable non-undefined value
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
