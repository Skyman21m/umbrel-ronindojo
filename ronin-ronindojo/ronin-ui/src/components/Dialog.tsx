import React, { FC, ReactElement, PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { motion, Variants, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { XMarkIcon } from "@heroicons/react/24/outline";

type Props = {
  title?: string;
  actions?: ReactElement;
  open: boolean;
  onClose?: () => void;
  className: string;
};

const overlayVariants: Variants = {
  open: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
  closed: {
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

const modalVariants: Variants = {
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
  closed: {
    opacity: 0,
    y: 30,
    transition: {
      duration: 0.3,
    },
  },
};

const noop = () => {};

const dialogRoot = document.querySelector("#dialog-root")!;

const Dialog: FC<PropsWithChildren<Props>> = ({ title, children, actions, onClose = noop, open, className }) => {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed top-0 left-0 right-0 bottom-0 bg-gray-900/[0.5] z-10 flex items-center justify-center"
          variants={overlayVariants}
          animate="open"
          exit="closed"
          initial="closed"
        >
          <div className="absolute top-0 left-0 right-0 bottom-0 z-10" onClick={onClose} />
          <motion.div
            className={clsx(["relative z-10 w-full max-h-full box bg-surface mx-auto my-auto flex flex-col items-stretch", className])}
            variants={modalVariants}
            animate="open"
            exit="closed"
            initial="closed"
          >
            {title && <h2 className="text-white font-primary text-2xl pb-3 border-b border-border mb-2">{title}</h2>}
            {onClose !== noop && (
              <XMarkIcon className="w-6 h-6 absolute top-2 right-2 text-primary hover:text-primary-alpha cursor-pointer transition-colors" onClick={onClose} />
            )}
            {children && <div className="mb-4 overflow-y-auto">{children}</div>}
            <div className="flex justify-end items-center">{actions}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    dialogRoot,
  );
};

export default Dialog;
