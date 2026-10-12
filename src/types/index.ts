/**
 * @file types/index.ts
 * @description Core type definitions for the Ready micro-framework.
 * Designed for strict typing and an ergonomic developer experience (DX).
 */

import type { Context } from "../context.js";

/**
 * HTTP methods supported by the router.
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

/**
 * Function used to pass execution to the next middleware in the onion chain.
 */
export type NextFunction = () => Promise<void>;

/**
 * Standard route handler function.
 * Can return a standard Web Response or serializable JSON data.
 */
export type Handler = (
  c: Context
) => Response | Promise<Response> | unknown | Promise<unknown>;

/**
 * Middleware function.
 * Enables executing code before and after the downstream chain via `await next()`.
 */
export type Middleware = (
  c: Context,
  next: NextFunction
) => Promise<void> | void | Promise<Response | unknown> | Response | unknown;

/**
 * Centralized error handler.
 */
export type ErrorHandler = (
  err: Error,
  c: Context
) => Response | Promise<Response> | unknown | Promise<unknown>;

/**
 * Handler for unmatched routes (404 Not Found).
 */
export type NotFoundHandler = (
  c: Context
) => Response | Promise<Response> | unknown | Promise<unknown>;

/**
 * Route parameter map extracted from dynamic URL segments.
 */
export type RouteParams = Record<string, string>;

/**
 * Result returned upon matching an incoming route against the Radix tree.
 */
export interface RouteMatch {
  handlers: Handler[];
  params: RouteParams;
}

/**
 * Server startup configuration options.
 */
export interface ServerOptions {
  /**
   * Port on which the server should listen (default: 3000 or process.env.PORT).
   */
  port?: number;

  /**
   * Hostname or IP address to bind to (default: "0.0.0.0").
   */
  hostname?: string;
}

/**
 * Unified server instance returned by listen().
 */
export interface ServerInstance {
  port: number;
  hostname: string;
  close: () => Promise<void> | void;
}
