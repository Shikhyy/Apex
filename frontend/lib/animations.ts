import type { Variants, Transition } from "framer-motion"

export const easeOut = [0.25, 0.1, 0.25, 1] as const
export const spring = { type: "spring", stiffness: 300, damping: 25 } as const

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
}

export const fadeSlideDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: easeOut } },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easeOut } },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easeOut } },
}

export const pulseGlow: Variants = {
  idle: { opacity: 0.4, scale: 1 },
  active: {
    opacity: 1,
    scale: 1.1,
    transition: { duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: easeOut },
  },
}

export const layoutTransition: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 25,
}

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: easeOut, staggerChildren: 0.1 } },
}

export const hoverLift = {
  rest: { y: 0, transition: { duration: 0.2, ease: easeOut } },
  hover: { y: -4, transition: { duration: 0.2, ease: easeOut } },
}

export const buttonPress = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
  press: { scale: 0.98 },
}
