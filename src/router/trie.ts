/**
 * @file router/trie.ts
 * @description Implémentation d'un arbre préfixe (Radix Tree / Trie) sans dépendance.
 * Optimisé pour la résolution ultra-rapide des routes avec paramètres (:id) et jokers (*).
 */

import type { Handler, HttpMethod, RouteMatch, RouteParams } from "../types/index.js";

/**
 * Nœud d'arbre de routage.
 */
export class TrieNode {
  /**
   * Enfants statiques indexés par nom exact de segment (ex: 'users', 'posts').
   */
  public children: Map<string, TrieNode> = new Map();

  /**
   * Enfant dynamique pour les paramètres d'URL (ex: ':id', ':userId').
   */
  public paramChild: TrieNode | null = null;

  /**
   * Nom du paramètre associé à ce nœud (sans le ':' préfixe).
   */
  public paramName: string | null = null;

  /**
   * Enfant joker pour les routes attrape-tout (ex: '*').
   */
  public wildcardChild: TrieNode | null = null;

  /**
   * Gestionnaires enregistrés pour ce nœud par méthode HTTP.
   */
  public handlers: Map<HttpMethod, Handler[]> = new Map();

  /**
   * Middlewares spécifiques associés à ce nœud (exécutés pour les sous-chemins).
   */
  public middlewares: Handler[] = [];

  constructor(public segment: string = "") {}

  /**
   * Enregistre un gestionnaire pour une méthode HTTP spécifique sur ce nœud.
   */
  public addHandler(method: HttpMethod, handler: Handler): void {
    const list = this.handlers.get(method) ?? [];
    list.push(handler);
    this.handlers.set(method, list);
  }

  /**
   * Récupère la liste des gestionnaires pour une méthode donnée,
   * incluant les gestionnaires pour 'ALL' s'ils existent.
   */
  public getHandlers(method: HttpMethod): Handler[] {
    const methodHandlers = this.handlers.get(method) ?? [];
    const allHandlers = method !== "ALL" ? this.handlers.get("ALL") ?? [] : [];
    return [...allHandlers, ...methodHandlers];
  }
}

/**
 * Arbre de routage complet.
 */
export class RadixRouter {
  private root: TrieNode = new TrieNode();

  /**
   * Normalise un chemin URL en découpant les segments sans slashes superflus.
   * Ex: "/api/users/:id/" -> ["api", "users", ":id"]
   */
  private splitPath(path: string): string[] {
    const cleaned = path.trim().replace(/^\/+|\/+$/g, "");
    if (cleaned === "") return [];
    return cleaned.split("/");
  }

  /**
   * Enregistre une route avec sa méthode HTTP et ses gestionnaires.
   *
   * @param method Méthode HTTP ("GET", "POST", "ALL", etc.)
   * @param path Chemin de la route (ex: "/api/users/:id")
   * @param handlers Gestionnaires ou middlewares à exécuter
   */
  public insert(method: HttpMethod, path: string, ...handlers: Handler[]): void {
    const segments = this.splitPath(path);
    let current = this.root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // Segment Joker (Wildcard) : capture tout le reste
      if (seg === "*") {
        if (!current.wildcardChild) {
          current.wildcardChild = new TrieNode("*");
        }
        current = current.wildcardChild;
        break; // Le wildcard termine l'analyse
      }

      // Segment Paramétrique : commence par ':'
      if (seg.startsWith(":")) {
        const paramName = seg.slice(1);
        if (!current.paramChild) {
          current.paramChild = new TrieNode(seg);
          current.paramChild.paramName = paramName;
        }
        current = current.paramChild;
      } else {
        // Segment Statique classique
        let child = current.children.get(seg);
        if (!child) {
          child = new TrieNode(seg);
          current.children.set(seg, child);
        }
        current = child;
      }
    }

    // Ajout des gestionnaires sur le nœud final
    for (const handler of handlers) {
      current.addHandler(method, handler);
    }
  }

  /**
   * Recherche et fait correspondre une méthode HTTP et un chemin.
   *
   * @param method Méthode HTTP de la requête entrante
   * @param path Chemin URL demandé (pathname)
   * @returns RouteMatch contenant les handlers et les paramètres extraits, ou null.
   */
  public match(method: HttpMethod, path: string): RouteMatch | null {
    const segments = this.splitPath(path);
    const params: RouteParams = {};

    const matchedNode = this.search(this.root, segments, 0, params);
    if (!matchedNode) {
      return null;
    }

    const handlers = matchedNode.getHandlers(method);
    if (handlers.length === 0) {
      return null;
    }

    return {
      handlers,
      params,
    };
  }

  /**
   * Recherche récursive avec backtracking pour supporter les priorités :
   * 1. Correspondance statique exacte (priorité haute)
   * 2. Correspondance de paramètre dynamique (:param)
   * 3. Correspondance joker (*)
   */
  private search(
    node: TrieNode,
    segments: string[],
    index: number,
    params: RouteParams
  ): TrieNode | null {
    // Si tous les segments ont été consommés
    if (index === segments.length) {
      return node;
    }

    const currentSegment = segments[index];

    // 1. Essai de correspondance Statique
    const staticChild = node.children.get(currentSegment);
    if (staticChild) {
      const result = this.search(staticChild, segments, index + 1, params);
      if (result) return result;
    }

    // 2. Essai de correspondance Paramétrique (:id)
    if (node.paramChild) {
      const paramName = node.paramChild.paramName!;
      params[paramName] = decodeURIComponent(currentSegment);
      const result = this.search(node.paramChild, segments, index + 1, params);
      if (result) return result;
      // Nettoyage en cas de backtracking
      delete params[paramName];
    }

    // 3. Essai de correspondance Joker (*)
    if (node.wildcardChild) {
      // Le wildcard capture le reste des segments joints par des slashes
      params["*"] = segments.slice(index).map(decodeURIComponent).join("/");
      return node.wildcardChild;
    }

    return null;
  }
}
