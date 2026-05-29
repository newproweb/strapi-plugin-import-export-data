import React, { useEffect, useMemo, useState } from "react";

import { Modal, Dialog, Box, Flex, Button, Typography } from "@strapi/design-system";

import { useJobPolling } from "../../hooks/useJobPolling";
import { abortJob } from "../../utils/api";
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

const ELAPSED_TICK_MS = 1000;

const useElapsed = (job) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!job || job.status !== "running") return undefined;
    const id = setInterval(() => setTick((t) => t + 1), ELAPSED_TICK_MS);
    return () => clearInterval(id);
  }, [job?.status]);

  return useMemo(() => {
    if (!job) return 0;
    if (job.status === "running") return Date.now() - new Date(job.startedAt).getTime();
    return job.elapsedMs || 0;
  }, [job, tick]);
};

const JobProgressModal = ({ jobId, type = "export", token, onClose, onDone }) => {
  const { job, authLost, jobLost } = useJobPolling(jobId, onDone, token);
  const elapsedMs = useElapsed(job);

  const [abortConfirm, setAbortConfirm] = useState(false);
  const [aborting, setAborting] = useState(false);

  const confirmAbort = async () => {
    setAborting(true);
    try {
      await abortJob(jobId, token);
    } catch {
      /* the poll surfaces the final job state */
    }
  };

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
    <>
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
          {isRunning && token && (
            <Button
              variant="danger-light"
              onClick={() => setAbortConfirm(true)}
              disabled={aborting}
            >
              {aborting ? "Aborting…" : "Abort job"}
            </Button>
          )}
          <Button variant="tertiary" onClick={onClose}>
            {closeLabel({ isRunning, transferComplete })}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>

    <Dialog.Root open={abortConfirm} onOpenChange={(v) => { if (!v) setAbortConfirm(false); }}>
      <Dialog.Content>
        <Dialog.Header>Abort this job?</Dialog.Header>
        <Dialog.Body>
          <Typography>
            The running <code>strapi {type}</code> process will be terminated.
            {type === "import"
              ? " The restore then auto-rolls back to the pre-restore snapshot, returning the database to its previous state."
              : " The partially-written archive is discarded."}
          </Typography>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Keep running</Button>
          </Dialog.Cancel>
          <Dialog.Action>
            <Button variant="danger" onClick={confirmAbort}>Abort job</Button>
          </Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
    </>
  );
};

export default JobProgressModal;
