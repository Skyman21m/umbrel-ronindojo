import React, { FC, useState, PropsWithChildren } from "react";
import Head from "next/head";
import Image from "next/legacy/image";
import clsx from "clsx";
import { motion } from "framer-motion";

import mainImage from "../../public/background.jpg";

interface Props {
  title: string;
}

export const LayoutSimple: FC<PropsWithChildren<Props>> = ({ title, children }) => {
  const [blur, setBlur] = useState(true);

  return (
    <div className="relative h-full">
      <Head>
        <title>{`${title} - RoninDojo`}</title>
      </Head>

      <div className="fixed top-0 left-0 bottom-0 right-0 -z-10">
        <Image
          alt=""
          src={mainImage}
          quality={90}
          layout="fill"
          objectFit="cover"
          objectPosition="center"
          placeholder="blur"
          onLoadingComplete={() => setBlur(false)}
          className={clsx(["filter", "transition", "duration-500", blur && "blur-2xl"])}
        />
      </div>

      <div className="container relative h-full p-4 mt-4 md:mt-12 lg:mt-16">
        <motion.div
          className="flex items-center justify-center mb-6"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          <img src="/logo/RoninDojo-01f.svg" alt="" className="w-20 h-20 md:w-24 md:h-24 mr-1" />
          <h1 className="text-5xl md:text-7xl font-primary text-white drop-shadow-heroHeading">RoninDojo</h1>
        </motion.div>
        <motion.div
          className="box bg-black w-full max-w-5xl mx-auto"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};
