import React, { FC } from "react";

interface Props {
  message: string | null;
}

export const SuccessMessage: FC<Props> = ({ message }) => {
  if (!message) return null;

  return <div className="text-sm text-green-600 border border-green-600 p-3 rounded">{message}</div>;
};
