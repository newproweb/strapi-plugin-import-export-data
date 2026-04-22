import React from "react";

import {
  Box, Flex, Button, Typography, Table, Thead, Tbody, Tr, Td, Th, Badge, Loader,
} from "@strapi/design-system";
import { Download, Trash, File } from "@strapi/icons";

import { formatBytes, formatDate, originOf } from "../../utils/format";

const FlagBadges = ({ row }) => (
  <Flex gap={2} wrap="wrap">
    {row.compressed && <Badge backgroundColor="primary100" textColor="primary700">gzip</Badge>}
    {row.encrypted && <Badge backgroundColor="warning100" textColor="warning700">encrypted</Badge>}
    {!row.compressed && !row.encrypted && <Badge backgroundColor="neutral150" textColor="neutral700">plain</Badge>}
  </Flex>
);

const RowActions = ({ file, working, onDownload, onRestore, onDelete }) => (
  <Flex gap={2}>
    <Button size="S" variant="tertiary" startIcon={<Download />} onClick={() => onDownload(file)}>
      Download
    </Button>
    <Button size="S" variant="secondary" onClick={() => onRestore(file)} disabled={working}>
      Restore
    </Button>
    <Button size="S" variant="danger-light" startIcon={<Trash />} onClick={() => onDelete(file)} disabled={working}>
      Delete
    </Button>
  </Flex>
);

const EmptyState = () => (
  <Flex direction="column" alignItems="center" padding={6} gap={2}>
    <File width="2rem" height="2rem" />
    <Typography textColor="neutral500">No backups yet. Export one above.</Typography>
  </Flex>
);

const BackupTable = ({ rows, loading, working, onReload, onDownload, onRestore, onDelete }) => (
  <>
    <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
      <Typography variant="beta">Backups</Typography>
      <Button variant="secondary" onClick={onReload} disabled={loading}>Refresh</Button>
    </Flex>

    {loading && (
      <Flex justifyContent="center" padding={6}>
        <Loader>Loading backups…</Loader>
      </Flex>
    )}

    {!loading && rows.length === 0 && <EmptyState />}

    {!loading && rows.length > 0 && (
      <Table colCount={6} rowCount={rows.length}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Created</Typography></Th>
            <Th><Typography variant="sigma">File</Typography></Th>
            <Th><Typography variant="sigma">Origin</Typography></Th>
            <Th><Typography variant="sigma">Flags</Typography></Th>
            <Th><Typography variant="sigma">Size</Typography></Th>
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr key={row.file}>
              <Td><Typography>{formatDate(row.createdAt)}</Typography></Td>
              <Td><Typography variant="pi">{row.file}</Typography></Td>
              <Td>
                <Badge backgroundColor="neutral150" textColor="neutral700">{originOf(row.file)}</Badge>
              </Td>
              <Td><FlagBadges row={row} /></Td>
              <Td><Typography>{formatBytes(row.size)}</Typography></Td>
              <Td>
                <RowActions
                  file={row.file}
                  working={working}
                  onDownload={onDownload}
                  onRestore={onRestore}
                  onDelete={onDelete}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    )}
  </>
);

export default BackupTable;
