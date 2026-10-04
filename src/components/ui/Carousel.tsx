"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface CarouselProps {
  children: ReactNode;
  /** Accessible name of the scroll area, e.g. "Новинки" */
  label: string;
  /**
   * Width of one slide. Default: 2 slides on phones (peeking), 3 on tablets, 4 on desktop.
   * Use `carouselItem.three` inside layouts with a sidebar.
   */
  itemClassName?: string;
  className?: string;
}

export const carouselItem = {
  four: "w-[62%] min-[480px]:w-[44%] md:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]",
  three: "w-[62%] min-[480px]:w-[44%] md:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]",
} as const;

/** Horizontal scroll-snap row with arrow buttons; children are rendered as slides */
export function Carousel({ children, label, itemClassName = carouselItem.four, className }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // The observer also fires once right after observe(), which takes the initial measurement
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  function scrollByPage(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const arrow =
    "absolute top-[38%] z-20 hidden size-11 -translate-y-1/2 place-content-center rounded-full border border-line-soft bg-white text-ink shadow-card transition-[opacity,color] hover:text-brand-600 disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <div className={cn("relative", className)}>
      <div
        ref={trackRef}
        onScroll={measure}
        role="group"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
      >
        {Children.map(children, (child) => (
          <div className={cn("shrink-0 snap-start", itemClassName)}>{child}</div>
        ))}
      </div>
      <button
        type="button"
        aria-label="Прокрутити назад"
        disabled={edges.start}
        onClick={() => scrollByPage(-1)}
        className={cn(arrow, "-left-4 xl:-left-5")}
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Прокрутити вперед"
        disabled={edges.end}
        onClick={() => scrollByPage(1)}
        className={cn(arrow, "-right-4 xl:-right-5")}
      >
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  );
}
