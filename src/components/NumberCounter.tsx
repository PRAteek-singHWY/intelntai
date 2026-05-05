"use client";

import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
};

export default function NumberCounter({
  value,
  format = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }),
  duration = 0.9,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, format]);

  return (
    <span ref={ref} className={`tabular ${className ?? ""}`}>
      {format(0)}
    </span>
  );
}
