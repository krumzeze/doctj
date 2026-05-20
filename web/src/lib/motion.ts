/**
 * Шкала переходов (brandbook §8).
 *
 * Все анимации фронта берут параметры отсюда. Если ни один токен не
 * подходит — обсуждаем в брендбуке, а не изобретаем локально.
 */
import type { Transition } from "motion/react";

export const motionTokens = {
  /** Мелкие state-флипы, hover, focus. */
  snap: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1],
  } satisfies Transition,

  /** Появление блока в зоне видимости (fade + 12px). */
  reveal: {
    duration: 0.6,
    ease: [0.16, 1, 0.3, 1],
  } satisfies Transition,

  /** Layout-переходы, перемещение, resize. */
  springSoft: {
    type: "spring",
    stiffness: 220,
    damping: 30,
    mass: 1,
  } satisfies Transition,

  /** Открытие диалога, модалки, drawer. */
  springFirm: {
    type: "spring",
    stiffness: 320,
    damping: 32,
  } satisfies Transition,

  /** Числовые значения (overallScore, часы, vitals). */
  count: {
    duration: 0.8,
    ease: [0.22, 1, 0.36, 1],
  } satisfies Transition,
} as const;

/** Каскадная задержка для stagger-списков: index × 60ms, потолок 10. */
export const stagger = (index: number): number =>
  Math.min(index, 9) * 0.06;

/** Стандартный reveal-вариант (fade + translateY 12px). */
export const revealVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: motionTokens.reveal },
};
