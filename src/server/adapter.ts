/**
 * @file server/adapter.ts
 * @description Détecteur et adaptateur multi-runtime universel (Bun, Deno, Node.js).
 * Choisit automatiquement la couche réseau la plus performante sans configuration requise.
 */

import type { Ready } from "../app.js";
import type { ServerInstance, ServerOptions } from "../types/index.js";
import { serveNode } from "./node.js";
import { serveBun } from "./bun.js";

// Déclaration de type pour l'environnement global Deno
declare const Deno: {
  serve: (
    options: { port?: number; hostname?: string },
    handler: (req: Request) => Response | Promise<Response>
  ) => {
    shutdown: () => Promise<void>;
  };
};

/**
 * Lance l'application Ready sur le serveur approprié selon le runtime détecté.
 *
 * @param app Instance de l'application Ready
 * @param options Options d'écoute (port, hostname)
 * @returns Instance unifiée ServerInstance
 */
export async function serve(app: Ready, options: ServerOptions = {}): Promise<ServerInstance> {
  // 1. Détection de Bun
  // @ts-expect-error Vérification globale de Bun
  if (typeof Bun !== "undefined" && typeof Bun.serve === "function") {
    return serveBun(app, options);
  }

  // 2. Détection de Deno
  // @ts-expect-error Vérification globale de Deno
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

  // 3. Repli par défaut sur Node.js (via node:http natif)
  return serveNode(app, options);
}
