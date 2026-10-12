/**
 * @file router/router.ts
 * @description Couche de gestion du routage de l'application Ready.
 * Combine l'arbre Radix pour les routes précises et une liste de middlewares de préfixe.
 */

import { RadixRouter } from "./trie.js";
import type { Handler, HttpMethod, Middleware, RouteMatch } from "../types/index.js";

/**
 * Entrée de middleware avec son préfixe de chemin.
 */
interface MiddlewareEntry {
  prefix: string;
  middleware: Middleware;
}

/**
 * Gestionnaire de routage principal.
 */
export class Router {
  private radix = new RadixRouter();
  private middlewares: MiddlewareEntry[] = [];

  /**
   * Ajoute un middleware global ou ciblé par un préfixe de chemin.
   * Ex: use(middleware) ou use('/api', middleware)
   */
  public use(prefixOrMiddleware: string | Middleware, ...handlers: Middleware[]): void {
    let prefix = "/";
    let list: Middleware[] = [];

    if (typeof prefixOrMiddleware === "string") {
      prefix = prefixOrMiddleware;
      list = handlers;
    } else {
      list = [prefixOrMiddleware, ...handlers];
    }

    // Normalisation du préfixe
    const cleanPrefix = prefix.replace(/\/+$/, "") || "/";

    for (const mw of list) {
      this.middlewares.push({ prefix: cleanPrefix, middleware: mw });
    }
  }

  /**
   * Enregistre une route sur l'arbre de routage.
   */
  public add(method: HttpMethod, path: string, ...handlers: Handler[]): void {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    this.radix.insert(method, normalized, ...handlers);
  }

  /**
   * Trouve les middlewares correspondant à un chemin donné
   * (modèle hiérarchique : "/" matche tout, "/api" matche "/api/users", etc.).
   */
  public getMiddlewaresForPath(path: string): Middleware[] {
    const matched: Middleware[] = [];
    const normalized = path.startsWith("/") ? path : `/${path}`;

    for (const entry of this.middlewares) {
      if (entry.prefix === "/" || entry.prefix === "*") {
        matched.push(entry.middleware);
      } else if (
        normalized === entry.prefix ||
        normalized.startsWith(entry.prefix + "/")
      ) {
        matched.push(entry.middleware);
      }
    }

    return matched;
  }

  /**
   * Résout une requête HTTP entrante.
   *
   * @param method Méthode HTTP (ex: "GET", "POST")
   * @param path Chemin de la requête (pathname)
   * @returns Un objet RouteMatch contenant la chaîne complète (middlewares + handlers finaux) et les params.
   */
  public match(method: HttpMethod, path: string): RouteMatch | null {
    // 1. Recherche dans l'arbre pour les handlers finaux et extraction des paramètres (:id)
    const match = this.radix.match(method, path);

    // 2. Récupération des middlewares correspondant au préfixe
    const prefixMiddlewares = this.getMiddlewaresForPath(path);

    if (!match) {
      // Si aucun handler terminal ne matche, mais qu'il y a des middlewares applicables
      // on peut quand même retourner les middlewares (ex: 404 géré avec les en-têtes CORS appliqués)
      return null;
    }

    return {
      handlers: [...(prefixMiddlewares as Handler[]), ...match.handlers],
      params: match.params,
    };
  }
}
