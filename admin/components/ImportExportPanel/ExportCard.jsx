import React from "react";

import { Box, Flex, Button, Typography } from "@strapi/design-system";
import { Download } from "@strapi/icons";

const ExportCard = ({ onOpen }) => (
  <Box flex="1" minWidth="280px" borderColor="neutral200" padding={5} hasRadius shadow="filterShadow">
    <Flex direction="column" gap={3}>
      <Typography variant="beta">Export database</Typography>
      <Typography textColor="neutral600">
        Runs <code>strapi export</code>. Auto backups use <code>backup-</code> prefix and are created by the cron job.
      </Typography>
      <Flex justifyContent="flex-end">
        <Button startIcon={<Download />} onClick={onOpen}>Export</Button>
      </Flex>
    </Flex>
  </Box>
);

export default ExportCard;
