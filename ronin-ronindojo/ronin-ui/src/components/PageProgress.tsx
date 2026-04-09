import React, { FC, useCallback, useEffect, useState } from "react";
import Router, { useRouter } from "next/router";
import { motion, Variants, AnimatePresence } from "framer-motion";

const variants: Variants = {
  initial: {
    width: "0",
  },
  animate: {
    width: "80%",
    transition: {
      duration: 4,
    },
  },
  exit: {
    width: "100%",
    transition: {
      duration: 0.4,
    },
  },
};

const PageProgress: FC = () => {
  const router = useRouter();
  const [isInProgress, setIsInProgress] = useState<boolean>(false);

  const progressStart = useCallback(
    (href: string) => {
      if (!(router.asPath.includes("/logs") && href.includes("/logs"))) {
        setIsInProgress(true);
      }
    },
    [router.asPath],
  );

  const progressFinish = useCallback(() => {
    setIsInProgress(false);
  }, []);

  useEffect(() => {
    Router.events.on("routeChangeStart", progressStart);
    Router.events.on("routeChangeComplete", progressFinish);
    Router.events.on("routeChangeError", progressFinish);

    return () => {
      Router.events.off("routeChangeStart", progressStart);
      Router.events.off("routeChangeComplete", progressFinish);
      Router.events.off("routeChangeError", progressFinish);
    };
  }, [progressStart, progressFinish]);

  return (
    <div className="w-full fixed top-0 left-0 h-1 z-10">
      <AnimatePresence>
        {isInProgress && (
          <motion.div initial="initial" animate="animate" exit="exit" variants={variants} className="border-b-2 border-primary shadow shadow-primary" />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PageProgress;
