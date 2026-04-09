import { FC } from "react";
import clsx from "clsx";

interface Props {
  running: boolean;
}

export const ContainerStatusIndicator: FC<Props> = ({ running }) => {
  return (
    <div
      className={clsx(["absolute top-0 right-0 border-b border-l border-primary px-2 py-0.5 font-mono text-base", running ? "text-secondary" : "text-primary"])}
    >
      &#9679; {running ? "Running" : "Stopped"}
    </div>
  );
};
