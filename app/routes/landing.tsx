import { DiagonalDashBackground } from "~/components/Diagonal-dash-background";
import { Header } from "~/components/LandingHeader";
import { seo } from "~/lib/seo";

export function meta() {
  return seo({
    title: "Instituto Fibonacci — Clases particulares de matemática online",
    description:
      "Clases particulares de matemática online. Reservá tu turno en el Instituto Fibonacci.",
    url: "https://fibonacci.com.ar",
    image: "https://fibonacci.com.ar/og-image.png",
  });
}

export default function Landing() {
  return (
    <>
      <DiagonalDashBackground />
      <Header />
      <main id="inicio" />
    </>
  );
}
