import { NextApiResponse } from "next";
import { task, io } from "fp-ts";

export const sendSuccess =
  <T extends Record<string, any>>(res: NextApiResponse<T>) =>
  (data: T) =>
    res.status(200).json(data);

export const sendSuccessIO =
  <T extends Record<string, any>>(res: NextApiResponse<T>) =>
  (data: T) =>
    io.of(res.status(200).json(data));

export const sendSuccessTask =
  <T extends Record<string, any>>(res: NextApiResponse<T>) =>
  (data: T) =>
    task.of(res.status(200).json(data));
