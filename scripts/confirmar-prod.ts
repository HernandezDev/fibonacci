// Pide confirmación antes de migrar la rama `production`. Sale con error si no
// se confirma, así que el `&&` de `npm run db:migrate:prod` no llega a migrar.
import { createInterface } from "node:readline/promises";

const cadena = process.env.PROD_DATABASE_URL;
if (!cadena) {
  console.error("Falta PROD_DATABASE_URL (cadena directa de la rama production).");
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error("No hay terminal interactiva para confirmar. Cancelado.");
  process.exit(1);
}

// Solo el host: nunca el usuario ni la contraseña.
const { hostname } = new URL(cadena);
const lector = createInterface({ input: process.stdin, output: process.stdout });
const respuesta = await lector.question(
  `Estás a punto de modificar el esquema de PRODUCCIÓN (${hostname}).\n¿Confirmar? (s/N) `,
);
lector.close();

if (respuesta.trim().toLowerCase() !== "s") {
  console.log("Cancelado. No se tocó la base.");
  process.exit(1);
}
