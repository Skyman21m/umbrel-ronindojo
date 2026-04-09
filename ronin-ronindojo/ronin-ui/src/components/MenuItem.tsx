import React, { FC } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { motion } from "framer-motion";

interface Props {
  path: string;
  icon: React.ReactElement;
  title: string;
  onClick?: () => void;
}

const itemAnimationVariants = {
  closed: {
    opacity: 0,
    x: -5,
    transition: {
      duration: 0.2,
    },
  },
  open: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const MenuItemComponent: FC<Props> = ({ path, icon, title, onClick }) => {
  const { pathname } = useRouter();
  const active = pathname.includes(path);

  return (
    <motion.li className="my-4 px-4" variants={itemAnimationVariants}>
      <Link
        href={path}
        className={clsx([
          "flex",
          "items-center",
          "p-2",
          "font-primary",
          "text-lg",
          "transition-colors",
          "border",
          "border-transparent",
          "rounded-full",
          "hover:text-white",
          "hover:border-primary",
          "hover:drop-shadow-menuItem",
          "ease-linear",
          active ? "text-white" : "text-menuText",
          active && "text-shadow-menuItem",
        ])}
        onClick={onClick}
      >
        <span className="mr-5 ml-2">{icon}</span>
        <span>{title}</span>
      </Link>
    </motion.li>
  );
};

export const MenuItem = MenuItemComponent;
