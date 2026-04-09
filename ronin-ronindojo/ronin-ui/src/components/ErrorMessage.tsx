import React, { FC } from "react";
import clsx from "clsx";

interface Props {
  errors: Array<string | null>;
  className?: string;
}

export const ErrorMessage: FC<Props> = ({ errors, className }) => {
  if (errors.length === 0) return null;

  const nonNullErrors = errors.filter(Boolean);

  if (nonNullErrors.length === 0) return null;

  return (
    <div className={clsx(["w-full md:w-1/2 mx-auto p-4 font-mono text-primary text-sm bg-surface border border-border rounded", className])}>
      Errors:
      <ul className="list-inside list-disc">
        {nonNullErrors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
};
