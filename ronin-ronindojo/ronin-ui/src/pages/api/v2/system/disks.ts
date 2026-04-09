import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { diskLayout, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.DiskLayoutData[] = [
  {
    device: "/dev/nvme0n1",
    temperature: 42,
    type: "NVMe",
    name: "SAMSUNG xxxxxxxxxxxx-xxxx",
    vendor: "Samsung",
    size: 1024209543168,
    bytesPerSector: -1,
    totalCylinders: -1,
    totalHeads: -1,
    totalSectors: -1,
    totalTracks: -1,
    tracksPerCylinder: -1,
    sectorsPerTrack: -1,
    firmwareRevision: "",
    serialNum: "...serial....",
    interfaceType: "PCIe",
    smartStatus: "unknown",
    smartData: {
      smart_status: { passed: true },
      power_on_time: { hours: 1 },
      power_cycle_count: 1,
      temperature: { current: 10 },
      ata_smart_error_log: {
        summary: {
          revision: 1,
          count: 1,
        },
      },
      ata_smart_self_test_log: {
        standard: {
          revision: 1,
          table: [
            {
              type: {
                value: 1,
                string: "string",
              },
              status: {
                value: 1,
                string: "string",
                passed: true,
              },
              lifetime_hours: 1,
            },
          ],
          count: 1,
          error_count_total: 1,
          error_count_outdated: 1,
        },
      },
      ata_smart_attributes: {
        revision: 1,
        table: [
          {
            id: 1,
            name: "bstc",
            value: 1,
            worst: 1,
            thresh: 1,
            when_failed: "string",
            flags: {
              value: 1,
              string: "string",
              prefailure: true,
              updated_online: true,
              performance: true,
              error_rate: true,
              event_count: true,
              auto_keep: true,
            },
            raw: { value: 1, string: "string" },
          },
        ],
      },
      json_format_version: [1],
      smartctl: {
        version: [1],
        platform_info: "abc",
        build_info: "abc",
        argv: ["a"],
        exit_status: 1,
      },
      device: {
        name: "name",
        info_name: "abcd",
        type: "type",
        protocol: "protocol",
      },
    },
  },
];

type Response = Systeminformation.DiskLayoutData[];

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => pipe(useRealData ? taskEither.tryCatch(() => diskLayout(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)))),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
