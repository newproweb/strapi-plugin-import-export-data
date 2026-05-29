import React from "react";

import { Box } from "@strapi/design-system";
import { Bell } from "@strapi/icons";

import EmailChipsInput from "../EmailChipsInput";
import SectionHeading from "../SectionHeading";

const TransferSection = ({ cfg, onField }) => (
  <Box borderColor="neutral200" padding={5} hasRadius shadow="filterShadow" marginBottom={4}>
    <Box paddingBottom={4}>
      <SectionHeading
        icon={<Bell width="1.5rem" height="1.5rem" />}
        title="Notification Settings"
        subtitle="Email backup download links to these recipients automatically."
      />
    </Box>
    <EmailChipsInput
      label="Transfer recipients"
      hint="Every pre-restore snapshot is emailed to these addresses as a download link. Leave empty to disable auto-send."
      value={Array.isArray(cfg.transferRecipients) ? cfg.transferRecipients : []}
      onChange={(list) => onField("transferRecipients", list)}
    />
  </Box>
);

export default TransferSection;
