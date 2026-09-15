import { buildApp } from "./infrastructure/http/build-app.js";

const app = buildApp();
await app.listen({ port: Number(process.env["PORT"] ?? 3000), host: "0.0.0.0" });
