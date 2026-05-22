import React from "react";

import { Box, Typography } from "@strapi/design-system";

import EmailChipsInput from "../EmailChipsInput";

const TransferSection = ({ cfg, onField }) => (
  <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow" marginBottom={4}>
    <Box paddingBottom={4}>
      <Typography variant="beta">Transfer recipients</Typography>
    </Box>
    <EmailChipsInput
      label="Default recipient emails"
      hint="Every pre-restore snapshot is emailed to these addresses as a download link. Leave empty to disable auto-send."
      value={Array.isArray(cfg.transferRecipients) ? cfg.transferRecipients : []}
      onChange={(list) => onField("transferRecipients", list)}
    />
  </Box>
);

export default TransferSection;
