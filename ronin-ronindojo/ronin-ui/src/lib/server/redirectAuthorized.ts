import { GetServerSidePropsResult, GetServerSidePropsContext } from "next";
import { dataFileExists } from "./dataFile";
import { SETUP_PAGE } from "../../routes";

export const redirectAuthorized = async (ctx: GetServerSidePropsContext): Promise<GetServerSidePropsResult<{}>> => {
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

  if (user) {
    return {
      redirect: {
        permanent: false,
        destination: "/",
      },
    };
  }

  return {
    props: {},
  };
};
