import React from "react";

import { Box, Flex, Typography, Loader } from "@strapi/design-system";
import { Database } from "@strapi/icons";

const PreviewPane = ({ working, selected }) => (
  <Box flex="1" minWidth="320px" background="neutral100" hasRadius padding={8}>
    <Flex direction="column" alignItems="center" justifyContent="center" gap={3} style={{ minHeight: 280 }}>
      <Box background="neutral0" hasRadius padding={6} shadow="filterShadow">
        <Database width="5rem" height="5rem" />
      </Box>
      {working && (
        <>
          <Loader>Starting `strapi export`…</Loader>
          <Typography textColor="neutral600">
            Selected: <code>{selected.label}</code>
          </Typography>
        </>
      )}
      {!working && (
        <Typography textColor="neutral600" textAlign="center">
          Choose a format on the right. Each option calls
          {" "}<code>strapi export</code> with the matching flags. Progress is shown in a live log modal after you start.
        </Typography>
      )}
    </Flex>
  </Box>
);

export default PreviewPane;
