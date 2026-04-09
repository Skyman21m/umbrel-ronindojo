import { FC } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

interface Props {
  className?: string;
}

export const LinearLoader: FC<Props> = ({ className }) => {
  return (
    <div className={clsx(["h-1 w-full bg-primary-alpha relative overflow-hidden rounded", className])}>
      <motion.div
        className="h-1 w-1/5 bg-primary absolute"
        animate={{ left: ["-20%", "100%"] }}
        transition={{ duration: 2, repeatType: "loop", repeat: Number.POSITIVE_INFINITY }}
      />
    </div>
  );
};
