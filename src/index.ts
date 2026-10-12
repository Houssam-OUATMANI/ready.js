/**
 * @file index.ts
 * @description Main entrypoint for the Ready micro-framework.
 * Exports the Ready application class, Context, Request, and all core types.
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

// Default export
import { Ready } from "./app.js";
export default Ready;
