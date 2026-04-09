import axios from "axios";

export const client = axios.create({ baseURL: "/api/v2/" });

export const fetcher = (url: string) => client.get(url).then((res) => res.data);
