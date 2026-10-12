/**
 * @file test/router.test.ts
 * @description Unit tests for the Radix Tree and router coordinator.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RadixRouter } from "../src/router/trie.js";
import { Router } from "../src/router/router.js";

describe("Radix Router & Trie", () => {
  test("matches static paths", () => {
    const router = new RadixRouter();
    const h1 = () => ({ ok: true });
    router.insert("GET", "/api/users", h1);

    const match = router.match("GET", "/api/users");
    assert.ok(match);
    assert.strictEqual(match.handlers.length, 1);
    assert.strictEqual(match.handlers[0], h1);
    assert.deepStrictEqual(match.params, {});
  });

  test("extracts dynamic parameters (:id)", () => {
    const router = new RadixRouter();
    const h1 = () => ({});
    router.insert("GET", "/users/:id", h1);

    const match = router.match("GET", "/users/42");
    assert.ok(match);
    assert.strictEqual(match.params.id, "42");
  });

  test("extracts multiple parameters (:orgId/teams/:teamId)", () => {
    const router = new RadixRouter();
    const h = () => ({});
    router.insert("GET", "/orgs/:orgId/teams/:teamId", h);

    const match = router.match("GET", "/orgs/alpha/teams/beta");
    assert.ok(match);
    assert.strictEqual(match.params.orgId, "alpha");
    assert.strictEqual(match.params.teamId, "beta");
  });

  test("matches wildcards (*)", () => {
    const router = new RadixRouter();
    const h = () => ({});
    router.insert("GET", "/static/*", h);

    const match = router.match("GET", "/static/css/theme/dark.css");
    assert.ok(match);
    assert.strictEqual(match.params["*"], "css/theme/dark.css");
  });

  test("returns null for non-matching routes", () => {
    const router = new RadixRouter();
    router.insert("GET", "/api/v1/users", () => ({}));

    assert.strictEqual(router.match("POST", "/api/v1/users"), null);
    assert.strictEqual(router.match("GET", "/api/v1/posts"), null);
  });

  test("handles sub-router mount", () => {
    const mainRouter = new Router();
    const subRouter = new Router();

    const subHandler = () => ({});
    subRouter.add("GET", "/me", subHandler);

    mainRouter.mount("/api/auth", subRouter);

    const match = mainRouter.match("GET", "/api/auth/me");
    assert.ok(match);
    assert.strictEqual(match.handlers[0], subHandler);
  });
});
