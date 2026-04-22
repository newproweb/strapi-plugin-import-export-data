import { getFetchClient } from "@strapi/strapi/admin";

import { basePath } from "./client";

export const getSchedule = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup-schedule`);
  return data?.data;
};

export const saveSchedule = async (payload) => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/backup-schedule`, payload);
  return data?.data;
};

export const runScheduledBackup = async () => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/backup/run-now`, {});
  return data?.data;
};
