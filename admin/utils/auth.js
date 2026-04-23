const readStatus = (err) => err?.status ?? err?.response?.status;

export const isAuthError = (err) => {
  const status = readStatus(err);
  return status === 401 || status === 403;
};

/**
 * True when the backend reported the polled job ID as unknown. That
 * happens when the Strapi process was restarted between starting the
 * job and this poll (e.g. chokidar watcher restart in `strapi develop`),
 * because the job registry lives in-process memory and is lost on exit.
 */
export const isJobLostError = (err) => readStatus(err) === 404;
