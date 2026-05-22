import { getFetchClient } from "@strapi/strapi/admin";

import { basePath } from "./client";

export const getJobStatus = async (jobId) => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup/job/${encodeURIComponent(jobId)}`);
  return data?.data;
};

// Token-gated progress poll — does not need an admin session, so it keeps
// working while an import has wiped the auth tables.
export const getJobProgress = async (jobId, token) => {
  const { get } = getFetchClient();
  const { data } = await get(
    `${basePath}/backup/job/${encodeURIComponent(jobId)}/progress?token=${encodeURIComponent(token)}`,
  );
  return data?.data;
};

export const listJobs = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup/jobs`);
  return data?.data ?? [];
};
