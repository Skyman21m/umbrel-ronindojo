import { FC } from "react";
import { motion } from "framer-motion";

interface Props {
  progress: number;
}

/**
 * @param progress {number} - percentage of progress
 */
export const ProgressBar: FC<Props> = ({ progress }) => {
  return (
    <div className="border border-primary rounded-full w-full h-5 p-1">
      <motion.div
        className="progress h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, delay: 0.5 }}
      />
    </div>
  );
};
