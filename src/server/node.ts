/**
 * @file server/node.ts
 * @description Adaptateur de serveur HTTP natif pour Node.js (zéro dépendance externe).
 * Convertit les flux IncomingMessage et ServerResponse en requêtes/réponses Web Standard.
 */

import http from "node:http";
import { Readable } from "node:stream";
import type { Ready } from "../app.js";
import type { ServerInstance, ServerOptions } from "../types/index.js";

/**
 * Démarre un serveur Node.js natif via le module 'node:http'.
 *
 * @param app Instance de l'application Ready
 * @param options Options de port et d'hôte
 * @returns Instance du serveur en écoute avec méthode close()
 */
export function serveNode(app: Ready, options: ServerOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const hostname = options.hostname ?? "0.0.0.0";

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        // 1. Reconstitution de l'URL complète
        const host = req.headers.host || `${hostname}:${port}`;
        const protocol = "http";
        const url = new URL(req.url || "/", `${protocol}://${host}`);

        // 2. Conversion des en-têtes Node vers Web Standard Headers
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value === undefined) continue;
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }

        // 3. Conversion du flux de corps si la méthode le permet
        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const bodyStream = hasBody ? (Readable.toWeb(req) as ReadableStream) : null;

        // 4. Création de l'objet Request Web Standard
        const webRequest = new Request(url.toString(), {
          method: req.method,
          headers,
          body: bodyStream,
          // @ts-expect-error 'duplex' est requis par Node.js lors de l'utilisation d'un ReadableStream
          duplex: "half",
        });

        // 5. Exécution du pipeline Ready
        const webResponse = await app.fetch(webRequest);

        // 6. Restitution de la réponse vers ServerResponse de Node
        res.statusCode = webResponse.status;
        webResponse.headers.forEach((val, key) => {
          res.setHeader(key, val);
        });

        if (webResponse.body) {
          const arrayBuffer = await webResponse.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } else {
          res.end();
        }
      } catch (err) {
        // Secours en cas d'erreur de bas niveau dans l'adaptateur
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: "AdapterError",
            message: (err as Error).message,
          })
        );
      }
    });

    server.once("error", reject);

    server.listen(port, hostname, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;

      resolve({
        port: actualPort,
        hostname,
        close: () => {
          return new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => {
              if (err) closeReject(err);
              else closeResolve();
            });
          });
        },
      });
    });
  });
}
