/**
 * @file request.ts
 * @description HTTP Request wrapper (ReadyRequest).
 * Offers an ergonomic, strongly-typed API to retrieve URL parameters (param),
 * query string parameters (query), and JSON request body (body).
 */

import { coerceRecord, coerceValue, type ValueTransform } from "./utils/coercion.js";

/**
 * Route parameter map extracted from dynamic URL segments.
 */
export type RouteParams = Record<string, string>;

export class ReadyRequest {
  /**
   * Underlying native Web Standard Request instance.
   */
  public readonly raw: Request;

  /**
   * Full URL string of the incoming request.
   */
  public readonly url: string;

  /**
   * HTTP method in uppercase (e.g. "GET", "POST").
   */
  public readonly method: string;

  /**
   * URL pathname without search parameters (e.g. "/api/users/42").
   */
  public readonly pathname: string;

  /**
   * URL parameters extracted by the router (e.g. { id: "42" }).
   */
  public readonly params: RouteParams;

  /**
   * Cached parsed URL object.
   */
  private parsedUrl: URL;

  /**
   * Cached parsed JSON body to prevent duplicate stream reads.
   */
  private cachedBody: unknown = undefined;
  private bodyParsed: boolean = false;

  constructor(rawRequest: Request, params: RouteParams = {}) {
    this.raw = rawRequest;
    this.url = rawRequest.url;
    this.method = rawRequest.method.toUpperCase();
    this.params = params;

    // Standard URL parsing
    this.parsedUrl = new URL(this.url);
    this.pathname = this.parsedUrl.pathname;
  }

  /**
   * HTTP headers of the request.
   */
  public get headers(): Headers {
    return this.raw.headers;
  }

  /**
   * Retrieves a specific HTTP header value (case-insensitive).
   *
   * @param name Name of the header
   */
  public header(name: string): string | null {
    return this.raw.headers.get(name);
  }

  /**
   * Retrieves a dynamic URL parameter (:id, :slug, etc.) with generic typing
   * and automatic type coercion (e.g. "42" -> 42 when typed as number).
   *
   * @template T Expected return type (number, boolean, string, etc.)
   * @param name Name of the URL parameter (without the colon)
   * @param transform Optional custom conversion function
   * @returns The coerced parameter value, or undefined if not found
   *
   * @example
   * const id = c.req.param<number>("id"); // id is of type number
   * const code = c.req.param("code");     // code is of type string
   */
  public param<T = string>(name: string, transform?: ValueTransform<T>): T {
    const rawVal = this.params[name];
    return coerceValue<T>(rawVal, transform) as T;
  }

  /**
   * Retrieves all URL parameters as a typed object with automatic coercion.
   *
   * @template T Expected object type
   * @example
   * const params = c.req.allParams<{ id: number; role: string }>();
   */
  public allParams<T extends Record<string, unknown> = Record<string, unknown>>(): T {
    return coerceRecord<T>(this.params);
  }

  /**
   * Retrieves a query string parameter or the complete query object.
   *
   * - If a key is provided: extracts and automatically coerces the specific value.
   * - If no key is provided: returns the entire query key/value record with automatic coercion.
   *
   * @template T Expected return type for the single value or full object
   * @param name Optional query parameter key (e.g. "limit", "filter")
   * @param transform Optional custom conversion function
   *
   * @example
   * const limit = c.req.query<number>("limit"); // e.g. 25 (number)
   * const filters = c.req.query<{ limit: number; search: string }>();
   */
  public query<T = string>(name?: string, transform?: ValueTransform<T>): T {
    // Case 1: Specific query key requested
    if (name !== undefined) {
      const rawVal = this.parsedUrl.searchParams.get(name) ?? undefined;
      return coerceValue<T>(rawVal, transform) as T;
    }

    // Case 2: Full query object requested
    const queryObj: Record<string, string> = {};
    for (const [k, v] of this.parsedUrl.searchParams.entries()) {
      queryObj[k] = v;
    }
    return coerceRecord<T extends Record<string, unknown> ? T : Record<string, unknown>>(
      queryObj
    ) as unknown as T;
  }

  /**
   * Parses and extracts the request body as JSON.
   * Caches the result to support multiple sequential reads within middleware.
   *
   * @template T Expected JSON payload type
   * @throws Error If the body contains invalid JSON
   *
   * @example
   * const data = await c.req.body<CreateUserDto>();
   */
  public async body<T = unknown>(): Promise<T> {
    if (this.bodyParsed) {
      return this.cachedBody as T;
    }

    // Methods that typically do not contain a body
    if (this.method === "GET" || this.method === "HEAD") {
      this.cachedBody = {} as T;
      this.bodyParsed = true;
      return this.cachedBody as T;
    }

    try {
      const text = await this.raw.text();
      if (!text || text.trim() === "") {
        this.cachedBody = {} as T;
      } else {
        this.cachedBody = JSON.parse(text) as T;
      }
      this.bodyParsed = true;
      return this.cachedBody as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON syntax error";
      throw new Error(`Invalid JSON Body: ${message}`);
    }
  }
}
