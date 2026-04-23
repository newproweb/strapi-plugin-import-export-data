import React, { useEffect, useMemo, useState } from "react";

import { Modal, Box, Flex, Button, Typography } from "@strapi/design-system";

import { useJobPolling } from "../../hooks/useJobPolling";
import { JOB_TITLES } from "../../constants/jobs";
import { formatElapsed } from "../../utils/format";

import ProgressBar from "./ProgressBar";
import LogPanel from "./LogPanel";
import StatusBadge from "./StatusBadge";
import {
  TransferCompleteNotice, AuthLostNotice, JobLostNotice, SuccessNotice, ErrorNotice,
} from "./Notices";

const LIVE_LINE_STYLE = {
  fontFamily: "monospace",
  fontSize: 12,
  color: "#e2e2ea",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const LIVE_LINE_BOX = {
  minHeight: 32,
  backgroundColor: "#1b1b24",
  border: "1px solid #2a2a36",
};

const closeLabel = ({ isRunning, transferComplete }) => {
  if (transferComplete && isRunning) return "Close (transfer done)";
  if (isRunning) return "Close (keeps running in background)";
  return "Close";
};

const useElapsed = (job) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!job || job.status !== "running") return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [job?.status]);

  return useMemo(() => {
    if (!job) return 0;
    if (job.status === "running") return Date.now() - new Date(job.startedAt).getTime();
    return job.elapsedMs || 0;
  }, [job, tick]);
};

const JobProgressModal = ({ jobId, type = "export", onClose, onDone }) => {
  const { job, authLost, jobLost } = useJobPolling(jobId, onDone);
  const elapsedMs = useElapsed(job);

  const { title, verb } = JOB_TITLES[type] || JOB_TITLES.export;

  const isRunning = !job || job.status === "running";
  const isSuccess = job?.status === "success";
  const isError = job?.status === "error";
  const percent = job?.progress?.percent || 0;
  const hasPercent = Number.isFinite(percent) && percent > 0;
  const stage = job?.progress?.stage || "";
  const lastLine = job?.lastLine || (isRunning ? "Spawning strapi CLI…" : "");
  const transferComplete = Boolean(job?.transferComplete);

  const stageLabel = stage || (isRunning ? "Working…" : isSuccess ? "Done" : "Failed");
  const percentLabel = hasPercent ? `${percent}%` : isRunning ? "—" : isSuccess ? "100%" : "";

  return (
    <Modal.Root open onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <Modal.Content style={{ maxWidth: 720 }}>
        <Modal.Header>
          <Modal.Title>
            <StatusBadge
              title={title}
              isRunning={isRunning}
              isSuccess={isSuccess}
              isError={isError}
              transferComplete={transferComplete}
            />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" gap={4}>
            <Flex justifyContent="space-between" alignItems="center">
              <Typography variant="pi" textColor="neutral600">
                <code>{verb}</code> · job <code>{jobId}</code>
              </Typography>
              <Typography variant="pi" textColor="neutral600">
                Elapsed: {formatElapsed(elapsedMs)}
              </Typography>
            </Flex>

            {isRunning && (
              <Typography variant="pi" textColor="neutral500">
                You can safely close this dialog — the CLI keeps running on the server and its progress stays in the "Running jobs" bar on the Import/Export page.
              </Typography>
            )}

            <Box>
              <ProgressBar percent={percent} indeterminate={isRunning && !hasPercent} />
              <Flex justifyContent="space-between" paddingTop={1}>
                <Typography variant="pi" textColor="neutral600">{stageLabel}</Typography>
                <Typography variant="pi" textColor="neutral600">{percentLabel}</Typography>
              </Flex>
            </Box>

            {isRunning && (
              <Box padding={3} hasRadius style={LIVE_LINE_BOX}>
                <div style={LIVE_LINE_STYLE}>{lastLine || "waiting for output…"}</div>
              </Box>
            )}

            {isRunning && transferComplete && <TransferCompleteNotice />}
            {authLost && <AuthLostNotice />}
            {jobLost && <JobLostNotice />}

            <LogPanel lines={job?.recentLines || []} />

            {isSuccess && job?.result && <SuccessNotice job={job} />}
            {isError && <ErrorNotice error={job?.error} />}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>
            {closeLabel({ isRunning, transferComplete })}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default JobProgressModal;
