/**
 * @file app.ts
 * @description Classe principale Ready représentant l'application HTTP.
 * Fournit l'API déclarative pour les routes, les middlewares, la gestion d'erreurs
 * et l'interface universelle Web Standard `app.fetch()`.
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
   * Gestionnaire de routage interne.
   */
  public readonly router: Router = new Router();

  /**
   * Gestionnaire d'erreurs 404 personnalisé.
   */
  private notFoundHandler: NotFoundHandler = (c: Context) => {
    return c.json(
      {
        error: "NotFound",
        message: `Route introuvable : ${c.req.method} ${c.req.pathname}`,
      },
      404
    );
  };

  /**
   * Gestionnaire d'erreurs globales (500).
   */
  private errorHandler: ErrorHandler = (err: Error, c: Context) => {
    return c.json(
      {
        error: "InternalServerError",
        message: err.message || "Une erreur inattendue est survenue",
      },
      500
    );
  };

  /**
   * Enregistre un middleware global ou lié à un préfixe d'URL.
   *
   * @param prefixOrMiddleware Préfixe optionnel (ex: "/api") ou middleware
   * @param handlers Middlewares supplémentaires
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
   * Déclare une route HTTP GET.
   */
  public get(path: string, ...handlers: Handler[]): this {
    this.router.add("GET", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route HTTP POST.
   */
  public post(path: string, ...handlers: Handler[]): this {
    this.router.add("POST", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route HTTP PUT.
   */
  public put(path: string, ...handlers: Handler[]): this {
    this.router.add("PUT", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route HTTP PATCH.
   */
  public patch(path: string, ...handlers: Handler[]): this {
    this.router.add("PATCH", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route HTTP DELETE.
   */
  public delete(path: string, ...handlers: Handler[]): this {
    this.router.add("DELETE", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route HTTP OPTIONS.
   */
  public options(path: string, ...handlers: Handler[]): this {
    this.router.add("OPTIONS", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route HTTP HEAD.
   */
  public head(path: string, ...handlers: Handler[]): this {
    this.router.add("HEAD", path, ...handlers);
    return this;
  }

  /**
   * Déclare une route répondant à toutes les méthodes HTTP.
   */
  public all(path: string, ...handlers: Handler[]): this {
    this.router.add("ALL", path, ...handlers);
    return this;
  }

  /**
   * Monte une sous-application sous un préfixe d'URL pour modulariser l'API.
   *
   * @param prefix Préfixe de montage (ex: "/api/v1")
   * @param subApp Instance Ready de la sous-application
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
   * Définit un gestionnaire personnalisé pour les erreurs non interceptées.
   *
   * @param handler Fonction prenant l'erreur et le contexte
   */
  public onError(handler: ErrorHandler): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Définit un gestionnaire personnalisé pour les requêtes 404 Not Found.
   *
   * @param handler Fonction prenant le contexte
   */
  public notFound(handler: NotFoundHandler): this {
    this.notFoundHandler = handler;
    return this;
  }

  /**
   * Point d'entrée standard Web (Fetch API).
   * Compatible nativement avec Bun.serve, Deno.serve, Cloudflare Workers
   * et via notre adaptateur natif node:http sous Node.js.
   *
   * @param request Instance standard Request du Web
   * @returns Promesse résolue avec l'instance standard Response
   */
  public fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const method = request.method.toUpperCase() as HttpMethod;
    const pathname = url.pathname;

    // 1. Recherche d'une correspondance de route
    const match = this.router.match(method, pathname);

    if (!match) {
      // Exécution des middlewares applicables au chemin avant le 404 (ex: headers CORS)
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
          return (
            c.finalResponse ??
            c.json(
              { error: "NotFound", message: `Route introuvable : ${method} ${pathname}` },
              404
            )
          );
        }

        const notFoundRes = await this.notFoundHandler(c);
        if (notFoundRes instanceof Response) return notFoundRes;
        return c.finalResponse ?? c.json(notFoundRes ?? { error: "NotFound" }, 404);
      } catch (err) {
        return this.handleCatch(err as Error, c);
      }
    }

    // 2. Route trouvée : initialisation du contexte avec les paramètres extraits
    const c = new Context(request, match.params);

    try {
      const chain = compose(match.handlers);
      await chain(c);

      if (c.finalResponse) {
        return c.finalResponse;
      }

      // Si aucun contenu n'a été émis explicitement
      return c.json({ success: true }, 200);
    } catch (err) {
      return this.handleCatch(err as Error, c);
    }
  };

  /**
   * Traite les erreurs levées dans le pipeline en exécutant l'errorHandler configuré.
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
      // Secours ultime si l'errorHandler lui-même échoue
      return new Response(
        JSON.stringify({
          error: "InternalServerError",
          message: (fallbackError as Error).message || "Erreur fatale",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
  }

  /**
   * Démarre le serveur HTTP sur le port et l'hôte spécifiés.
   * Détecte automatiquement l'environnement d'exécution (Bun, Node.js, Deno).
   *
   * @param options Options d'écoute (port, hostname)
   * @returns Instance du serveur actif avec méthode .close()
   */
  public async listen(options?: ServerOptions): Promise<ServerInstance> {
    return serve(this, options);
  }
}
