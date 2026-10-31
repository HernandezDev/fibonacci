import { DiagonalDashBackground } from "~/components/Diagonal-dash-background";
import { Header } from "~/components/LandingHeader";

export function meta() {
  return [
    {
      title: "Instituto Fibonacci — Clases particulares de matemática online",
    },
    {
      name: "description",
      content: "Sistema de reserva de turnos del Instituto Fibonacci.",
    },
  ];
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
