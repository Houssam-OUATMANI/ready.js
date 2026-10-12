/**
 * @file test/server.test.ts
 * @description Real network socket listening and HTTP communication tests.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Ready } from "../src/app.js";

describe("Ready Server Network Listening", () => {
  test("starts server, receives real HTTP fetch, and closes cleanly", async () => {
    const app = new Ready();
    app.get("/api/status", (c) => c.json({ running: true, time: 123 }));

    // Port 0 lets the operating system assign an available ephemeral port
    const server = await app.listen({ port: 0, hostname: "127.0.0.1" });
    assert.ok(server.port > 0);

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/api/status`);
      assert.strictEqual(response.status, 200);

      const json = await response.json();
      assert.deepStrictEqual(json, { running: true, time: 123 });
    } finally {
      await server.close();
    }
  });
});
