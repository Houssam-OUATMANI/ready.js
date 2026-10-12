/**
 * @file example/server.ts
 * @description Complete example RESTful application built with Ready.
 * Natively compatible with Node.js, Bun, and Deno without code modifications.
 */

import { Ready } from "ready";

const app = new Ready();

// 1. Global Middleware: Response time calculation and request logging
app.use(async (c, next) => {
  const start = performance.now();
  await next();
  const duration = (performance.now() - start).toFixed(2);
  c.header("X-Response-Time", `${duration}ms`);
  console.log(`[${c.req.method}] ${c.req.pathname} -> ${c.getStatusCode()} (${duration}ms)`);
});

// 2. Path-scoped Middleware: CORS headers on /api/*
app.use("/api/*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  await next();
});

// 3. Health check route
app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    uptime: process.uptime ? process.uptime() : undefined,
    timestamp: new Date().toISOString(),
  });
});

// 4. GET route with typed parameter & automatic runtime coercion
app.get("/api/users/:id", (c) => {
  // 'id' is typed as number and automatically converted at runtime ("42" -> 42)
  const id = c.req.param<number>("id");

  // 'limit' and 'active' extracted from query string with automatic type coercion
  const limit = c.req.query<number>("limit") ?? 10;
  const active = c.req.query<boolean>("active") ?? true;

  return c.json({
    id,
    typeOfId: typeof id, // "number"
    limit,
    active,
    name: `User #${id}`,
  });
});

// 5. POST route with typed JSON request body
interface CreateUserDto {
  name: string;
  email: string;
  age?: number;
}

app.post("/api/users", async (c) => {
  // Directly parse and type the JSON body
  const payload = await c.req.body<CreateUserDto>();

  if (!payload.name || !payload.email) {
    return c.json(
      {
        error: "ValidationError",
        message: "Fields 'name' and 'email' are required",
      },
      400
    );
  }

  return c.json(
    {
      id: Math.floor(Math.random() * 1000) + 1,
      ...payload,
      createdAt: new Date().toISOString(),
    },
    201
  );
});

// 6. Modular sub-application for authentication
const authRouter = new Ready();
authRouter.post("/login", (c) => {
  return c.json({ token: "jwt_token_demo_ready", expiresIn: 3600 });
});
app.route("/api/auth", authRouter);

// 7. Universal HTTP server startup
const server = await app.listen({ port: 3000 });
console.log(`🚀 Ready server listening on http://${server.hostname}:${server.port}`);
