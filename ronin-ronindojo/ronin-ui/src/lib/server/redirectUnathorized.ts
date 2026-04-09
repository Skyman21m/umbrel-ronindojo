import { GetServerSidePropsResult, GetServerSidePropsContext } from "next";

import { SETUP_PAGE, SIGNIN_PAGE, DOCKER_ERROR, INSTALL_PROGRESS } from "../../routes";
import { dataFileExists } from "./dataFile";
import { SessionData } from "./session";
import { allDojoImagesBuilt, isDockerRunning } from "./docker";

export const redirectUnathorized = async (ctx: GetServerSidePropsContext): Promise<GetServerSidePropsResult<{ user: SessionData }>> => {
  const dataFile = await dataFileExists();

  if (!dataFile) {
    return {
      redirect: {
        permanent: false,
        destination: SETUP_PAGE,
      },
    };
  }

  const user = ctx.req.session.user;

  if (!user) {
    return {
      redirect: {
        permanent: false,
        destination: SIGNIN_PAGE,
      },
    };
  }

  const dockerIsRunning = await isDockerRunning();

  if (!dockerIsRunning && ctx.resolvedUrl !== DOCKER_ERROR) {
    return {
      redirect: {
        permanent: false,
        destination: DOCKER_ERROR,
      },
    };
  }

  const imagesBuilt = await allDojoImagesBuilt();

  if (!imagesBuilt && ctx.resolvedUrl !== INSTALL_PROGRESS) {
    return {
      redirect: {
        permanent: false,
        destination: INSTALL_PROGRESS,
      },
    };
  }

  return {
    props: { user },
  };
};
