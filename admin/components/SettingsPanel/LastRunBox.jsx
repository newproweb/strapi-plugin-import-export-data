import React from "react";

import { Box, Typography } from "@strapi/design-system";

const LastRunBox = ({ lastBackupAt }) => (
  <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow">
    <Typography variant="sigma" paddingBottom={1}>Last auto-backup</Typography>
    <Typography>
      {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "—"}
    </Typography>
  </Box>
);

export default LastRunBox;
