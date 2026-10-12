#  Ready

> **Zero-dependency, full TypeScript, multi-runtime micro-framework designed exclusively for RESTful JSON APIs.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Runtime: Node / Bun / Deno](https://img.shields.io/badge/Runtimes-Node%20%7C%20Bun%20%7C%20Deno-green.svg)](#)

---

##  Features

- **Zero Runtime Dependencies**: The entire HTTP, routing, coercion, and server adapter layer has 0 external runtime dependencies.
- **Multi-Runtime Ready**: Run seamlessly on **Bun**, **Node.js (18+)**, and **Deno** without changing a single line of code.
- **RESTful JSON Only**: Built exclusively for JSON APIs. No template engines, no HTML bloat, no session overhead.
- **Typed Parameter & Query Coercion**: Type and convert params on the fly:
  - `c.req.param<number>("id")` automatically parses `"42"` into `42`.
  - `c.req.query<boolean>("active")` automatically parses `"true"` into `true`.
- **Generic Typed Body Parsing**: `await c.req.body<CreateUserDto>()` for instant, strongly-typed JSON payload extraction.
- **Radix Tree Routing**: High-speed routing supporting static paths, parameterized segments (`:id`), and wildcards (`*`).
- **Onion-Model Middleware**: Koa/modern style middleware chaining with `await next()`.
- **Modular Sub-Routing**: Organize APIs cleanly using `app.route("/api/v1", subApp)`.
- **Centralized Error Handling**: Structured JSON error formatting for both 404 and unhandled 500 exceptions.

---

##  Installation

```bash
# Using bun
bun add ready-framework

# Using npm
npm install ready-framework

# Using pnpm
pnpm add ready-framework
```

---

## ⚡ Quick Start

```typescript
import { Ready } from "ready";

const app = new Ready();

// Global middleware: response time header & logger
app.use(async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(2);
  c.header("X-Response-Time", `${ms}ms`);
});

// GET with typed parameter & automatic conversion
app.get("/api/users/:id", (c) => {
  const id = c.req.param<number>("id"); // typeof id === "number"
  const limit = c.req.query<number>("limit") ?? 10;

  return c.json({
    id,
    limit,
    name: `User #${id}`,
  });
});

// POST with typed JSON body
interface CreateUserDto {
  name: string;
  email: string;
}

app.post("/api/users", async (c) => {
  const body = await c.req.body<CreateUserDto>();

  if (!body.name || !body.email) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  return c.json({ id: 1, ...body }, 201);
});

// Universal startup (Bun, Node.js, Deno)
const server = await app.listen({ port: 3000 });
console.log(`Server listening on http://${server.hostname}:${server.port}`);
```

---

##  API Reference

### 1. Request Handling (`c.req`)

#### `c.req.param<T>(name, transform?)`
Extracts a route parameter with automatic type coercion:
```typescript
// Automatic conversion
const id = c.req.param<number>("id");        // "123" -> 123 (number)
const active = c.req.param<boolean>("active"); // "true" -> true (boolean)

// Optional explicit transformer
const bigId = c.req.param("id", BigInt);     // BigInt("123")
```

#### `c.req.query<T>(name?, transform?)`
Extracts query parameters individually or as a complete typed object:
```typescript
// Single parameter
const limit = c.req.query<number>("limit"); // ?limit=25 -> 25

// Complete query object
interface Filters {
  limit: number;
  offset: number;
  active: boolean;
}
const filters = c.req.query<Filters>();
```

#### `c.req.body<T>()`
Parses incoming JSON body with generic typing and caching:
```typescript
interface UpdateUserDto {
  username?: string;
  role?: string;
}
const payload = await c.req.body<UpdateUserDto>();
```

---

### 2. Response Helpers (`c.json`)

#### `c.json(data, status?)`
Returns a standard `Response` formatted as `application/json; charset=utf-8`:
```typescript
return c.json({ status: "success" });
return c.json({ error: "Unauthorized" }, 401);
```

#### Fluent Response Modifiers
```typescript
c.status(201);
c.header("Cache-Control", "no-store");
c.set("sessionUser", user); // Share state between middlewares
const user = c.get<User>("sessionUser");
```

---

### 3. Middleware Pipeline

Ready uses the onion model (`await next()`):
```typescript
app.use(async (c, next) => {
  // Before downstream handler
  const start = Date.now();

  await next();

  // After downstream handler
  const duration = Date.now() - start;
  c.header("X-Duration", `${duration}ms`);
});

// Path-scoped middleware
app.use("/api/admin/*", async (c, next) => {
  const token = c.req.header("Authorization");
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
```

---

### 4. Modular Sub-Applications (`app.route`)

Group endpoints and nested routers cleanly:
```typescript
const auth = new Ready();
auth.post("/login", (c) => c.json({ token: "..." }));
auth.post("/logout", (c) => c.json({ success: true }));

app.route("/api/auth", auth);
// Exposed routes:
// POST /api/auth/login
// POST /api/auth/logout
```

---

### 5. Multi-Runtime Execution

Ready detects the runtime automatically when calling `app.listen({ port })`:

#### Bun
```bash
bun run example/server.ts
```

#### Node.js (v18+)
```bash
node dist/example/server.js
```

#### Web Standards Direct (`app.fetch`)
Ready exposes standard Fetch API `app.fetch(request)` directly, making it natively compatible with Edge platforms (Cloudflare Workers, Deno Deploy, Fastly, Bun):
```typescript
export default {
  fetch: app.fetch,
};
```

---

##  Testing

```bash
# Run tests with Node.js built-in test runner
npm test

# Run tests with Bun test runner
npm run test:bun
```

---

## License

MIT © [Ready](https://github.com/ready)
