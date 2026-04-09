import { NextApiRequest, NextApiResponse } from "next";
import Dockerode from "dockerode";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { boolean } from "fp-ts";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { listContainers } from "../../../../lib/server/docker";
import { withSessionApi } from "../../../../lib/server/session";
import { useRealData } from "../../../../lib/common";

const mockData: Dockerode.ContainerInfo[] = [
  {
    Id: "8dfafdbc3ds0",
    Names: ["/db"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 1",
    Created: 1367854155,
    State: "Running",
    Status: "Running for 2 minutes",
    Ports: [
      {
        PrivatePort: 2222,
        PublicPort: 3333,
        Type: "tcp",
        IP: "",
      },
    ],
    Labels: {
      "com.example.vendor": "Acme",
      "com.example.license": "GPL",
      "com.example.version": "1.0",
    },
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "2cdc4edb1ded3631c81f57966563e5c8525b81121bb3706a9a9a3ae102711f3f",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.2",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:02",
        },
      },
    },
    Mounts: [
      {
        Name: "fac362...80535",
        Source: "/data",
        Destination: "/data",
        Driver: "local",
        Mode: "ro,Z",
        RW: false,
        Propagation: "",
        Type: "",
      },
    ],
  },
  {
    Id: "8djknfdbc3a40",
    Names: ["/nodejs"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 1",
    Created: 1367854155,
    State: "Running",
    Status: "Running for 2 minutes",
    Ports: [
      {
        PrivatePort: 2222,
        PublicPort: 3333,
        Type: "tcp",
        IP: "",
      },
    ],
    Labels: {
      "com.example.vendor": "Acme",
      "com.example.license": "GPL",
      "com.example.version": "1.0",
    },
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "2cdc4edb1ded3631c81f57966563e5c8525b81121bb3706a9a9a3ae102711f3f",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.2",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:02",
        },
      },
    },
    Mounts: [
      {
        Name: "fac362...80535",
        Source: "/data",
        Destination: "/data",
        Driver: "local",
        Mode: "ro,Z",
        RW: false,
        Propagation: "",
        Type: "",
      },
    ],
  },
  {
    Id: "8dfafdbc3a40",
    Names: ["/mempool"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 1",
    Created: 1367854155,
    State: "Running",
    Status: "Running for 2 minutes",
    Ports: [
      {
        PrivatePort: 2222,
        PublicPort: 3333,
        Type: "tcp",
        IP: "",
      },
    ],
    Labels: {
      "com.example.vendor": "Acme",
      "com.example.license": "GPL",
      "com.example.version": "1.0",
    },
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "2cdc4edb1ded3631c81f57966563e5c8525b81121bb3706a9a9a3ae102711f3f",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.2",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:02",
        },
      },
    },
    Mounts: [
      {
        Name: "fac362...80535",
        Source: "/data",
        Destination: "/data",
        Driver: "local",
        Mode: "ro,Z",
        RW: false,
        Propagation: "",
        Type: "",
      },
    ],
  },
  {
    Id: "9cd87474be90",
    Names: ["/bitcoind"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 222222",
    Created: 1367854155,
    State: "Running",
    Status: "Running for 2 minutes",
    Ports: [],
    Labels: {},
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "88eaed7b37b38c2a3f0c4bc796494fdf51b270c2d22656412a2ca5d559a64d7a",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.8",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:08",
        },
      },
    },
    Mounts: [],
  },
  {
    Id: "8djknndhc3a40",
    Names: ["/tor"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 1",
    Created: 1367854155,
    State: "Running",
    Status: "Running for 2 minutes",
    Ports: [
      {
        PrivatePort: 2222,
        PublicPort: 3333,
        Type: "tcp",
        IP: "",
      },
    ],
    Labels: {
      "com.example.vendor": "Acme",
      "com.example.license": "GPL",
      "com.example.version": "1.0",
    },
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "2cdc4edb1ded3631c81f57966563e5c8525b81121bb3706a9a9a3ae102711f3f",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.2",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:02",
        },
      },
    },
    Mounts: [
      {
        Name: "fac362...80535",
        Source: "/data",
        Destination: "/data",
        Driver: "local",
        Mode: "ro,Z",
        RW: false,
        Propagation: "",
        Type: "",
      },
    ],
  },
  {
    Id: "4cb07b47f9fb",
    Names: ["/indexer"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 444444444444444444444444444444444",
    Created: 1367854152,
    State: "Running",
    Status: "Running for 2 minutes",
    Ports: [],
    Labels: {},
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "d91c7b2f0644403d7ef3095985ea0e2370325cd2332ff3a3225c4247328e66e9",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.5",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:05",
        },
      },
    },
    Mounts: [],
  },
  {
    Id: "4cb07b47f9fd",
    Names: ["/specter"],
    Image: "ubuntu:latest",
    ImageID: "d74508fb6632491cea586a1fd7d748dfc5274cd6fdfedee309ecdcbc2bf5cb82",
    Command: "echo 444444444444444444444444444444444",
    Created: 1367854152,
    State: "Exited",
    Status: "Exited 0",
    Ports: [],
    Labels: {},
    HostConfig: {
      NetworkMode: "default",
    },
    NetworkSettings: {
      Networks: {
        bridge: {
          NetworkID: "7ea29fc1412292a2d7bba362f9253545fecdfa8ce9a6e37dd10ba8bee7129812",
          EndpointID: "d91c7b2f0644403d7ef3095985ea0e2370325cd2332ff3a3225c4247328e66e9",
          Gateway: "172.17.0.1",
          IPAddress: "172.17.0.5",
          IPPrefixLen: 16,
          IPv6Gateway: "",
          GlobalIPv6Address: "",
          GlobalIPv6PrefixLen: 0,
          MacAddress: "02:42:ac:11:00:05",
        },
      },
    },
    Mounts: [],
  },
];

export type Response = Dockerode.ContainerInfo[];

const methods = "GET";

export const getContainerInfo = pipe(useRealData ? listContainers : pipe(taskEither.right(mockData), task.delay(2000)));

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getContainerInfo),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
