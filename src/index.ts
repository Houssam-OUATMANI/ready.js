/**
 * @file index.ts
 * @description Point d'entrée principal du micro-framework Ready.
 * Exporte la classe Ready, le Contexte, la Requête et l'ensemble des types.
 */

export { Ready, Ready as ReadyApp } from "./app.js";
export { Context } from "./context.js";
export { ReadyRequest } from "./request.js";
export { RadixRouter, TrieNode } from "./router/trie.js";
export { Router } from "./router/router.js";
export { coerceValue, coerceRecord } from "./utils/coercion.js";

export type {
  HttpMethod,
  Handler,
  Middleware,
  NextFunction,
  ErrorHandler,
  NotFoundHandler,
  RouteParams,
  RouteMatch,
  ServerOptions,
  ServerInstance,
} from "./types/index.js";

// Export par défaut
import { Ready } from "./app.js";
export default Ready;
