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

// Token-gated abort — raises the abort signal for a running job without
// needing an admin session, so it works while an import has wiped auth.
export const abortJob = async (jobId, token) => {
  const { post } = getFetchClient();
  const { data } = await post(
    `${basePath}/backup/job/${encodeURIComponent(jobId)}/abort`,
    { token },
  );
  return data?.data;
};
