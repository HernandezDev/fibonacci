import { useEffect, useState } from "react";

export function useActiveSection(sectionIds: string[]) {
  const [activeId, setActiveId] = useState(sectionIds[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const handleScroll = () => {
      const reachedBottom =
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 32;

      if (reachedBottom) {
        setActiveId(sectionIds[sectionIds.length - 1]);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
    // Los ids son constantes del llamador: se observan una sola vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return activeId;
}
