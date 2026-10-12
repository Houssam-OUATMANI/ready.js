/**
 * @file test/coercion.test.ts
 * @description Unit tests for automatic and explicit type coercion.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { coerceValue, coerceRecord } from "../src/utils/coercion.js";

describe("Coercion Utility", () => {
  test("coerces numeric strings to numbers", () => {
    assert.strictEqual(coerceValue("42"), 42);
    assert.strictEqual(coerceValue("3.14"), 3.14);
    assert.strictEqual(coerceValue("-10"), -10);
    assert.strictEqual(coerceValue("0"), 0);
  });

  test("coerces boolean strings to booleans", () => {
    assert.strictEqual(coerceValue("true"), true);
    assert.strictEqual(coerceValue("TRUE"), true);
    assert.strictEqual(coerceValue("false"), false);
    assert.strictEqual(coerceValue("FALSE"), false);
  });

  test("preserves regular strings", () => {
    assert.strictEqual(coerceValue("hello"), "hello");
    assert.strictEqual(coerceValue("admin"), "admin");
    assert.strictEqual(coerceValue(""), "");
  });

  test("applies custom transform functions", () => {
    const toBigInt = (v: string) => BigInt(v);
    assert.strictEqual(coerceValue("9007199254740993", toBigInt), 9007199254740993n);

    const toDate = (v: string) => new Date(v).getFullYear();
    assert.strictEqual(coerceValue("2026-10-12", toDate), 2026);
  });

  test("coerces record of parameters", () => {
    const raw = {
      id: "100",
      active: "true",
      name: "Alice",
      tags: ["42", "false", "test"],
    };

    const coerced = coerceRecord<any>(raw);
    assert.strictEqual(coerced.id, 100);
    assert.strictEqual(coerced.active, true);
    assert.strictEqual(coerced.name, "Alice");
    assert.deepStrictEqual(coerced.tags, [42, false, "test"]);
  });
});
