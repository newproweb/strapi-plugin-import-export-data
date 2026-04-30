import { useCallback, useEffect, useRef, useState } from "react";

import { listJobs } from "../utils/api";
import { isAuthError } from "../utils/auth";
import { RUNNING_JOBS_POLL_MS, RUNNING_JOBS_IDLE_POLL_MS } from "../constants/jobs";

const isVisible = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

/**
 * Polls `/backup/jobs` and returns the running ones plus a `refresh` callback.
 * `refresh()` cancels the pending idle poll and runs an immediate fetch — call
 * it right after starting a new job so the RunningJobsBanner shows up without
 * waiting for the 20s idle interval.
 */
export const useRunningJobs = () => {
  const [runningJobs, setRunningJobs] = useState([]);
  const timerRef = useRef(null);
  const runningCountRef = useRef(0);
  const pumpRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let authLost = false;

    const schedule = () => {
      if (cancelled || authLost) return;
      const delay = runningCountRef.current > 0
        ? RUNNING_JOBS_POLL_MS
        : RUNNING_JOBS_IDLE_POLL_MS;
      timerRef.current = setTimeout(pump, delay);
    };

    const pump = async () => {
      if (cancelled || authLost) return;
      if (!isVisible()) return schedule();

      try {
        const all = await listJobs();
        if (cancelled) return;
        const running = (all || []).filter((j) => j.status === "running");
        runningCountRef.current = running.length;
        setRunningJobs(running);
      } catch (err) {
        if (isAuthError(err)) {
          authLost = true;
          return;
        }
      }
      schedule();
    };

    pumpRef.current = pump;

    const onVisibility = () => {
      if (!isVisible()) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      pump();
    };

    pump();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      pumpRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, []);

  const refresh = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pumpRef.current?.();
  }, []);

  return { runningJobs, refresh };
};
