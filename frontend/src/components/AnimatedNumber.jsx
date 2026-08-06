import React, { useEffect, useRef, useState } from 'react';

/**
 * Count-up number. Animates 0 → value once, when it first scrolls into view.
 *
 * One rAF sequence that ends — no continuous render loop, no interval. Honors
 * prefers-reduced-motion by rendering the final value immediately. `format`
 * shapes each frame (e.g. money or thousands separators).
 */
export default function AnimatedNumber({
  value,
  format = n => Math.round(n).toLocaleString(),
  duration = 1100,
  className,
  style,
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setDisplay(value); return; }

    const run = () => {
      if (started.current) return;
      started.current = true;
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / duration, 1);
        // easeOutExpo — fast start, gentle settle
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        setDisplay(value * eased);
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(value);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) { run(); io.disconnect(); } },
      { threshold: 0.35 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [value, duration]);

  return <span ref={ref} className={className} style={style}>{format(display)}</span>;
}
