import React from "react";
import * as routes from "../routes";
import Head from "next/head";
import Link from "next/link";

export default function Custom500() {
  return (
    <div className="bg-surface h-full box mb-4">
      <Head>
        <title>500 - Something Went Wrong - RoninDojo</title>
      </Head>
      <div className="grid place-items-center">
        <h1 className="text-primary text-6xl font-primary mb-6">- 500 -</h1>
        <h2 className="text-paragraph text-3xl mb-4">Oops, looks like something went wrong</h2>

        <Link href={routes.DASHBOARD_PAGE}>
          <img className="" src="/logo/RoninDojo-01b.svg" alt="" height={200} width={200} />
        </Link>

        <Link href={routes.DASHBOARD_PAGE} className="text-paragraph text-3xl mb-4">
          Go To Homepage
        </Link>
      </div>
    </div>
  );
}
