import React from "react";

import { Box, Typography } from "@strapi/design-system";

const Notice = ({ background, textColor, children }) => (
  <Box background={background} padding={3} hasRadius>
    <Typography textColor={textColor}>{children}</Typography>
  </Box>
);

export const TransferCompleteNotice = () => (
  <Notice background="success100" textColor="success700">
    Transfer completed — data is already on disk. The CLI child is finishing post-transfer cleanup; you can close this dialog safely.
  </Notice>
);

export const AuthLostNotice = () => (
  <Notice background="warning100" textColor="warning700">
    Your admin session was invalidated during the restore. The job is still running on the server — sign back in to see its final status. (Polling has been stopped to avoid flooding the log with 401s.)
  </Notice>
);

export const SuccessNotice = ({ job }) => (
  <Notice background="success100" textColor="success700">
    {job.type === "export"
      ? `Archive ${job.result.file} ready (${Math.round((job.result.size || 0) / 1024)} KiB).`
      : `${job.result.file} restored. Restart Strapi so the admin reloads a fresh schema cache.`}
  </Notice>
);

export const ErrorNotice = ({ error }) => (
  <Notice background="danger100" textColor="danger700">
    {error || "Job failed — see the log above for details."}
  </Notice>
);
