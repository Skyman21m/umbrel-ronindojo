import React, { FC } from "react";
import Link from "next/link";
import { DateTime } from "luxon";

import { TRANSACTION_PAGE } from "../routes";
import { satsToBTC } from "../lib/common";

interface Props {
  txid: string;
  amount: number;
  blockHeight: number;
  dateInSeconds: number;
}

export const TransactionComponent: FC<Props> = ({ txid, amount, blockHeight, dateInSeconds }) => {
  const url = TRANSACTION_PAGE + "?txid=" + txid;

  return (
    <div className="bg-black box mb-6">
      <h2 className="text-white font-primary text-l mb-3">
        <Link
          href={url}
          prefetch={false}
          className="cursor-pointer ellipsis text-secondary hover:text-primary transition-colors"
          data-content-start={txid.slice(0, 32)}
          data-content-end={txid.slice(-32)}
        ></Link>
      </h2>

      <div className="text-white font-primary text-l">
        <div>
          Amount: <span className="font-mono text-secondary">{amount < 0 ? satsToBTC(amount) : `+${satsToBTC(amount)}`} BTC</span>
        </div>
        <div>
          Block Height: <span className="font-mono text-secondary">{blockHeight}</span>
        </div>
        <div>
          Date: <span className="font-mono text-secondary">{`${DateTime.fromSeconds(dateInSeconds).toFormat("yyyy-MM-dd HH:mm")} UTC`}</span>
        </div>
      </div>
    </div>
  );
};

export const Transaction = React.memo(TransactionComponent);
