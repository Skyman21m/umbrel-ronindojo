import React, { FC } from "react";
import clsx from "clsx";

import { ReactComponent as EditIcon } from "./icons/general_icons/edit.svg";

interface Props {
  className?: string;
  onClick: () => void;
}

export const ManageButton: FC<Props> = ({ className, onClick }) => (
  <div className={clsx(["absolute left-0 bottom-0 flex items-center text-secondary hover:text-white cursor-pointer", className])} onClick={onClick}>
    <div className="p-1.5 border-t border-r border-primary">
      <EditIcon className="w-3 h-3 fill-current transition-colors" />
    </div>
    <div className="p-1.5 text-xs text-current drop-shadow-manage transition-colors">Manage</div>
  </div>
);
