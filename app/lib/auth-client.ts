import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, roles } from "./permisos";

// Mismo origen: sin `baseURL`, usa el de la página y la cookie viaja sola.
// `adminClient` suma los campos del plugin (`role`, `banned`) a la sesión.
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles })],
});
