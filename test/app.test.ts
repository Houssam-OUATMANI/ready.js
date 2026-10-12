/**
 * @file test/app.test.ts
 * @description Integration tests for Ready application via the standard app.fetch() API.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Ready } from "../src/app.js";

describe("Ready Application Core", () => {
  test("responds to GET with JSON payload and correct headers", async () => {
    const app = new Ready();
    app.get("/ping", (c) => c.json({ message: "pong" }));

    const req = new Request("http://localhost/ping");
    const res = await app.fetch(req);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("Content-Type"), "application/json; charset=utf-8");

    const data = await res.json();
    assert.deepStrictEqual(data, { message: "pong" });
  });

  test("extracts and coerces URL parameters via c.req.param<T>()", async () => {
    const app = new Ready();
    app.get("/users/:id", (c) => {
      const id = c.req.param<number>("id");
      return c.json({
        id,
        type: typeof id,
      });
    });

    const req = new Request("http://localhost/users/123");
    const res = await app.fetch(req);
    const data = await res.json();

    assert.strictEqual(data.id, 123);
    assert.strictEqual(data.type, "number");
  });

  test("extracts and coerces query parameters via c.req.query<T>()", async () => {
    const app = new Ready();
    app.get("/search", (c) => {
      const limit = c.req.query<number>("limit");
      const active = c.req.query<boolean>("active");
      const term = c.req.query("q");

      return c.json({ limit, active, term });
    });

    const req = new Request("http://localhost/search?limit=50&active=true&q=ready");
    const res = await app.fetch(req);
    const data = await res.json();

    assert.strictEqual(data.limit, 50);
    assert.strictEqual(data.active, true);
    assert.strictEqual(data.term, "ready");
  });

  test("parses JSON request body via c.req.body<T>()", async () => {
    interface CreateItemDto {
      name: string;
      price: number;
    }

    const app = new Ready();
    app.post("/items", async (c) => {
      const payload = await c.req.body<CreateItemDto>();
      return c.json({ created: payload }, 201);
    });

    const req = new Request("http://localhost/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Widget", price: 19.99 }),
    });

    const res = await app.fetch(req);
    assert.strictEqual(res.status, 201);

    const data = await res.json();
    assert.deepStrictEqual(data.created, { name: "Widget", price: 19.99 });
  });

  test("executes middleware in onion order with await next()", async () => {
    const app = new Ready();
    const order: string[] = [];

    app.use(async (c, next) => {
      order.push("mw1_start");
      c.header("X-Custom", "Ready");
      await next();
      order.push("mw1_end");
    });

    app.use(async (c, next) => {
      order.push("mw2_start");
      await next();
      order.push("mw2_end");
    });

    app.get("/test", (c) => {
      order.push("handler");
      return c.json({ ok: true });
    });

    const req = new Request("http://localhost/test");
    const res = await app.fetch(req);

    assert.strictEqual(res.headers.get("X-Custom"), "Ready");
    assert.deepStrictEqual(order, [
      "mw1_start",
      "mw2_start",
      "handler",
      "mw2_end",
      "mw1_end",
    ]);
  });

  test("returns structured 404 JSON for non-existing routes", async () => {
    const app = new Ready();
    const req = new Request("http://localhost/not-found");
    const res = await app.fetch(req);

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, "NotFound");
  });

  test("catches errors and invokes onError handler", async () => {
    const app = new Ready();
    app.get("/boom", () => {
      throw new Error("Database connection unavailable");
    });

    const req = new Request("http://localhost/boom");
    const res = await app.fetch(req);

    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.strictEqual(data.error, "InternalServerError");
    assert.strictEqual(data.message, "Database connection unavailable");
  });

  test("supports modular sub-routing via app.route()", async () => {
    const app = new Ready();
    const api = new Ready();

    api.get("/version", (c) => c.json({ version: "1.0.0" }));
    app.route("/api/v1", api);

    const req = new Request("http://localhost/api/v1/version");
    const res = await app.fetch(req);
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.version, "1.0.0");
  });
});
