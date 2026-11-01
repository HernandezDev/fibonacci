import { hc } from "hono/client";

import type { AppType } from "../../workers/api"; // import type, nunca valores

// Mismo origen: la cookie de sesión viaja sola.
export const api = hc<AppType>("/").api;
