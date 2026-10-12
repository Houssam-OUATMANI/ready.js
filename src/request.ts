/**
 * @file request.ts
 * @description Wrapper de requête HTTP (ReadyRequest).
 * Offre une API fluide et typée pour extraire les paramètres d'URL (param),
 * les paramètres de recherche (query) et le corps JSON (body).
 */

import { coerceRecord, coerceValue, type ValueTransform } from "./utils/coercion.js";
import type { RouteParams } from "./types/index.js";

export class ReadyRequest {
  /**
   * Instance native Web Standard Request sous-jacente.
   */
  public readonly raw: Request;

  /**
   * URL complète de la requête.
   */
  public readonly url: string;

  /**
   * Méthode HTTP (ex: "GET", "POST").
   */
  public readonly method: string;

  /**
   * Chemin URL sans la query string (ex: "/api/users/42").
   */
  public readonly pathname: string;

  /**
   * Paramètres d'URL extraits par le routeur (ex: { id: "42" }).
   */
  public readonly params: RouteParams;

  /**
   * Cache de l'objet URL parsé.
   */
  private parsedUrl: URL;

  /**
   * Cache du corps JSON déjà parsé pour éviter les doubles lectures du flux.
   */
  private cachedBody: unknown = undefined;
  private bodyParsed: boolean = false;

  constructor(rawRequest: Request, params: RouteParams = {}) {
    this.raw = rawRequest;
    this.url = rawRequest.url;
    this.method = rawRequest.method.toUpperCase();
    this.params = params;

    // Analyse de l'URL standard
    this.parsedUrl = new URL(this.url);
    this.pathname = this.parsedUrl.pathname;
  }

  /**
   * En-têtes HTTP de la requête.
   */
  public get headers(): Headers {
    return this.raw.headers;
  }

  /**
   * Récupère la valeur d'un en-tête HTTP spécifique.
   *
   * @param name Nom de l'en-tête (insensible à la casse)
   */
  public header(name: string): string | null {
    return this.raw.headers.get(name);
  }

  /**
   * Récupère un paramètre d'URL dynamique (:id, :slug, etc.) avec typage générique
   * et conversion automatique (ex: "42" -> 42 si number).
   *
   * @template T Type attendu (number, boolean, string, etc.)
   * @param name Nom du paramètre d'URL (sans les deux-points)
   * @param transform Fonction de conversion personnalisée optionnelle
   * @returns La valeur convertie ou undefined si inexistante
   *
   * @example
   * const id = c.req.param<number>("id"); // id est de type number
   * const code = c.req.param("code");     // code est de type string
   */
  public param<T = string>(name: string, transform?: ValueTransform<T>): T {
    const rawVal = this.params[name];
    return coerceValue<T>(rawVal, transform) as T;
  }

  /**
   * Récupère tous les paramètres d'URL sous forme d'un objet typé
   * avec conversion automatique de leurs valeurs.
   *
   * @template T Type de l'objet attendu
   * @example
   * const params = c.req.allParams<{ id: number; role: string }>();
   */
  public allParams<T extends Record<string, unknown> = Record<string, unknown>>(): T {
    return coerceRecord<T>(this.params);
  }

  /**
   * Récupère un paramètre de la query string ou l'ensemble de la query string.
   *
   * - Si une clé est fournie : extrait et convertit automatiquement la valeur.
   * - Si aucune clé n'est fournie : extrait et convertit l'ensemble des paires clé/valeur.
   *
   * @template T Type attendu pour la valeur ou pour l'objet global
   * @param name Nom du paramètre query optionnel (ex: "limit", "filter")
   * @param transform Fonction de conversion personnalisée optionnelle
   *
   * @example
   * const limit = c.req.query<number>("limit"); // ex: 25
   * const filters = c.req.query<{ limit: number; search: string }>();
   */
  public query<T = string>(name?: string, transform?: ValueTransform<T>): T {
    // Cas 1 : Récupération d'une clé spécifique
    if (name !== undefined) {
      const rawVal = this.parsedUrl.searchParams.get(name) ?? undefined;
      return coerceValue<T>(rawVal, transform) as T;
    }

    // Cas 2 : Récupération de l'objet query complet
    const queryObj: Record<string, string> = {};
    for (const [k, v] of this.parsedUrl.searchParams.entries()) {
      queryObj[k] = v;
    }
    return coerceRecord<T extends Record<string, unknown> ? T : Record<string, unknown>>(
      queryObj
    ) as unknown as T;
  }

  /**
   * Analyse et extrait le corps de la requête sous format JSON.
   * Met en cache le résultat pour permettre plusieurs lectures consécutives.
   *
   * @template T Type attendu du payload JSON
   * @throws Error Si le corps n'est pas un JSON valide
   *
   * @example
   * const data = await c.req.body<CreateUserDto>();
   */
  public async body<T = unknown>(): Promise<T> {
    if (this.bodyParsed) {
      return this.cachedBody as T;
    }

    // Si la méthode ne comporte généralement pas de corps
    if (this.method === "GET" || this.method === "HEAD") {
      this.cachedBody = {} as T;
      this.bodyParsed = true;
      return this.cachedBody as T;
    }

    try {
      const text = await this.raw.text();
      if (!text || text.trim() === "") {
        this.cachedBody = {} as T;
      } else {
        this.cachedBody = JSON.parse(text) as T;
      }
      this.bodyParsed = true;
      return this.cachedBody as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de syntaxe JSON";
      throw new Error(`JSON Body invalide : ${message}`);
    }
  }
}
