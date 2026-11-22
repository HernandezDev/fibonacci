import { Outlet } from "react-router";

import { FormatoProvider } from "~/lib/formato";

// Layout sin URL de todas las rutas SPA (todo menos la landing). Monta lo que
// necesita la sesión, como el `FormatoProvider`, que la lee con `useSession`:
// en la landing eso haría que cada visita a `/` llame al Worker y a la base.
// No tiene `clientLoader`: cada ruta hija sigue mostrando su `HydrateFallback`.
export default function Spa() {
  return (
    <FormatoProvider>
      <Outlet />
    </FormatoProvider>
  );
}
