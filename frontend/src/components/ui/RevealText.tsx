"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface RevealTextProps {
  children: React.ReactNode;
  delay?: number;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
}

export default function RevealText({
  children,
  delay = 0,
  as: Tag = "div",
  className,
  style,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={className} style={style}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={visible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
      >
        {children}
      </motion.div>
    </Tag>
  );
}
