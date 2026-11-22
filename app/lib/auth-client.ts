import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { Auth } from "../../workers/auth"; // import type, nunca valores
import { ac, roles } from "~/shared/permisos";

// Mismo origen: sin `baseURL`, usa el de la página y la cookie viaja sola.
// `adminClient` suma los campos del plugin (`role`, `banned`) a la sesión, e
// `inferAdditionalFields` los propios (`pais`, `formatoHora`, `zonaHoraria`),
// leídos del tipo `Auth`: en la 1.7,
// `createAuthClient` no recibe el tipo del servidor.
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles }), inferAdditionalFields<Auth>()],
});
