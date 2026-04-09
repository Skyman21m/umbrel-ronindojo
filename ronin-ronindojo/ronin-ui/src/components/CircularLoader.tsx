import { FC } from "react";
import { motion, Transition } from "framer-motion";
import clsx from "clsx";

const transition: Transition = {
  repeat: Number.POSITIVE_INFINITY,
  duration: 1,
  ease: "linear",
};

type Color = "primary" | "secondary";

interface Props {
  className: string;
  color: Color;
}

const getColor = (color: Color): string => {
  switch (color) {
    case "primary":
      return "border-t-primary";
    case "secondary":
      return "border-t-secondary";
  }
};

export const CircularLoader: FC<Props> = ({ className, color }) => {
  return (
    <div className={clsx(["inline-block", "relative", "align-middle", className])}>
      <motion.div
        className={clsx(["w-full h-full border-2 border-gray-700 rounded-full absolute top-0 left-0", getColor(color)])}
        animate={{ rotate: 360 }}
        transition={transition}
      />
    </div>
  );
};
