import { getFetchClient } from "@strapi/strapi/admin";

import { basePath } from "./client";

export const getJobStatus = async (jobId) => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup/job/${encodeURIComponent(jobId)}`);
  return data?.data;
};

export const listJobs = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup/jobs`);
  return data?.data ?? [];
};
