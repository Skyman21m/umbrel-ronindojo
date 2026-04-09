import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { networkInterfaces, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.NetworkInterfacesData[] = [
  {
    default: true,
    iface: "lo0",
    ifaceName: "lo0",
    ip4: "127.0.0.1",
    ip4subnet: "255.0.0.0",
    ip6: "::1",
    ip6subnet: "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
    mac: "",
    internal: true,
    virtual: false,
    operstate: "down",
    type: "wired",
    duplex: "full",
    mtu: 16384,
    speed: -1,
    dhcp: false,
    dnsSuffix: "",
    ieee8021xAuth: "",
    ieee8021xState: "",
    carrierChanges: 0,
  },
  {
    default: false,
    iface: "en0",
    ifaceName: "en0",
    ip4: "192.168.0.27",
    ip4subnet: "255.255.255.0",
    ip6: "fe80::134a:1e43:abc5:d413",
    ip6subnet: "ffff:ffff:ffff:ffff::",
    mac: "xx:xx:xx:xx:xx:xx",
    internal: false,
    virtual: false,
    operstate: "up",
    type: "wired",
    duplex: "full",
    mtu: 1500,
    speed: 1000,
    dhcp: true,
    dnsSuffix: "",
    ieee8021xAuth: "",
    ieee8021xState: "",
    carrierChanges: 0,
  },
];

type Response = Systeminformation.NetworkInterfacesData[];

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() =>
      pipe(useRealData ? taskEither.tryCatch(() => networkInterfaces(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000))),
    ),
    taskEither.map((networkInterfacesData) => (Array.isArray(networkInterfacesData) ? networkInterfacesData : [networkInterfacesData])),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
