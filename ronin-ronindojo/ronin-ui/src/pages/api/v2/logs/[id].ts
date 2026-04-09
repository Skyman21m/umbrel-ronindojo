import { NextApiRequest, NextApiResponse } from "next";
import { Boom, badRequest } from "@hapi/boom";
import { Readable } from "stream";
import { taskEither, task, either, io, string } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { IntFromString } from "io-ts-types/IntFromString";

import { ContainersCodec, demuxStream, getDockerode, findContainerByName } from "../../../../lib/server/docker";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { PM2_LOG_PATH } from "../../../../const";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { readStream } from "../../../../lib/server/stream-to-promise";
import { tail } from "../../../../lib/server/tail";

export const RequestParams = t.type({
  id: t.union([ContainersCodec, t.literal("pm2")]),
  tail: IntFromString,
});

type RequestParamsType = t.TypeOf<typeof RequestParams>;

interface Response {
  logs: string;
}

const readPM2Logs = (numLines: number) => pipe(taskEither.tryCatch(() => tail(PM2_LOG_PATH)(numLines), toBoomError(503)));

export const getLogs = ({ id, tail }: RequestParamsType): taskEither.TaskEither<Boom, string> =>
  pipe(
    useRealData
      ? pipe(
          string.Eq.equals(id, "pm2")
            ? readPM2Logs(tail)
            : pipe(
                getDockerode,
                taskEither.fromIO,
                taskEither.chain((dockerode) => findContainerByName(dockerode, id)),
                taskEither.chain((container) =>
                  pipe(
                    taskEither.tryCatch(
                      () =>
                        container.logs({
                          follow: false,
                          stderr: true,
                          stdout: true,
                          timestamps: true,
                          tail: tail,
                        }) as unknown as Promise<Buffer>,
                      toBoomError(503),
                    ),
                    // transform Buffer to stream so we can use demux on it
                    taskEither.map((buff) => Readable.from(buff)),
                    taskEither.map(demuxStream(container)),
                    taskEither.chain(readStream),
                  ),
                ),
              ),
        )
      : pipe(taskEither.right(mockData), task.delay(2000)),
  );

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.query,
        RequestParams.decode,
        either.mapLeft(() => badRequest("Correct request params not provided")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(getLogs),
    taskEither.fold(sendErrorTask(res), (logs) => sendSuccessTask(res)({ logs })),
  )();
};

const mockData = `2021-11-30T02:34:32Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:34:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:34:50Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T02:34:50Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T02:34:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:35:02Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:35:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:35:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:35:32Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:35:42Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:35:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:36:02Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T02:36:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:36:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:36:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:36:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:36:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:37:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:37:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:37:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:37:32Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T02:37:42Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:37:52Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:38:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:38:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:38:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:38:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:38:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:38:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:39:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:39:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:39:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:39:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:39:42Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:39:50Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T02:39:50Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T02:39:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:40:02Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:40:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:40:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:40:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:40:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:40:52Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:41:02Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:41:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:41:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:41:32Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:41:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:41:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:42:02Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:42:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:42:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:42:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:42:42Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:42:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:43:02Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:43:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:43:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:43:32Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:43:42Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:43:52Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:44:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:44:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:44:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:44:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:44:42Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:44:49Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T02:44:49Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T02:44:52Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:45:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:45:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:45:23Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T02:45:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:45:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:45:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:46:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:46:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:46:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:46:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:46:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:46:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:47:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:47:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:47:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:47:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:47:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:47:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:48:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:48:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:48:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:48:33Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:48:43Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:48:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:49:03Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:49:10Z  INFO  Bitcoind RPC : Block 2105773 00000000000016107dd92a90510cc9a654309014fd3b2482a08f9399dd1f0b61
2021-11-30T02:49:10Z  INFO  Orchestrator : Block 2105773 00000000000016107dd92a90510cc9a654309014fd3b2482a08f9399dd1f0b61
2021-11-30T02:49:10Z  INFO  Tracker : Block #2105773 00000000000016107dd92a90510cc9a654309014fd3b2482a08f9399dd1f0b61
2021-11-30T02:49:10Z  INFO  Bitcoind RPC : Block 2105773 00000000000016107dd92a90510cc9a654309014fd3b2482a08f9399dd1f0b61
2021-11-30T02:49:10Z  INFO  Tracker : Beginning to process blocks 2105773-2105773
2021-11-30T02:49:10Z  INFO  Bitcoind RPC : Block 2105773 00000000000016107dd92a90510cc9a654309014fd3b2482a08f9399dd1f0b61
2021-11-30T02:49:11Z  INFO  Tracker :  Added block 2105773 (id=2113846)
2021-11-30T02:49:11Z  INFO  Tracker : Finished processing blocks 2105773-2105773, 0.3s, 347ms/block
2021-11-30T02:49:13Z  INFO  Tracker : Processing active Mempool (85 transactions)
2021-11-30T02:49:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:49:32Z  INFO  Tracker : Processing active Mempool (5 transactions)
2021-11-30T02:49:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:49:49Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T02:49:49Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T02:49:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:50:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:50:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:50:23Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:50:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:50:42Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:50:52Z  INFO  Tracker : Processing active Mempool (4 transactions)
2021-11-30T02:51:02Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:51:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:51:22Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:51:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:51:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:51:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:52:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:52:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:52:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:52:33Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:52:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:52:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:53:03Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:53:13Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:53:23Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:53:32Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:53:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:53:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:54:02Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:54:12Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:54:22Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:54:32Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:54:42Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:54:49Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T02:54:49Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T02:54:52Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:55:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:55:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:55:22Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:55:32Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T02:55:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:55:52Z  INFO  Tracker : Processing active Mempool (5 transactions)
2021-11-30T02:56:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:56:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:56:22Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:56:32Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:56:42Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:56:52Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:57:02Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:57:12Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:57:22Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:57:32Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T02:57:41Z  INFO  Tracker : Block #2105774 00000000000000360854b7829fe4586f8aebf13c6106960393fa968cc8ff4afb
2021-11-30T02:57:41Z  INFO  Bitcoind RPC : Block 2105774 00000000000000360854b7829fe4586f8aebf13c6106960393fa968cc8ff4afb
2021-11-30T02:57:41Z  INFO  Tracker : Beginning to process blocks 2105774-2105774
2021-11-30T02:57:41Z  INFO  Bitcoind RPC : Block 2105774 00000000000000360854b7829fe4586f8aebf13c6106960393fa968cc8ff4afb
2021-11-30T02:57:41Z  INFO  Bitcoind RPC : Block 2105774 00000000000000360854b7829fe4586f8aebf13c6106960393fa968cc8ff4afb
2021-11-30T02:57:41Z  INFO  Orchestrator : Block 2105774 00000000000000360854b7829fe4586f8aebf13c6106960393fa968cc8ff4afb
2021-11-30T02:57:41Z  INFO  Tracker :  Added block 2105774 (id=2113847)
2021-11-30T02:57:41Z  INFO  Tracker : Finished processing blocks 2105774-2105774, 0.2s, 238ms/block
2021-11-30T02:57:43Z  INFO  Tracker : Processing active Mempool (46 transactions)
2021-11-30T02:57:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:58:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:58:13Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T02:58:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:58:33Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:58:43Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:58:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:59:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T02:59:13Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:59:23Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T02:59:33Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:59:44Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T02:59:48Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T02:59:48Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T02:59:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:00:03Z  INFO  HttpServer : GET /static/admin/
2021-11-30T03:00:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:00:05Z  INFO  HttpServer : GET /static/admin/css/bootstrap.min.css
2021-11-30T03:00:05Z  INFO  HttpServer : GET /static/admin/css/bootstrap-theme.min.css
2021-11-30T03:00:05Z  INFO  HttpServer : GET /static/admin/css/style.css
2021-11-30T03:00:07Z  INFO  HttpServer : GET /static/admin/icons/samourai-logo.png
2021-11-30T03:00:13Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:00:23Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:00:33Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:00:43Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:00:53Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T03:00:54Z  INFO  HttpServer : GET /static/admin/
2021-11-30T03:00:55Z  INFO  HttpServer : GET /static/admin/css/bootstrap.min.css
2021-11-30T03:00:55Z  INFO  HttpServer : GET /static/admin/css/bootstrap-theme.min.css
2021-11-30T03:00:55Z  INFO  HttpServer : GET /static/admin/css/style.css
2021-11-30T03:00:55Z  INFO  HttpServer : GET /static/admin/conf/index.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/lib/common-script.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/lib/api-wrapper.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/lib/auth-utils.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/index.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/lib/messages.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/lib/errors-utils.js
2021-11-30T03:00:58Z  INFO  HttpServer : GET /static/admin/icons/samourai-logo.png
2021-11-30T03:00:59Z  INFO  HttpServer : GET /static/admin/dmt/msg-box/msg-box.html
2021-11-30T03:01:02Z  INFO  HttpServer : POST /auth/login
2021-11-30T03:01:02Z  INFO  Auth : Successful authentication with an admin key
2021-11-30T03:01:03Z  INFO  HttpServer : GET /static/admin/dmt/
2021-11-30T03:01:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:01:03Z  INFO  HttpServer : GET /static/admin/css/bootstrap.min.css
2021-11-30T03:01:04Z  INFO  HttpServer : GET /static/admin/css/bootstrap-theme.min.css
2021-11-30T03:01:04Z  INFO  HttpServer : GET /static/admin/css/style.css
2021-11-30T03:01:04Z  INFO  HttpServer : GET /static/admin/lib/qrcode.min.js
2021-11-30T03:01:04Z  INFO  HttpServer : GET /static/admin/conf/index.js
2021-11-30T03:01:04Z  INFO  HttpServer : GET /static/admin/lib/common-script.js
2021-11-30T03:01:05Z  INFO  HttpServer : GET /static/admin/lib/api-wrapper.js
2021-11-30T03:01:05Z  INFO  HttpServer : GET /static/admin/lib/auth-utils.js
2021-11-30T03:01:05Z  INFO  HttpServer : GET /static/admin/lib/format-utils.js
2021-11-30T03:01:05Z  INFO  HttpServer : GET /static/admin/lib/messages.js
2021-11-30T03:01:05Z  INFO  HttpServer : GET /static/admin/lib/errors-utils.js
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/dmt/index.js
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/icons/ic_power_settings_new_white_24dp_1x.png
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/icons/samourai-logo.png
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/dmt/welcome/welcome.html
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/dmt/status/status.html
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/dmt/pushtx/pushtx.html
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/dmt/pairing/pairing.html
2021-11-30T03:01:06Z  INFO  HttpServer : GET /static/admin/dmt/xpubs-tools/xpubs-tools.html
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/addresses-tools/addresses-tools.html
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/txs-tools/txs-tools.html
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/blocks-rescan/blocks-rescan.html
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/msg-box/msg-box.html
2021-11-30T03:01:07Z  INFO  HttpServer : GET /support/pairing?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/welcome/welcome.html
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/pairing/pairing.js
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/xpubs-tools/xpubs-tools.js
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/pushtx/pushtx.js
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/status/status.js
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/addresses-tools/addresses-tools.js
2021-11-30T03:01:07Z  INFO  HttpServer : GET /static/admin/dmt/txs-tools/txs-tools.js
2021-11-30T03:01:08Z  INFO  HttpServer : GET /static/admin/dmt/blocks-rescan/blocks-rescan.js
2021-11-30T03:01:08Z  INFO  HttpServer : GET /support/pairing/explorer?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:01:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:01:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:01:09Z  INFO  HttpServer : GET /support/pairing/explorer?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:01:09Z  INFO  HttpServer : GET /support/pairing/explorer?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:01:13Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:01:23Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:01:33Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:01:43Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:01:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:02:03Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:02:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:02:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:02:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:02:09Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:02:13Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:02:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:02:33Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:02:43Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:02:53Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:03:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:03:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:03:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:03:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:03:10Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:03:13Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T03:03:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:03:33Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:03:43Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:03:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:04:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:04:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:04:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:04:10Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:04:10Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:04:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:04:23Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:04:27Z  INFO  Bitcoind RPC : Block 2105775 0000000000000012c59609c061874e89d29a7c6074ac54e29afe9be7ebd85270
2021-11-30T03:04:27Z  INFO  Orchestrator : Block 2105775 0000000000000012c59609c061874e89d29a7c6074ac54e29afe9be7ebd85270
2021-11-30T03:04:27Z  INFO  Tracker : Block #2105775 0000000000000012c59609c061874e89d29a7c6074ac54e29afe9be7ebd85270
2021-11-30T03:04:27Z  INFO  Bitcoind RPC : Block 2105775 0000000000000012c59609c061874e89d29a7c6074ac54e29afe9be7ebd85270
2021-11-30T03:04:27Z  INFO  Bitcoind RPC : Block 2105775 0000000000000012c59609c061874e89d29a7c6074ac54e29afe9be7ebd85270
2021-11-30T03:04:27Z  INFO  Tracker : Beginning to process blocks 2105775-2105775
2021-11-30T03:04:27Z  INFO  Tracker :  Added block 2105775 (id=2113848)
2021-11-30T03:04:27Z  INFO  Tracker : Finished processing blocks 2105775-2105775, 0.1s, 114ms/block
2021-11-30T03:04:33Z  INFO  Tracker : Processing active Mempool (44 transactions)
2021-11-30T03:04:43Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:04:48Z  INFO  Tracker : Processing unconfirmed transactions
2021-11-30T03:04:48Z  INFO  Tracker : Finished processing unconfirmed transactions 0.0s, 0 tx, 0ms/tx
2021-11-30T03:04:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:05:03Z  INFO  Tracker : Processing active Mempool (2 transactions)
2021-11-30T03:05:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:05:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:05:10Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:05:10Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTI2MiwiZXhwIjoxNjM4MjQyMTYyfQ.CCutqDLFukjNIqlr5Hxn_7gTjREwiI58NhGs-bWhFxU
2021-11-30T03:05:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:05:23Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:05:33Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:05:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:05:53Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:06:03Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:06:06Z  INFO  HttpServer : POST /auth/refresh
2021-11-30T03:06:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:06:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:06:10Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:06:10Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:06:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:06:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:06:33Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:06:43Z  INFO  Tracker : Processing active Mempool (3 transactions)
2021-11-30T03:06:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:07:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:07:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:07:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:07:10Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:07:10Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:07:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:07:23Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:07:33Z  INFO  Tracker : Processing active Mempool (1 transactions)
2021-11-30T03:07:43Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:07:53Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:08:03Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:08:08Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:08:09Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:08:10Z  INFO  HttpServer : GET /status?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:08:11Z  INFO  HttpServer : GET /status/schedule?at=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJTYW1vdXJhaSBXYWxsZXQgYmFja2VuZCIsInR5cGUiOiJhY2Nlc3MtdG9rZW4iLCJwcmYiOiJhZG1pbiIsImlhdCI6MTYzODI0MTU2NiwiZXhwIjoxNjM4MjQyNDY2fQ.UGYRhikPFc2jV83S8RlnbQ5LE4JeSLVNwtc-OldVXos
2021-11-30T03:08:13Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:08:23Z  INFO  Tracker : Processing active Mempool (0 transactions)
2021-11-30T03:08:33Z  INFO  Tracker : Processing active Mempool (4 transactions)`;

export default withV2Middlewares(withSessionApi(handler));
