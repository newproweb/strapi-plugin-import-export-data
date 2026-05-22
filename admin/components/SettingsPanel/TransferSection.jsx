import React from "react";

import { Box, Typography, Textarea } from "@strapi/design-system";

const toText = (value) => (Array.isArray(value) ? value.join("\n") : String(value || ""));

const TransferSection = ({ cfg, onField }) => (
  <Box paddingBottom={4}>
    <Typography variant="delta">Transfer recipients</Typography>
    <Box paddingTop={2}>
      <Textarea
        label="Default recipient emails"
        hint="Comma, space or newline separated. Every pre-restore snapshot is emailed to these addresses as a download link — leave empty to disable auto-send."
        value={toText(cfg.transferRecipients)}
        onChange={(e) => onField("transferRecipients", e.target.value)}
      />
    </Box>
  </Box>
);

export default TransferSection;
