import { Variants } from "framer-motion";

export const pageTransition: Variants = {
  initial: {
    y: 50,
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
};

export const boxParentTransition: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

export const boxTransition: Variants = {
  hidden: {
    y: 20,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.2 },
  },
};
