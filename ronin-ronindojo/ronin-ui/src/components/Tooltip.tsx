import { FC, PropsWithChildren } from "react";
import { motion } from "framer-motion";

interface Props {
  title: string;
}

export const Tooltip: FC<PropsWithChildren<Props>> = ({ children, title }) => {
  return (
    <motion.div className="relative inline-block" initial="initial" whileHover="hover">
      {children}
      <motion.div
        className="absolute z-10 bottom-0 left-1/2 w-96 p-2 text-white text-sm bg-border border-secondary-alpha border rounded pointer-events-none"
        variants={{ initial: { opacity: 0, y: 0, x: "-50%" }, hover: { opacity: 1, y: -25, x: "-50%" } }}
        transition={{ duration: 0.1 }}
      >
        {title}
      </motion.div>
    </motion.div>
  );
};
