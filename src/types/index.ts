/**
 * @file types/index.ts
 * @description Définitions des types fondamentaux du micro-framework Ready.
 * Conçu pour un typage strict et une expérience développeur fluide (DX).
 */

import type { Context } from "../context.js";

/**
 * Méthodes HTTP supportées par le routeur.
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

/**
 * Fonction de passage au middleware suivant dans la chaîne en oignon.
 */
export type NextFunction = () => Promise<void>;

/**
 * Type d'un gestionnaire de route standard (Handler).
 * Peut retourner une Response standard du Web ou des données JSON sérialisables.
 */
export type Handler = (
  c: Context
) => Response | Promise<Response> | unknown | Promise<unknown>;

/**
 * Type d'un Middleware.
 * Permet d'exécuter du code avant et après la suite de la chaîne via `await next()`.
 */
export type Middleware = (
  c: Context,
  next: NextFunction
) => Promise<void> | void | Promise<Response | unknown> | Response | unknown;

/**
 * Gestionnaire d'erreurs global.
 */
export type ErrorHandler = (
  err: Error,
  c: Context
) => Response | Promise<Response> | unknown | Promise<unknown>;

/**
 * Gestionnaire pour les routes non trouvées (404).
 */
export type NotFoundHandler = (
  c: Context
) => Response | Promise<Response> | unknown | Promise<unknown>;

/**
 * Paramètres d'URL extraits par le routeur.
 */
export type RouteParams = Record<string, string>;

/**
 * Résultat de recherche d'une route dans l'arbre Radix.
 */
export interface RouteMatch {
  handlers: Handler[];
  params: RouteParams;
}

/**
 * Options de démarrage du serveur HTTP.
 */
export interface ServerOptions {
  /**
   * Port d'écoute du serveur (par défaut: 3000 ou process.env.PORT).
   */
  port?: number;

  /**
   * Nom d'hôte ou adresse IP (par défaut: "0.0.0.0").
   */
  hostname?: string;
}

/**
 * Interface unifiée de l'instance de serveur retournée par listen().
 */
export interface ServerInstance {
  port: number;
  hostname: string;
  close: () => Promise<void> | void;
}
