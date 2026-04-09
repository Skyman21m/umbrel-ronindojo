import { NextApiResponse } from "next";
import { Boom } from "@hapi/boom";
import { task, io } from "fp-ts";

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

export const sendError = (res: NextApiResponse<ErrorResponse>) => (error: Boom) => {
  console.trace(error.stack);
  return res.status(error.output.payload.statusCode).json(error.output.payload);
};

export const sendErrorIO = (res: NextApiResponse<ErrorResponse>) => (error: Boom) => {
  console.trace(error.stack);
  return io.of(res.status(error.output.payload.statusCode).json(error.output.payload));
};

export const sendErrorTask = (res: NextApiResponse<ErrorResponse>) => (error: Boom) => {
  console.trace(error.stack);
  return task.of(res.status(error.output.payload.statusCode).json(error.output.payload));
};
