import { useEffect, useState } from "react";

import { listJobs } from "../utils/api";
import { isAuthError } from "../utils/auth";
import { RUNNING_JOBS_POLL_MS } from "../constants/jobs";

export const useRunningJobs = () => {
  const [runningJobs, setRunningJobs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let authLost = false;
    let intervalId = null;

    const pump = async () => {
      if (authLost) return;
      try {
        const all = await listJobs();
        if (cancelled) return;
        setRunningJobs((all || []).filter((j) => j.status === "running"));
      } catch (err) {
        if (!isAuthError(err)) return;
        authLost = true;
        if (intervalId) clearInterval(intervalId);
      }
    };

    pump();
    intervalId = setInterval(pump, RUNNING_JOBS_POLL_MS);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return runningJobs;
};
