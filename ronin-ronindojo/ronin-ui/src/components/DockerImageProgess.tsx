import React, { FC } from "react";
import { CheckIcon } from "@heroicons/react/20/solid";

import { CircularLoader } from "./CircularLoader";

interface Props {
  ready: boolean;
}

export const DockerImageProgess: FC<Props> = ({ ready }) => {
  return (
    <div className="flex items-center justify-end">
      {ready ? <CheckIcon className="text-green-700 fill-current w-6 h-6" /> : <CircularLoader className="w-6 h-6" color="secondary" />}
    </div>
  );
};
