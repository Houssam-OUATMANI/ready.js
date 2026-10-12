/**
 * @file server/node.ts
 * @description Native HTTP server adapter for Node.js (zero external dependencies).
 * Bridges Node.js IncomingMessage and ServerResponse with standard Web Request and Response objects.
 */

import http from "node:http";
import { Readable } from "node:stream";
import type { Ready } from "../app.js";
import type { ServerInstance, ServerOptions } from "../types/index.js";

/**
 * Starts a native Node.js HTTP server using the built-in 'node:http' module.
 *
 * @param app Ready application instance
 * @param options Server port and hostname configuration
 * @returns Running server instance with a `.close()` method
 */
export function serveNode(app: Ready, options: ServerOptions = {}): Promise<ServerInstance> {
  const port = options.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
  const hostname = options.hostname ?? "0.0.0.0";

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        // 1. Reconstruct full request URL
        const host = req.headers.host || `${hostname}:${port}`;
        const protocol = "http";
        const url = new URL(req.url || "/", `${protocol}://${host}`);

        // 2. Convert Node.js headers to standard Web Headers
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value === undefined) continue;
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }

        // 3. Convert request body stream if allowed by method
        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const bodyStream = hasBody ? (Readable.toWeb(req) as ReadableStream) : null;

        // 4. Create standard Web Request instance
        const webRequest = new Request(url.toString(), {
          method: req.method,
          headers,
          body: bodyStream,
          // @ts-expect-error 'duplex' is required in Node.js when body is a stream
          duplex: "half",
        });

        // 5. Execute Ready application pipeline
        const webResponse = await app.fetch(webRequest);

        // 6. Write web response back to Node.js ServerResponse
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
        // Fallback for unexpected adapter-level errors
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
