/**
 * @file app.ts
 * @description Main Ready application class representing the HTTP micro-framework.
 * Provides declarative routing methods, middleware chaining, centralized error handling,
 * and the universal Web Standard `app.fetch()` interface.
 */

import { Context } from "./context.js";
import { compose } from "./middleware/compose.js";
import { Router } from "./router/router.js";
import type {
  ErrorHandler,
  Handler,
  HttpMethod,
  Middleware,
  NotFoundHandler,
  ServerOptions,
  ServerInstance,
} from "./types/index.js";
import { serve } from "./server/adapter.js";

export class Ready {
  /**
   * Internal routing coordinator and radix tree.
   */
  public readonly router: Router = new Router();

  /**
   * Default 404 Not Found error handler.
   */
  private notFoundHandler: NotFoundHandler = (c: Context) => {
    return c.json(
      {
        error: "NotFound",
        message: `Route not found: ${c.req.method} ${c.req.pathname}`,
      },
      404
    );
  };

  /**
   * Default centralized 500 Internal Server Error handler.
   */
  private errorHandler: ErrorHandler = (err: Error, c: Context) => {
    return c.json(
      {
        error: "InternalServerError",
        message: err.message || "An unexpected error occurred",
      },
      500
    );
  };

  /**
   * Registers a global middleware or one scoped to a URL path prefix.
   *
   * @param prefixOrMiddleware Optional path prefix (e.g. "/api") or middleware
   * @param handlers Additional middlewares
   *
   * @example
   * app.use(async (c, next) => { await next(); });
   * app.use("/api", authMiddleware);
   */
  public use(
    prefixOrMiddleware: string | Middleware,
    ...handlers: Middleware[]
  ): this {
    this.router.use(prefixOrMiddleware, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP GET route.
   */
  public get(path: string, ...handlers: Handler[]): this {
    this.router.add("GET", path, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP POST route.
   */
  public post(path: string, ...handlers: Handler[]): this {
    this.router.add("POST", path, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP PUT route.
   */
  public put(path: string, ...handlers: Handler[]): this {
    this.router.add("PUT", path, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP PATCH route.
   */
  public patch(path: string, ...handlers: Handler[]): this {
    this.router.add("PATCH", path, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP DELETE route.
   */
  public delete(path: string, ...handlers: Handler[]): this {
    this.router.add("DELETE", path, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP OPTIONS route.
   */
  public options(path: string, ...handlers: Handler[]): this {
    this.router.add("OPTIONS", path, ...handlers);
    return this;
  }

  /**
   * Registers an HTTP HEAD route.
   */
  public head(path: string, ...handlers: Handler[]): this {
    this.router.add("HEAD", path, ...handlers);
    return this;
  }

  /**
   * Registers a route matching all HTTP methods.
   */
  public all(path: string, ...handlers: Handler[]): this {
    this.router.add("ALL", path, ...handlers);
    return this;
  }

  /**
   * Mounts a sub-application under a URL prefix to modularize API endpoints.
   *
   * @param prefix Mount prefix (e.g. "/api/v1")
   * @param subApp Ready instance of the sub-application
   *
   * @example
   * const users = new Ready();
   * users.get("/", (c) => c.json([]));
   * app.route("/api/users", users);
   */
  public route(prefix: string, subApp: Ready): this {
    this.router.mount(prefix, subApp.router);
    return this;
  }

  /**
   * Overrides the global unhandled exception handler.
   *
   * @param handler Function accepting error and context
   */
  public onError(handler: ErrorHandler): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Overrides the global 404 Not Found handler.
   *
   * @param handler Function accepting context
   */
  public notFound(handler: NotFoundHandler): this {
    this.notFoundHandler = handler;
    return this;
  }

  /**
   * Web Standards Fetch API handler.
   * Natively compatible with Bun.serve, Deno.serve, Cloudflare Workers,
   * and Node.js via the zero-dependency node:http adapter.
   *
   * @param request Standard Web Request instance
   * @returns Promise resolving to a standard Web Response
   */
  public fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase() as HttpMethod;
    const pathname = url.pathname;

    // 1. Look for matching route in the router
    const match = this.router.match(method, pathname);

    if (!match) {
      // Execute any prefix middlewares before generating the 404 response (e.g. CORS headers)
      const prefixMiddlewares = this.router.getMiddlewaresForPath(pathname);
      const c = new Context(request, {});

      try {
        if (prefixMiddlewares.length > 0) {
          const chain = compose([
            ...prefixMiddlewares,
            async () => {
              const notFoundRes = await this.notFoundHandler(c);
              if (notFoundRes instanceof Response) return notFoundRes;
              if (notFoundRes !== undefined && c.finalResponse === null) return c.json(notFoundRes);
              return c.finalResponse;
            },
          ]);
          await chain(c);
          const response =
            c.finalResponse ??
            c.json(
              { error: "NotFound", message: `Route not found: ${method} ${pathname}` },
              404
            );
          c.resHeaders.forEach((value, name) => {
            if (!response.headers.has(name) || response.headers.get(name) !== value) {
              try {
                response.headers.set(name, value);
              } catch {}
            }
          });
          return response;
        }

        const notFoundRes = await this.notFoundHandler(c);
        if (notFoundRes instanceof Response) return notFoundRes;
        return c.finalResponse ?? c.json(notFoundRes ?? { error: "NotFound" }, 404);
      } catch (err) {
        return this.handleCatch(err as Error, c);
      }
    }

    // 2. Route matched: initialize context with extracted URL params
    const c = new Context(request, match.params);

    try {
      const chain = compose(match.handlers);
      await chain(c);

      if (c.finalResponse) {
        c.resHeaders.forEach((value, name) => {
          if (c.finalResponse && (!c.finalResponse.headers.has(name) || c.finalResponse.headers.get(name) !== value)) {
            try {
              c.finalResponse.headers.set(name, value);
            } catch {
              const headers = new Headers(c.finalResponse.headers);
              headers.set(name, value);
              c.finalResponse = new Response(c.finalResponse.body, {
                status: c.finalResponse.status,
                statusText: c.finalResponse.statusText,
                headers,
              });
            }
          }
        });
        return c.finalResponse;
      }

      // If no response was explicitly returned, default to empty 200 JSON
      return c.json({ success: true }, 200);
    } catch (err) {
      return this.handleCatch(err as Error, c);
    }
  };

  /**
   * Handles errors thrown during middleware or handler pipeline execution.
   */
  private async handleCatch(err: Error, c: Context): Promise<Response> {
    try {
      const res = await this.errorHandler(err, c);
      if (res instanceof Response) {
        return res;
      }
      return (
        c.finalResponse ??
        c.json(
          res ?? {
            error: "InternalServerError",
            message: err.message,
          },
          c.getStatusCode() >= 400 ? c.getStatusCode() : 500
        )
      );
    } catch (fallbackError) {
      // Fallback emergency response if the custom error handler itself throws
      return new Response(
        JSON.stringify({
          error: "InternalServerError",
          message: (fallbackError as Error).message || "Fatal Server Error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
  }

  /**
   * Starts the HTTP server on the specified port and hostname.
   * Automatically detects the runtime environment (Bun, Node.js, Deno).
   *
   * @param options Server listening options (port, hostname)
   * @returns Active server instance with a `.close()` method
   */
  public async listen(options?: ServerOptions): Promise<ServerInstance> {
    return serve(this, options);
  }
}
