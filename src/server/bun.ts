/**
 * @file server/bun.ts
 * @description High-performance native HTTP server adapter for Bun (Bun.serve).
 * Leverages Bun's native C++ HTTP engine without emulation layers.
 */

import type { Ready } from "../app.js";
import type { ServerInstance, ServerOptions } from "../types/index.js";

// Global type declaration for the Bun runtime environment
declare const Bun: {
  serve: (options: {
    port?: number;
    hostname?: string;
    fetch: (req: Request) => Response | Promise<Response>;
  }) => {
    port: number;
    hostname: string;
    stop: (closeActiveConnections?: boolean) => void;
  };
};

/**
 * Starts the server using Bun's high-speed native Bun.serve() API.
 *
 * @param app Ready application instance
 * @param options Server listening options
 */
export function serveBun(app: Ready, options: ServerOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const hostname = options.hostname ?? "0.0.0.0";

  const server = Bun.serve({
    port,
    hostname,
    fetch: app.fetch,
  });

  return Promise.resolve({
    port: server.port,
    hostname: server.hostname,
    close: () => {
      server.stop(true);
    },
  });
}
