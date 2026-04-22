import React from "react";

import {
  Box, Flex, Badge, Typography, Table, Thead, Tbody, Tr, Td, Th,
} from "@strapi/design-system";

const StatBadge = ({ bg, fg, label, value }) => (
  <Badge backgroundColor={bg} textColor={fg}>{label}: {value}</Badge>
);

const FailuresTable = ({ failures }) => (
  <Box>
    <Typography variant="delta" marginBottom={2}>Failures</Typography>
    <Table colCount={2} rowCount={failures.length}>
      <Thead>
        <Tr>
          <Th><Typography variant="sigma">Row</Typography></Th>
          <Th><Typography variant="sigma">Error</Typography></Th>
        </Tr>
      </Thead>
      <Tbody>
        {failures.map((f) => (
          <Tr key={f.row}>
            <Td><Typography>{f.row}</Typography></Td>
            <Td><Typography textColor="danger600">{f.error}</Typography></Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  </Box>
);

const ResultView = ({ result }) => (
  <Box>
    <Flex gap={3} marginBottom={4}>
      <StatBadge bg="success100" fg="success700" label="Created" value={result.created} />
      <StatBadge bg="primary100" fg="primary700" label="Updated" value={result.updated} />
      <StatBadge bg="neutral150" fg="neutral700" label="Skipped" value={result.skipped} />
      <StatBadge bg="danger100" fg="danger700" label="Failed" value={result.failed} />
      <StatBadge bg="neutral150" fg="neutral700" label="Total" value={result.total} />
    </Flex>
    {result.failures?.length > 0 && <FailuresTable failures={result.failures} />}
  </Box>
);

export default ResultView;
