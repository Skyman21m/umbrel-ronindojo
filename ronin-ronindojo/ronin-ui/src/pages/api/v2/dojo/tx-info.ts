import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, task, either, apply } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { txInfo, TxInfoResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";
import { getBlockCount } from "../../../../lib/server/bitcoind";

const RequestQuery = t.type({
  txId: t.string,
});

export interface Response extends TxInfoResponse {
  confirmations: number | null;
}

const methods = "GET";

export const getTxInfo = (txId: string) =>
  useRealData
    ? pipe(
        apply.sequenceT(taskEither.ApplyPar)(txInfo(txId), getBlockCount),
        taskEither.map(([txInfoResponse, blockCount]) => ({
          ...txInfoResponse.data,
          confirmations: txInfoResponse.data.block ? blockCount - txInfoResponse.data.block.height + 1 : null,
        })),
      )
    : pipe(taskEither.right(mockData), task.delay(2000));

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.query,
        RequestQuery.decode,
        either.mapLeft(() => badRequest("Correct request query not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ txId }) => getTxInfo(txId)),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));

const mockData: Response = {
  txid: "c2ad8ef1f41eb42281ac6548279888f4dac41c87ae6e00671782a0fafb10634b",
  size: 2811,
  vsize: 1358,
  version: 1,
  locktime: 0,
  inputs: [
    {
      n: 0,
      seq: 4294967295,
      outpoint: {
        txid: "02c2fb75cbaa65caa5b43efca0bcd0da2c57764d89f7a03efca9e887d8b33baa",
        vout: 4,
        value: 5000000,
        scriptpubkey: "00149f882b1ff8c1eaff9f12135db8af288e0d2c06bf",
      },
      sig: "",
      witness: [
        "3045022100d47bae8455fafdfab7c70387ef2481e483f62b4f308d0de9f7d2e21996d977370220176af635f850a9110fe68b18419d4ad1ea647408db8d101004786953c9a621d101",
        "035d9974e7e83459a47443174661ecd9b3787075f5c0348186fd8c1dda17fe1767",
      ],
    },
    {
      n: 1,
      seq: 4294967295,
      outpoint: {
        txid: "1ae9600a2fe2f25898f2bc09975e6a7914fa286b2684673921a9287db6329e02",
        vout: 0,
        value: 115387,
        scriptpubkey: "0014758624ab110e2cd717caa8387fc565b41fc30a11",
      },
      sig: "",
      witness: [
        "3045022100e1875c0012fc5e7993defdd5d6484eceed5db59af5cd6e687a6e0d913476c5fa0220415a20f5a070d221273bc93d60ee28fda009a796ab965c109e9580711bd7891401",
        "02a29036341faabd928ff424074335d3806fc78371ca3d37caaf1558858adbb701",
      ],
    },
    {
      n: 2,
      seq: 4294967295,
      outpoint: {
        txid: "24c778e03acdd353c42bb9184dfced1a53263cb7e1323f4e9201992f811cc52f",
        vout: 4,
        value: 1000000,
        scriptpubkey: "0014dd541d9f3fb8bb5884d0d0b380297edb16e685c9",
      },
      sig: "",
      witness: [
        "304402200d5baa67141a21362778713436a97ef100be2c162cc4df5d2796f7a519d2dcd902202a487a3321aa6da64ecf22536367032fbee9f1801f0d24c9ad9be547061ab18e01",
        "02fbd1878c1ac7a6e83db8458d70d53d89ab0d3e6ba1476e49fd162a70737e55e5",
      ],
    },
    {
      n: 3,
      seq: 4294967295,
      outpoint: {
        txid: "2521f11f6d2f4caaf4c80d696ee22bb9a74921c3ba848a3b3b7f64f67df60f3d",
        vout: 4,
        value: 1000000,
        scriptpubkey: "0014cf4a962ad7e626cdb2c293f67f52989710050e54",
      },
      sig: "",
      witness: [
        "304402200b8de696e24a35d3946fa45280fb99074764dfcfc14135a3aedadfc448cca249022031733bfc87f7bdc5fa0670f6039bb0997026ec25ce61b1af5c5ef17fad135a2b01",
        "0227fcefb17ccf79854e55018b1e8805abdbb5524b2661f95486b1ab067f63dc05",
      ],
    },
    {
      n: 4,
      seq: 4294967295,
      outpoint: {
        txid: "3057cfffae4a6f88c83593a93618e9c55543c1debadf00de91fad46956301af3",
        vout: 3,
        value: 611760,
        scriptpubkey: "00144921c283bfc5f14e955300ba0dfba292505ac35a",
      },
      sig: "",
      witness: [
        "3045022100e5b38f213df6b1b1dc68f4b9b665f27d9d14e8244863d33ab5b7b187590596a602205fe2fab0ea996c186fa2e255a5dbc40069583df3a0fb7a494805768d9963251a01",
        "02b9906dd11d83e69b0cbdb8ac85790d1d8ac5f70b23cb5555ee05e7753ad0740a",
      ],
    },
    {
      n: 5,
      seq: 4294967295,
      outpoint: {
        txid: "36ef332e576e84f31bd65bce0269937c0edfa9514b8b4b831b74e4c2fb68120b",
        vout: 0,
        value: 1000000,
        scriptpubkey: "0014110ddf3cc2ec269fad2fc3a60bdcc6e5855892ed",
      },
      sig: "",
      witness: [
        "30440220386ff672564aecee011fba00036a46339b146c0f70d0e2e1716b3ff0a141e952022046ecd57f22c6f10140a396b0cc6fcf7a90a134e2190b16bf91cf3781ba3e6d2a01",
        "0396baa07c124f7ed6d8fa7b9c4ca4187514d80f069d082cd3d0faf405291ad9b7",
      ],
    },
    {
      n: 6,
      seq: 4294967295,
      outpoint: {
        txid: "4a083080fe9b6202beb3d819a63015f1049d9c1c89f6779c7448d6c5e47617e8",
        vout: 2,
        value: 5000000,
        scriptpubkey: "001467d10559c7dd720f1188164f9b65422a535a681a",
      },
      sig: "",
      witness: [
        "3045022100d3a322ee086c918d133dcf878dc9494a6d1a19ce73d1c05fdfc1f5726ca75dcb02203a61ef9a96cdeab0e52ee76a2093e289585d499a17435d01890a6d118fd0df8c01",
        "02fff371ca396dcac2616fd78f4d9f6423931123def082205c5d34d62e8037faa6",
      ],
    },
    {
      n: 7,
      seq: 4294967295,
      outpoint: {
        txid: "4a3523c925b437838685dbaedc9df7f9fcb483e93bec4aa6edd6a183e01a68ba",
        vout: 2,
        value: 1000000,
        scriptpubkey: "00148474e995994f73197d4a6aad58567cfe0abdeb98",
      },
      sig: "",
      witness: [
        "30440220063a9cf0d18fcdc7410f3d0ae1609cb2357d5d3b3105d74fd5fe562b0458b05e022022f9d0f001d1bdf40d76698462e637ab00fba16491b10c9301d4130eb4600f8901",
        "0395325b9b0958fedd0d91ab835b911ca185e9b87b6159a010bd9f9eb5ad5da885",
      ],
    },
    {
      n: 8,
      seq: 4294967295,
      outpoint: {
        txid: "6c824b00dafb97e673e061474502a3c716c5f19790cc714608a8d1276ccd3b3a",
        vout: 0,
        value: 180310,
        scriptpubkey: "001450248fc9091d56b109cf503f75d5a2ad86383673",
      },
      sig: "",
      witness: [
        "3044022019b50880c27a0f8645e99b94a1ce7e4dfbe63755200d23839b1c36447eef0e1f02202304ecee4116d65515b7cb96d39b209a33da8f5529aec33ffdde1b9c7c1c13fe01",
        "035b28763f04cf998eb4f18d243bb4dd48cab6bd24fd35afdaf50c8986f3295ec5",
      ],
    },
    {
      n: 9,
      seq: 4294967295,
      outpoint: {
        txid: "71a2f866d74c930ac7b06e7188ccfb9f88ea10a0b07caded0503f972cc3e732a",
        vout: 4,
        value: 1000000,
        scriptpubkey: "0014986081bbd311643e0cb7744efed6f90a15f333fd",
      },
      sig: "",
      witness: [
        "3045022100917ec314cd7ce88c62a207b4d193d9a882ff37a7fae3ea40c67c6d9b05242acf0220100c3c392d70785aefd7a2294e182d0a5fd3de64e0a66a3f548939c32380607301",
        "027262952eeb4f4245489d72b3ba3739ebc744b77b53d2c524c021aae4aedf2058",
      ],
    },
    {
      n: 10,
      seq: 4294967295,
      outpoint: {
        txid: "856e85997c1d5569ad814fc65945d1f98520044624fd8ecbda90e01f7009460f",
        vout: 3,
        value: 1000000,
        scriptpubkey: "00147016411e1a2b3a116682d2a056eef2fe7be90983",
      },
      sig: "",
      witness: [
        "3045022100ed33d638c334483c1c5cf6c45dbc8102e5670dcfd40692de03d77cc6810e29df0220483f559652c754425000bb726bdda031399ceefaacc6b918645ed9d80d720fee01",
        "02175aced380e33ea659451a7b9c5d6b868b360cdda4b18bac998d322893c2ed3b",
      ],
    },
    {
      n: 11,
      seq: 4294967295,
      outpoint: {
        txid: "97cb898f75cfc8d6d9153e235222c765e7678c86ac39d4ea4a204f475a5bc618",
        vout: 2,
        value: 400000,
        scriptpubkey: "00141f20a720236689c18488364862c13cc1f1ece543",
      },
      sig: "",
      witness: [
        "30450221009aefbeadd3c2a4251cf291236824bfd382569a217a21013e74ce72533d9608360220627ff20a5b54b23dfa3ac0f92e051dcac079fdb088ba5d70d6c819dab3fca70601",
        "03e1e8a7b29ebec2a0c50be9437440f33fa1d26766b66b364bc9666709de7140fc",
      ],
    },
    {
      n: 12,
      seq: 4294967295,
      outpoint: {
        txid: "a7a2c053a50994783e79b49f77488eea1ec9510717a33df8bab15c06b8431050",
        vout: 1,
        value: 1000000,
        scriptpubkey: "0014b65657f41ae87df9069e022ef24f3976766ba9c2",
      },
      sig: "",
      witness: [
        "3045022100ec6790166053436492182dd3927bbb2a61140ebf992bc102fe104fb604d849a102203827413207f80496149be4c31f85189f965946c5341fc67b1ac0dd929afd853501",
        "03d164c2a412d59a0159b60235cb40281600524a1f408cc0bf1be70acf1917ad13",
      ],
    },
    {
      n: 13,
      seq: 4294967295,
      outpoint: {
        txid: "a9befd38191af0caa60bbfae108bc65d272defbe9f2057a33f6105b5fb054596",
        vout: 3,
        value: 1000000,
        scriptpubkey: "0014c82afd54d6aab4d2ab068d04291673fa855253ea",
      },
      sig: "",
      witness: [
        "304402200348ebe665c395dc554530591ac3d930652f20792a198fb8a1a5ec598e49fbec0220612ecb0f336107d7a3c23dd1b338970459590a246e2c96422d88a003de23c3e501",
        "0204cea5d947041bd7ac78fecaed4cbabe6f031dd2ef3a22193dee12ade74dbfb7",
      ],
    },
    {
      n: 14,
      seq: 4294967295,
      outpoint: {
        txid: "ab5857c2e6b2693a95e125acb246e2ba86921e9110492e483e8e27bf6e404c65",
        vout: 4,
        value: 1000000,
        scriptpubkey: "0014cb08927b92c032dc569e114a09643575605c8629",
      },
      sig: "",
      witness: [
        "3045022100f90aac68ccebc568ac48b1de2662063c0514f4e29f31db02a019861bf860287b02204d3ab993fc9c382fa8aebda17648bb724a3929330fca99a7c45df0d7cc7de19001",
        "03aa233cdb1f239026b1f648df3ed1d023e486f45a4537e3410defb25e7db3a9de",
      ],
    },
    {
      n: 15,
      seq: 4294967295,
      outpoint: {
        txid: "b15ca283119a6dfe3019959e1446984978e9aa1af511a9cde5051ce317fdb044",
        vout: 3,
        value: 1000000,
        scriptpubkey: "0014aade10bb3b4af3e390ff2e87f6a27738a766c3dd",
      },
      sig: "",
      witness: [
        "304402202776a688212f061cab6a13c9241acfdb52c4d0fbaead602c4bfa574081cec69602203ee72f24782680650fba3096c414e531433a433f824e6017eb0bf6fcb6431d0201",
        "0261981b6003d4b83399781f56cc2450f5cdbf0f9dcdcc7de582335551d8eb08e1",
      ],
    },
    {
      n: 16,
      seq: 4294967295,
      outpoint: {
        txid: "c235d86e3b6a406e3a8ceb890ac60a059a639305ee17de030d52124609fac0a8",
        vout: 2,
        value: 1000000,
        scriptpubkey: "001497da933652dd309593bfa91fbff73b203c230211",
      },
      sig: "",
      witness: [
        "3045022100d32eb1d51064cde8bb73c27cd48867457bf498994545c7c30aa5d474f6ad5b630220245a46260c3d3680fa921bc94b519f0d660da8cdc7bbd2def79451e812a41fac01",
        "03adfff21cc0a32843c9404a3f757294637fcbd2e75a3dc3557766932d9b0afbda",
      ],
    },
    {
      n: 17,
      seq: 4294967295,
      outpoint: {
        txid: "e918671cd4faeba714968d59270f0213bd5133511690341b6f00ba1898cf17de",
        vout: 3,
        value: 1476267,
        scriptpubkey: "0014cc6c61c552c31645d1f62956942c6d55ceefa91f",
      },
      sig: "",
      witness: [
        "304402206c3f18b30997533566391b0e4c0d89f68f147115d839626400c039c26a882e1a0220401aadb84fdded61bb562eb26ad95557126023fb10f944e4667887eb95965a3001",
        "023daa315bf2bf4918974d7537008483c7d9c1b4c6e587afe541d4319dbc4a4558",
      ],
    },
  ],
  outputs: [
    {
      n: 0,
      value: 48972,
      scriptpubkey: "00142c47bea9fdc57babff3f043a8a9b0d8cf3d422d1",
      type: "witness_v0_keyhash",
      address: "bc1q93rma20ac4a6hlelqsag4xcd3neaggk3zmxgcc",
    },
    {
      n: 1,
      value: 4265248,
      scriptpubkey: "001467f381dd49deeb11d6976860a46a505af013e38c",
      type: "witness_v0_keyhash",
      address: "bc1qvlecrh2fmm43r45hdps2g6jsttcp8cuvwg22c8",
    },
    {
      n: 2,
      value: 9725457,
      scriptpubkey: "0014fa58e36e70c210c8492a334d2fb75c023b05daf4",
      type: "witness_v0_keyhash",
      address: "bc1qlfvwxmnscggvsjf2xdxjld6uqgastkh59dze46",
    },
    {
      n: 3,
      value: 9725457,
      scriptpubkey: "a914b362ac1877bf9f2aceed64d5db65d2767739575a87",
      type: "scripthash",
      address: "3J3X5kRFgmuQLHZ42NSKq4WZURdTCPt2hq",
    },
  ],
  created: 1613274745,
  block: {
    height: 670517,
    hash: "000000000000000000039c4ebd5567e231058e08b4649de1f71ccce8876a3a14",
    time: 1613274745,
  },
  fees: 18590,
  feerate: 7,
  vfeerate: 14,
  confirmations: 5,
};
