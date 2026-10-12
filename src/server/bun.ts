/**
 * @file server/bun.ts
 * @description Adaptateur de serveur ultra-rapide pour Bun (Bun.serve).
 * Utilise les capacités natives de Bun sans aucune couche d'émulation.
 */

import type { Ready } from "../app.js";
import type { ServerInstance, ServerOptions } from "../types/index.js";

// Déclaration de type pour l'environnement global Bun
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
 * Démarre le serveur en utilisant l'API ultra-rapide native Bun.serve().
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
