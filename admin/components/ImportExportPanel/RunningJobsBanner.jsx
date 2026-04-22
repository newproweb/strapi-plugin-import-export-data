import React from "react";

import { Box, Flex, Button, Loader, Typography } from "@strapi/design-system";

import { formatElapsed } from "../../utils/format";

const RunningJobsBanner = ({ jobs, onSelect }) => {
  if (!jobs || jobs.length === 0) return null;

  return (
    <Box
      background="primary100"
      padding={3}
      hasRadius
      marginBottom={4}
      style={{ border: "1px solid var(--strapi-primary-200, #a5b4fc)" }}
    >
      <Flex gap={3} wrap="wrap" alignItems="center">
        <Loader small />
        <Typography fontWeight="bold" textColor="primary700">
          {jobs.length} job{jobs.length > 1 ? "s" : ""} running
        </Typography>
        <Flex gap={2} wrap="wrap">
          {jobs.map((j) => (
            <Button
              key={j.id}
              size="S"
              variant="tertiary"
              onClick={() => onSelect({ jobId: j.id, type: j.type })}
            >
              {j.type} · {j.progress?.percent ? `${j.progress.percent}%` : "…"} · {formatElapsed(j.elapsedMs)}
              {j.transferComplete ? " ✓ transfer done" : ""}
            </Button>
          ))}
        </Flex>
      </Flex>
    </Box>
  );
};

export default RunningJobsBanner;
