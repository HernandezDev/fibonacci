import { UserIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { css, cx } from "styled-system/css";
import { circle } from "styled-system/patterns";

interface AvatarProps {
  // URL de la foto que da Google, o `null` si no hay.
  src: string | null;
  className?: string;
}

const redondel = circle({
  size: "16",
  overflow: "hidden",
  bg: "bg.muted",
  color: "text",
  flexShrink: "0",
});

// Foto de perfil en un círculo. Sin foto, o si no carga (las URLs de Google
// pueden vencer), muestra el ícono de usuario.
export function Avatar({ src, className }: AvatarProps) {
  const [fallo, setFallo] = useState(false);

  return (
    <span className={cx(redondel, className)}>
      {src && !fallo ? (
        <img
          src={src}
          alt=""
          // Google responde 403 a algunas fotos si el pedido lleva Referer.
          referrerPolicy="no-referrer"
          onError={() => setFallo(true)}
          className={css({ w: "full", h: "full", objectFit: "cover" })}
        />
      ) : (
        <UserIcon aria-hidden="true" size={32} />
      )}
    </span>
  );
}
