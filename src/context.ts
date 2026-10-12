/**
 * @file context.ts
 * @description Objet Contexte (Context) passé aux middlewares et aux gestionnaires de route.
 * Centralise la requête entrante (c.req) et la construction de la réponse HTTP JSON (c.json).
 */

import { ReadyRequest } from "./request.js";

export class Context {
  /**
   * Wrapper typé de la requête HTTP entrante.
   */
  public readonly req: ReadyRequest;

  /**
   * En-têtes HTTP configurés pour la réponse.
   */
  public readonly resHeaders: Headers = new Headers();

  /**
   * Code de statut HTTP de la réponse (200 par défaut).
   */
  private _status: number = 200;

  /**
   * Données de contexte partagées entre middlewares (ex: utilisateur authentifié).
   */
  private state: Map<string, unknown> = new Map();

  /**
   * Réponse finale produite par c.json() ou retournée par un handler.
   */
  public finalResponse: Response | null = null;

  constructor(rawRequest: Request, params: Record<string, string> = {}) {
    this.req = new ReadyRequest(rawRequest, params);
  }

  /**
   * Modifie le code de statut HTTP de la réponse de manière fluide.
   *
   * @param code Code statut HTTP (ex: 200, 201, 400, 404, 500)
   * @example
   * c.status(201);
   */
  public status(code: number): this {
    this._status = code;
    return this;
  }

  /**
   * Récupère le code de statut HTTP actuellement configuré.
   */
  public getStatusCode(): number {
    return this._status;
  }

  /**
   * Ajoute ou remplace un en-tête HTTP dans la réponse.
   *
   * @param name Nom de l'en-tête (ex: "X-Response-Time", "Authorization")
   * @param value Valeur de l'en-tête
   * @example
   * c.header("Cache-Control", "no-store");
   */
  public header(name: string, value: string): this {
    this.resHeaders.set(name, value);
    return this;
  }

  /**
   * Stocke une valeur arbitraire dans le contexte (partage entre middlewares).
   *
   * @param key Clé d'identification
   * @param value Valeur à stocker
   * @example
   * c.set("user", { id: 1, role: "admin" });
   */
  public set(key: string, value: unknown): this {
    this.state.set(key, value);
    return this;
  }

  /**
   * Récupère une valeur stockée dans le contexte avec typage générique.
   *
   * @template T Type attendu de la valeur
   * @param key Clé d'identification
   * @example
   * const user = c.get<UserSession>("user");
   */
  public get<T = unknown>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /**
   * Construit et retourne une Response standard au format JSON.
   * Configure automatiquement le Content-Type à "application/json; charset=utf-8"
   * et applique tous les en-têtes personnalisés définis via c.header().
   *
   * @param data Données à sérialiser en JSON
   * @param status Code de statut HTTP optionnel (écrase le statut actuel)
   * @returns Instance standard Web Response
   *
   * @example
   * return c.json({ success: true, count: 5 });
   * return c.json({ error: "Introuvable" }, 404);
   */
  public json(data: unknown, status?: number): Response {
    if (status !== undefined) {
      this._status = status;
    }

    // Assurer le Content-Type JSON standard
    if (!this.resHeaders.has("Content-Type")) {
      this.resHeaders.set("Content-Type", "application/json; charset=utf-8");
    }

    const body = JSON.stringify(data);
    const response = new Response(body, {
      status: this._status,
      headers: this.resHeaders,
    });

    this.finalResponse = response;
    return response;
  }
}
