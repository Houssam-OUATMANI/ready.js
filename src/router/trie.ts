/**
 * @file router/trie.ts
 * @description Zero-dependency Radix Tree / Trie router implementation.
 * Highly optimized for resolving routes with parameters (:id) and wildcards (*).
 */

import type { Handler, HttpMethod, RouteMatch, RouteParams } from "../types/index.js";

/**
 * Node within the Radix Tree structure.
 */
export class TrieNode {
  /**
   * Static child nodes indexed by exact path segment (e.g. 'users', 'posts').
   */
  public children: Map<string, TrieNode> = new Map();

  /**
   * Dynamic child node for URL parameters (e.g. ':id', ':userId').
   */
  public paramChild: TrieNode | null = null;

  /**
   * Parameter name associated with this node (without the leading ':').
   */
  public paramName: string | null = null;

  /**
   * Catch-all wildcard child node (e.g. '*').
   */
  public wildcardChild: TrieNode | null = null;

  /**
   * Handlers registered on this node grouped by HTTP method.
   */
  public handlers: Map<HttpMethod, Handler[]> = new Map();

  /**
   * Specific middlewares associated with this node (executed for sub-paths).
   */
  public middlewares: Handler[] = [];

  constructor(public segment: string = "") {}

  /**
   * Registers a handler for a given HTTP method on this node.
   */
  public addHandler(method: HttpMethod, handler: Handler): void {
    const list = this.handlers.get(method) ?? [];
    list.push(handler);
    this.handlers.set(method, list);
  }

  /**
   * Retrieves handlers registered for a given method,
   * including handlers assigned to 'ALL' if present.
   */
  public getHandlers(method: HttpMethod): Handler[] {
    const methodHandlers = this.handlers.get(method) ?? [];
    const allHandlers = method !== "ALL" ? this.handlers.get("ALL") ?? [] : [];
    return [...allHandlers, ...methodHandlers];
  }
}

/**
 * Radix Router managing route registration and matching.
 */
export class RadixRouter {
  private root: TrieNode = new TrieNode();

  /**
   * Normalizes a URL path by stripping redundant leading/trailing slashes.
   * Example: "/api/users/:id/" -> ["api", "users", ":id"]
   */
  private splitPath(path: string): string[] {
    const cleaned = path.trim().replace(/^\/+|\/+$/g, "");
    if (cleaned === "") return [];
    return cleaned.split("/");
  }

  /**
   * Inserts a route with its HTTP method and handlers into the trie.
   *
   * @param method HTTP method ("GET", "POST", "ALL", etc.)
   * @param path Route path string (e.g. "/api/users/:id")
   * @param handlers Handlers or middlewares to execute
   */
  public insert(method: HttpMethod, path: string, ...handlers: Handler[]): void {
    const segments = this.splitPath(path);
    let current = this.root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // Wildcard segment: matches anything remaining in the path
      if (seg === "*") {
        if (!current.wildcardChild) {
          current.wildcardChild = new TrieNode("*");
        }
        current = current.wildcardChild;
        break; // Wildcard terminates path traversal
      }

      // Parameter segment: starts with ':'
      if (seg.startsWith(":")) {
        const paramName = seg.slice(1);
        if (!current.paramChild) {
          current.paramChild = new TrieNode(seg);
          current.paramChild.paramName = paramName;
        }
        current = current.paramChild;
      } else {
        // Standard static segment
        let child = current.children.get(seg);
        if (!child) {
          child = new TrieNode(seg);
          current.children.set(seg, child);
        }
        current = child;
      }
    }

    // Attach handlers to the terminal node
    for (const handler of handlers) {
      current.addHandler(method, handler);
    }
  }

  /**
   * Matches an incoming HTTP method and path against the tree.
   *
   * @param method Incoming HTTP method
   * @param path Requested URL pathname
   * @returns RouteMatch containing handlers and extracted parameters, or null.
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
   * Recursive tree search with backtracking to observe priority:
   * 1. Exact static match (highest priority)
   * 2. Dynamic parameter match (:param)
   * 3. Catch-all wildcard match (*)
   */
  private search(
    node: TrieNode,
    segments: string[],
    index: number,
    params: RouteParams
  ): TrieNode | null {
    // If all segments have been successfully traversed
    if (index === segments.length) {
      return node;
    }

    const currentSegment = segments[index];

    // 1. Attempt static match
    const staticChild = node.children.get(currentSegment);
    if (staticChild) {
      const result = this.search(staticChild, segments, index + 1, params);
      if (result) return result;
    }

    // 2. Attempt parameterized match (:id)
    if (node.paramChild) {
      const paramName = node.paramChild.paramName!;
      params[paramName] = decodeURIComponent(currentSegment);
      const result = this.search(node.paramChild, segments, index + 1, params);
      if (result) return result;
      // Clean up parameter if backtracking
      delete params[paramName];
    }

    // 3. Attempt wildcard match (*)
    if (node.wildcardChild) {
      // Wildcard captures all remaining segments joined by '/'
      params["*"] = segments.slice(index).map(decodeURIComponent).join("/");
      return node.wildcardChild;
    }

    return null;
  }
}
