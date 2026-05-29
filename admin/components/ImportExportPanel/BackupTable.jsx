import React, { useState } from "react";

import {
  Box, Flex, Button, Typography, Table, Thead, Tbody, Tr, Td, Th, Badge, Loader, IconButton,
} from "@strapi/design-system";
import {
  Download, Trash, File, Mail, Archive, ArrowClockwise, ClockCounterClockwise,
  ChevronLeft, ChevronRight, CaretUp, CaretDown,
} from "@strapi/icons";

import SectionHeading from "../SectionHeading";
import { formatBytes, formatBytesExact, formatDate, originOf } from "../../utils/format";

const PAGE_SIZE = 8;
const PAGE_WINDOW = 2;

const FlagBadges = ({ row }) => (
  <Flex gap={1} wrap="wrap">
    {row.compressed && <Badge backgroundColor="primary100" textColor="primary700">gzip</Badge>}
    {row.encrypted && <Badge backgroundColor="warning100" textColor="warning700">encrypted</Badge>}
    {!row.compressed && !row.encrypted && <Badge backgroundColor="neutral150" textColor="neutral700">plain</Badge>}
  </Flex>
);

const RowActions = ({ file, working, downloading, onDownload, onTransfer, onRestore, onDelete }) => {
  const isDownloading = downloading?.file === file;

  if (isDownloading) {
    const label = downloading.percent > 0 ? `${downloading.percent}%` : "…";
    return (
      <Flex justifyContent="flex-end" alignItems="center" gap={2} minHeight="2rem">
        <Loader small />
        <Typography variant="pi" fontWeight="bold" textColor="primary600">{label}</Typography>
      </Flex>
    );
  }

  return (
    <Flex gap={1} justifyContent="flex-end">
      <IconButton variant="ghost" label="Download" disabled={Boolean(downloading)} onClick={() => onDownload(file)}>
        <Download />
      </IconButton>
      <IconButton variant="ghost" label="Email download link" disabled={working} onClick={() => onTransfer(file)}>
        <Mail />
      </IconButton>
      <IconButton variant="ghost" label="Restore" disabled={working} onClick={() => onRestore(file)}>
        <ClockCounterClockwise />
      </IconButton>
      <IconButton variant="danger-light" label="Delete" disabled={working} onClick={() => onDelete(file)}>
        <Trash />
      </IconButton>
    </Flex>
  );
};

const EmptyState = () => (
  <Flex direction="column" alignItems="center" padding={7} gap={2}>
    <Flex background="neutral100" textColor="neutral500" hasRadius padding={3} aria-hidden="true">
      <File width="1.5rem" height="1.5rem" />
    </Flex>
    <Typography variant="delta" textColor="neutral700">No backups yet</Typography>
    <Typography variant="pi" textColor="neutral500">Export one above and it will appear here.</Typography>
  </Flex>
);

const BackupTable = ({ rows, loading, working, downloading, onReload, onDownload, onTransfer, onRestore, onDelete }) => {
  const [page, setPage] = useState(1);
  const [sortDir, setSortDir] = useState("desc");

  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.createdAt).getTime() || 0;
    const db = new Date(b.createdAt).getTime() || 0;
    return sortDir === "asc" ? da - db : db - da;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const toggleSort = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const subtitle = sorted.length
    ? `${sorted.length} archive${sorted.length === 1 ? "" : "s"} stored — download, restore or remove.`
    : "Your stored archives will be listed here.";

  const refreshButton = (
    <Button variant="secondary" startIcon={<ArrowClockwise />} onClick={onReload} disabled={loading}>
      Refresh
    </Button>
  );

  const renderDateHeader = () => (
    <Th>
      <Flex gap={1} alignItems="center">
        <Typography variant="sigma">Date</Typography>
        <IconButton
          variant="ghost"
          label={sortDir === "asc" ? "Sort newest first" : "Sort oldest first"}
          onClick={toggleSort}
        >
          {sortDir === "asc" ? <CaretUp /> : <CaretDown />}
        </IconButton>
      </Flex>
    </Th>
  );

  const renderRow = (row) => (
    <Tr key={row.file}>
      <Td><Typography textColor="neutral800">{formatDate(row.createdAt)}</Typography></Td>
      <Td><Typography variant="pi" textColor="neutral700">{row.file}</Typography></Td>
      <Td><Badge backgroundColor="neutral150" textColor="neutral700">{originOf(row.file)}</Badge></Td>
      <Td><FlagBadges row={row} /></Td>
      <Td><Badge backgroundColor="success100" textColor="success700">Ready</Badge></Td>
      <Td><Typography title={formatBytesExact(row.size)}>{formatBytes(row.size)}</Typography></Td>
      <Td>
        <RowActions
          file={row.file}
          working={working}
          downloading={downloading}
          onDownload={onDownload}
          onTransfer={onTransfer}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      </Td>
    </Tr>
  );

  const pageNumbers = () => {
    const from = Math.max(1, current - PAGE_WINDOW);
    const to = Math.min(pageCount, current + PAGE_WINDOW);
    const list = [];
    for (let p = from; p <= to; p += 1) list.push(p);
    return list;
  };

  const renderPagination = () => {
    if (pageCount <= 1) return null;
    return (
      <Flex justifyContent="space-between" alignItems="center" paddingTop={4} wrap="wrap" gap={2}>
        <Typography variant="pi" textColor="neutral600">
          {`Showing ${start + 1}–${Math.min(start + PAGE_SIZE, sorted.length)} of ${sorted.length}`}
        </Typography>
        <Flex gap={1} alignItems="center">
          <IconButton variant="ghost" label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <ChevronLeft />
          </IconButton>
          {pageNumbers().map((p) => (
            <Button key={p} size="S" variant={p === current ? "default" : "tertiary"} onClick={() => setPage(p)}>
              {String(p)}
            </Button>
          ))}
          <IconButton variant="ghost" label="Next page" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            <ChevronRight />
          </IconButton>
        </Flex>
      </Flex>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <Flex justifyContent="center" padding={7}>
          <Loader>Loading backups…</Loader>
        </Flex>
      );
    }
    if (sorted.length === 0) return <EmptyState />;
    return (
      <>
        <Table colCount={7} rowCount={paged.length}>
          <Thead>
            <Tr>
              {renderDateHeader()}
              <Th><Typography variant="sigma">File</Typography></Th>
              <Th><Typography variant="sigma">Origin</Typography></Th>
              <Th><Typography variant="sigma">Flags</Typography></Th>
              <Th><Typography variant="sigma">Status</Typography></Th>
              <Th><Typography variant="sigma">Size</Typography></Th>
              <Th><Typography variant="sigma">Actions</Typography></Th>
            </Tr>
          </Thead>
          <Tbody>{paged.map(renderRow)}</Tbody>
        </Table>
        {renderPagination()}
      </>
    );
  };

  return (
    <Box>
      <Box paddingBottom={4}>
        <SectionHeading
          icon={<Archive width="1.5rem" height="1.5rem" />}
          title="Recent Backups"
          subtitle={subtitle}
          actions={refreshButton}
        />
      </Box>
      {renderBody()}
    </Box>
  );
};

export default BackupTable;
