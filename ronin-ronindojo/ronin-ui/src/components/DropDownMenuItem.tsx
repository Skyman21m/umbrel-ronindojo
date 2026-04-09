import React, { FC, useEffect } from "react";
import { useRouter } from "next/router";
import clsx from "clsx";
import { motion, useCycle, AnimatePresence } from "framer-motion";

import { MenuItem } from "./MenuItem";
import { ReactComponent as ChevronDownIcon } from "./icons/general_icons/chevron_down.svg";

interface Item {
  readonly title: string;
  readonly path: string;
  readonly icon: React.ReactElement;
}

interface Props {
  readonly title: string;
  readonly icon: React.ReactElement;
  readonly items: readonly Item[];
  onItemClick?: () => void;
}

const parentAnimationVariants = {
  open: {
    height: "auto",
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  closed: {
    height: 0,
    transition: {
      staggerChildren: 0.1,
      staggerDirection: -1,
      duration: 0.2,
      when: "afterChildren",
    },
  },
};

const itemAnimationVariants = {
  closed: {
    opacity: 0,
    x: -5,
  },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const DropDownMenuItemComponent: FC<Props> = ({ title, icon, items, onItemClick }) => {
  const [isOpen, toggleOpen] = useCycle(false, true);
  const { pathname } = useRouter();

  useEffect(() => {
    if (items.some((item) => item.path === pathname)) {
      toggleOpen(1);
    }
  }, [items, pathname, toggleOpen]);

  return (
    <motion.li className="my-4 px-4" variants={itemAnimationVariants}>
      <>
        <div
          onClick={() => toggleOpen()}
          className="p-2 transition-colors ease-linear border border-transparent rounded-full text-menuText font-primary text-lg flex items-center w-full hover:text-white hover:border-primary hover:drop-shadow-menuItem cursor-pointer"
        >
          <div className="mr-5 ml-2">{icon}</div>
          <div className="flex-1 text-left">{title}</div>
          <div>
            <ChevronDownIcon width={24} height={24} className={clsx(["fill-current", "transition", "transform", "duration-100", isOpen && "rotate-180"])} />
          </div>
        </div>
        <AnimatePresence mode="wait" presenceAffectsLayout>
          {isOpen && (
            <motion.ul initial="closed" animate="open" exit="closed" variants={parentAnimationVariants}>
              <AnimatePresence mode="wait" presenceAffectsLayout>
                {items.map((item) => (
                  <MenuItem key={item.title} title={item.title} path={item.path} icon={item.icon} onClick={onItemClick} />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </AnimatePresence>
      </>
    </motion.li>
  );
};

export const DropDownMenuItem = React.memo(DropDownMenuItemComponent);
