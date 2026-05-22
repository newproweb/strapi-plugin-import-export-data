import { useEffect, useRef, useState } from "react";

import { getJobStatus, getJobProgress } from "../utils/api";
import { isAuthError, isJobLostError } from "../utils/auth";
import { POLL_INTERVAL_MS } from "../constants/jobs";

const MAX_ERRORS = 10;

// When a per-job `token` is available, poll the DB-independent progress route
// so the modal survives an import wiping the admin auth tables; otherwise fall
// back to the admin-authenticated status route.
export const useJobPolling = (jobId, onDone, token) => {
  const [job, setJob] = useState(null);
  const [authLost, setAuthLost] = useState(false);
  const [jobLost, setJobLost] = useState(false);
  const onDoneRef = useRef(onDone);
  const timerRef = useRef(null);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!jobId) return undefined;

    let cancelled = false;
    let doneFired = false;
    let errors = 0;

    const fetchJob = () => (token ? getJobProgress(jobId, token) : getJobStatus(jobId));

    const pump = async () => {
      try {
        const next = await fetchJob();
        if (cancelled) return;
        errors = 0;
        setJob(next);
        if (next?.status === "running") {
          timerRef.current = setTimeout(pump, POLL_INTERVAL_MS);
          return;
        }
        if (doneFired) return;
        doneFired = true;
        onDoneRef.current?.(next);
      } catch (err) {
        if (cancelled) return;
        if (isAuthError(err)) return setAuthLost(true);
        // 404 == the job registry no longer has this id (server restarted).
        // Retrying won't help: the CLI child died with the parent and the
        // new process has a fresh, empty jobs Map. Stop immediately and
        // let the modal show a dedicated notice.
        if (isJobLostError(err)) return setJobLost(true);
        errors += 1;
        if (errors > MAX_ERRORS) return;
        timerRef.current = setTimeout(pump, POLL_INTERVAL_MS * 2);
      }
    };

    pump();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, token]);

  return { job, authLost, jobLost };
};
