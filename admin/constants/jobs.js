export const POLL_INTERVAL_MS = 1000;

export const RUNNING_JOBS_POLL_MS = 3000;
export const RUNNING_JOBS_IDLE_POLL_MS = 20000;

export const JOB_TITLES = {
  export: { title: "Exporting database", verb: "strapi export" },
  import: { title: "Importing database", verb: "strapi import --force" },
};
