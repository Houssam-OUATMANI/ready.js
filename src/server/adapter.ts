/**
 * @file server/adapter.ts
 * @description Universal multi-runtime detector and adapter (Bun, Deno, Node.js).
 * Automatically selects the fastest native networking layer with zero configuration.
 */

import type { Ready } from "../app.js";
import type { ServerInstance, ServerOptions } from "../types/index.js";
import { serveNode } from "./node.js";
import { serveBun } from "./bun.js";

// Global declarations for Bun and Deno environments
declare const Bun: {
  serve?: unknown;
} | undefined;

declare const Deno: {
  serve?: (
    options: { port?: number; hostname?: string },
    handler: (req: Request) => Response | Promise<Response>
  ) => {
    shutdown: () => Promise<void>;
  };
} | undefined;

/**
 * Boots the Ready application on the appropriate server based on the active runtime.
 *
 * @param app Ready application instance
 * @param options Server listening options (port, hostname)
 * @returns Unified ServerInstance
 */
export async function serve(app: Ready, options: ServerOptions = {}): Promise<ServerInstance> {
  // 1. Detect Bun runtime
  if (typeof Bun !== "undefined" && typeof Bun.serve === "function") {
    return serveBun(app, options);
  }

  // 2. Detect Deno runtime
  if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
    const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
    const hostname = options.hostname ?? "0.0.0.0";

    const server = Deno.serve({ port, hostname }, app.fetch);
    return {
      port,
      hostname,
      close: async () => {
        await server.shutdown();
      },
    };
  }

  // 3. Fallback to native Node.js (via node:http)
  return serveNode(app, options);
}
