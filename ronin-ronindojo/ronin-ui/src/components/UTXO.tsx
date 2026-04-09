import React, { FC } from "react";
import Link from "next/link";
import { satsToBTC } from "../lib/common";
import { TRANSACTION_PAGE } from "../routes";

interface Props {
  txid: string;
  amount: number;
  address: string;
  confirmations: number;
}

export const UTXOComponent: FC<Props> = ({ txid, amount, address, confirmations }) => {
  const url = TRANSACTION_PAGE + "?txid=" + txid;

  return (
    <div className="mb-6 bg-black box">
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
          Amount: <span className="font-mono text-secondary">{satsToBTC(amount)} BTC</span>
        </div>
        <div>
          Address: <span className="font-mono text-secondary">{address}</span>
        </div>
        <div>
          Confirmations: <span className="font-mono text-secondary">{confirmations}</span>
        </div>
      </div>
    </div>
  );
};

export const UTXO = React.memo(UTXOComponent);
