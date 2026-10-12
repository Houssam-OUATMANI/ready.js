/**
 * @file router/router.ts
 * @description Routing management layer for the Ready application.
 * Combines the Radix Tree for endpoint matching, prefix-based middlewares,
 * and modular sub-application mounting (route).
 */

import { RadixRouter } from "./trie.js";
import type { Handler, HttpMethod, Middleware, RouteMatch } from "../types/index.js";

/**
 * Middleware entry with its URL path prefix.
 */
export interface MiddlewareEntry {
  prefix: string;
  middleware: Middleware;
}

/**
 * Registered route definition metadata.
 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlers: Handler[];
}

/**
 * Primary routing coordinator.
 */
export class Router {
  private radix = new RadixRouter();
  public readonly middlewares: MiddlewareEntry[] = [];
  public readonly routes: RouteDefinition[] = [];

  /**
   * Adds a global or prefix-targeted middleware.
   * Example: use(middleware) or use('/api', middleware)
   */
  public use(prefixOrMiddleware: string | Middleware, ...handlers: Middleware[]): void {
    let prefix = "/";
    let list: Middleware[] = [];

    if (typeof prefixOrMiddleware === "string") {
      prefix = prefixOrMiddleware;
      list = handlers;
    } else {
      list = [prefixOrMiddleware, ...handlers];
    }

    // Normalize prefix
    const cleanPrefix = prefix.replace(/\/+$/, "") || "/";

    for (const mw of list) {
      this.middlewares.push({ prefix: cleanPrefix, middleware: mw });
    }
  }

  /**
   * Registers a route in the radix routing tree.
   */
  public add(method: HttpMethod, path: string, ...handlers: Handler[]): void {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    this.routes.push({ method, path: normalized, handlers });
    this.radix.insert(method, normalized, ...handlers);
  }

  /**
   * Mounts the routes and middlewares of a sub-router under a designated prefix.
   *
   * @param prefix Mount prefix (e.g. "/api/v1")
   * @param subRouter Sub-router to incorporate
   */
  public mount(prefix: string, subRouter: Router): void {
    const cleanBase = prefix.replace(/\/+$/, "");

    // 1. Mount sub-router middlewares
    for (const mw of subRouter.middlewares) {
      const combinedPrefix = mw.prefix === "/" ? cleanBase : `${cleanBase}${mw.prefix}`;
      this.use(combinedPrefix, mw.middleware);
    }

    // 2. Mount sub-router routes
    for (const route of subRouter.routes) {
      const combinedPath = route.path === "/" ? cleanBase : `${cleanBase}${route.path}`;
      this.add(route.method, combinedPath, ...route.handlers);
    }
  }

  /**
   * Finds middlewares matching a specific path.
   * Follows hierarchical prefix matching: "/" matches everything,
   * "/api" matches "/api/users", etc.
   */
  public getMiddlewaresForPath(path: string): Middleware[] {
    const matched: Middleware[] = [];
    const normalized = path.startsWith("/") ? path : `/${path}`;

    for (const entry of this.middlewares) {
      if (entry.prefix === "/" || entry.prefix === "*") {
        matched.push(entry.middleware);
      } else if (
        normalized === entry.prefix ||
        normalized.startsWith(entry.prefix + "/")
      ) {
        matched.push(entry.middleware);
      }
    }

    return matched;
  }

  /**
   * Resolves an incoming HTTP request.
   *
   * @param method HTTP method (e.g. "GET", "POST")
   * @param path Request pathname
   * @returns RouteMatch containing middleware + route handlers and extracted params, or null.
   */
  public match(method: HttpMethod, path: string): RouteMatch | null {
    // 1. Search the trie for matching endpoint handlers and extract parameters (:id)
    const match = this.radix.match(method, path);

    // 2. Retrieve applicable prefix middlewares
    const prefixMiddlewares = this.getMiddlewaresForPath(path);

    if (!match) {
      return null;
    }

    return {
      handlers: [...(prefixMiddlewares as Handler[]), ...match.handlers],
      params: match.params,
    };
  }
}
