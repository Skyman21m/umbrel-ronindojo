import React, { FC, createContext, useRef, useContext, useCallback, PropsWithChildren } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { InformationCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon, CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

type Severity = "success" | "info" | "warning" | "error";

interface ContextState {
  readonly callSnackbar: (message: string, severity: Severity, permanent?: boolean) => void;
}

export const SnackbarContext = createContext<ContextState>({
  callSnackbar: () => {},
});

const useForceRerender = () => {
  const [_, setCounter] = React.useState(0);
  return useCallback(() => setCounter((counter) => counter + 1), []);
};

const getColor = (color: Severity) => {
  switch (color) {
    case "info":
      return "text-secondary";
    case "warning":
      return "text-yellow-600";
    case "error":
      return "text-primary";
    case "success":
      return "text-green-600";
  }
};

const MAX_SIZE = 3;

export const SnackbarContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const forceRerender = useForceRerender();
  const snackbars = useRef(new Map<Symbol, { message: string; severity: Severity }>());

  const removeSnackbar = useCallback(
    (symbol: Symbol) => {
      const deleted = snackbars.current.delete(symbol);
      if (deleted) {
        forceRerender();
      }
    },
    [forceRerender],
  );

  const callSnackbar = useCallback(
    (message: string, severity: Severity, permanent = false) => {
      const symbol = Symbol(Date.now());
      snackbars.current.set(symbol, { message, severity });

      if (snackbars.current.size > MAX_SIZE) {
        // delete the oldest entry when max size is reached
        snackbars.current.delete(snackbars.current.keys().next().value);
      }

      forceRerender();

      !permanent &&
        setTimeout(() => {
          removeSnackbar(symbol);
        }, 12000);
    },
    [forceRerender, removeSnackbar],
  );

  return (
    <SnackbarContext.Provider value={{ callSnackbar }}>
      {children}
      <div className="mx-auto fixed z-20 left-1/2 -translate-x-1/2 bottom-4 flex flex-col items-center pb-8">
        {typeof window != "undefined" && (
          <AnimatePresence>
            {[...snackbars.current.entries()].map(([symbol, { message, severity }]) => (
              <motion.div
                key={symbol.toString()}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <div className={clsx(["max-w-full border border-border rounded p-4 pr-8 bg-surface mb-2 flex items-center", getColor(severity)])}>
                  {severity === "info" && <InformationCircleIcon className="w-6 h-6 text-current mr-5" />}
                  {severity === "warning" && <ExclamationTriangleIcon className="w-6 h-6 text-current mr-5" />}
                  {severity === "error" && <ExclamationCircleIcon className="w-6 h-6 text-current mr-5" />}
                  {severity === "success" && <CheckCircleIcon className="w-6 h-6 text-current mr-5" />}
                  <div>{message}</div>
                </div>
                <XMarkIcon className="absolute top-2 right-2 w-3 h-3 text-paragraph cursor-pointer" onClick={() => removeSnackbar(symbol)} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </SnackbarContext.Provider>
  );
};

export const SnackbarContextConsumer = SnackbarContext.Consumer;

export const useSnackbar = () => {
  return useContext(SnackbarContext);
};
