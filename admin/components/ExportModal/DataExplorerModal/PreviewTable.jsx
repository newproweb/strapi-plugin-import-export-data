import React from "react";

import {
  Box, Flex, Badge, Button, Loader, Typography,
  Table, Thead, Tbody, Tr, Th, Td,
  SingleSelect, SingleSelectOption,
} from "@strapi/design-system";

import { cellToString } from "../../../utils/format";
import { PAGE_SIZE_OPTIONS } from "../../../constants/export";

const PaginationBar = ({ page, pageCount, pageSize, setPage, setPageSize }) => (
  <Box paddingTop={3}>
    <Flex justifyContent="space-between" alignItems="center" gap={4}>
      <Flex gap={2} alignItems="center">
        <Typography variant="pi" textColor="neutral600">Page size</Typography>
        <Box style={{ minWidth: 90 }}>
          <SingleSelect
            size="S"
            value={String(pageSize)}
            onChange={(v) => { setPageSize(Number(v) || 25); setPage(1); }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SingleSelectOption key={n} value={n}>{n}</SingleSelectOption>
            ))}
          </SingleSelect>
        </Box>
      </Flex>
      <Flex gap={2} alignItems="center">
        <Button
          size="S"
          variant="tertiary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Prev
        </Button>
        <Typography variant="pi" textColor="neutral600">Page {page} / {pageCount}</Typography>
        <Button
          size="S"
          variant="tertiary"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          Next →
        </Button>
      </Flex>
    </Flex>
  </Box>
);

const PreviewTable = ({
  preview, busy, selectedColumns, page, setPage, pageSize, setPageSize,
}) => (
  <Box>
    <Flex alignItems="center" gap={3} marginBottom={2}>
      <Badge backgroundColor="neutral150" textColor="neutral700">{preview.total} rows</Badge>
      {busy && <Loader small>Loading…</Loader>}
    </Flex>

    <Box overflow="auto" maxHeight="320px">
      <Table colCount={selectedColumns.length} rowCount={preview.rows.length}>
        <Thead>
          <Tr>
            {selectedColumns.map((c) => (
              <Th key={c}><Typography variant="sigma">{c}</Typography></Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {preview.rows.map((row, i) => (
            <Tr key={row.id || row.documentId || i}>
              {selectedColumns.map((c) => (
                <Td key={c}><Typography variant="pi" ellipsis>{cellToString(row?.[c])}</Typography></Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>

    {preview.rows.length > 0 && (
      <PaginationBar
        page={page}
        pageCount={preview.pageCount}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
      />
    )}
  </Box>
);

export default PreviewTable;
