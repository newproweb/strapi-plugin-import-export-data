import React, { useEffect, useMemo, useState } from "react";

import { useNotification } from "@strapi/strapi/admin";
import {
  Modal, Button, Flex, Typography, Box, Loader, Alert, Grid,
} from "@strapi/design-system";

import { previewData, exportData } from "../../../utils/api";
import { downloadBlob } from "../../../utils/download";

import FilterBar from "./FilterBar";
import PreviewTable from "./PreviewTable";
import ExportSidebar from "./ExportSidebar";
import { useCollectionSchema } from "./useCollectionSchema";
import { buildFilters, buildSort } from "./filters";

const DATE_TYPES = ["datetime", "date"];
const AUDIT_DATES = ["createdAt", "updatedAt", "publishedAt"];
const uniq = (arr) => arr.filter((v, i, a) => a.indexOf(v) === i);

const DataExplorerModal = ({ uid, onClose }) => {
  const { toggleNotification } = useNotification();
  const [error, setError] = useState(null);

  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const setDefaultSort = (field) => setSortField((s) => s || field);

  const {
    collection, locales, columns, selectedColumns, setSelectedColumns, loading,
  } = useCollectionSchema(uid, setError, setDefaultSort);

  const [locale, setLocale] = useState("");
  const [format, setFormat] = useState("xlsx");
  const [status, setStatus] = useState("published");

  const [search, setSearch] = useState("");
  const [dateField, setDateField] = useState("createdAt");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [preview, setPreview] = useState({ rows: [], total: 0, page: 1, pageSize: 25, pageCount: 1 });

  const [busy, setBusy] = useState(false);

  const filterArgs = () => buildFilters({ collection, search, dateField, dateFrom, dateTo });
  const sortArg = () => buildSort(sortField, sortOrder);

  const refreshPreview = async () => {
    try {
      setBusy(true);
      const data = await previewData({
        uid,
        page,
        pageSize,
        filters: filterArgs(),
        sort: sortArg(),
        locale: collection?.hasI18n && locale ? locale : undefined,
        status: collection?.draftAndPublish ? status : undefined,
      });
      setPreview(data);
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message || "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading || !collection) return;
    refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, pageSize, sortField, sortOrder, status, locale]);

  const onSearchSubmit = () => {
    setPage(1);
    refreshPreview();
  };

  const onDownload = async () => {
    try {
      setBusy(true);
      const { blob, filename } = await exportData({
        uid,
        format,
        filters: filterArgs(),
        sort: sortArg(),
        locale: collection?.hasI18n && locale ? locale : undefined,
        status: collection?.draftAndPublish ? status : undefined,
        columns: selectedColumns,
        relationsAsId: true,
        deepness: 1,
      });
      downloadBlob(blob, filename || `export.${format}`);
      toggleNotification({ type: "success", message: "Export downloaded" });
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message || "Export failed";
      setError(msg);
      toggleNotification({ type: "danger", message: msg });
    } finally {
      setBusy(false);
    }
  };

  const dateFieldOptions = useMemo(() => {
    if (!collection) return [];
    const datelike = Object.entries(collection.attributes || {})
      .filter(([, a]) => DATE_TYPES.includes(a?.type))
      .map(([k]) => k);
    return uniq([...datelike, ...AUDIT_DATES]);
  }, [collection]);

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content style={{ maxWidth: "1100px" }}>
        <Modal.Header>
          <Modal.Title>Data explorer — {collection?.displayName || uid}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Box paddingBottom={3}>
              <Alert variant="danger" closeLabel="Close" onClose={() => setError(null)}>{error}</Alert>
            </Box>
          )}

          {loading && (
            <Flex justifyContent="center" padding={6}>
              <Loader>Loading schema...</Loader>
            </Flex>
          )}

          {!loading && (
            <Grid.Root gap={4}>
              <Grid.Item col={8} s={12} direction="column" alignItems="stretch">
                <FilterBar
                  search={search} setSearch={setSearch} onSearchSubmit={onSearchSubmit}
                  dateField={dateField} setDateField={setDateField} dateFieldOptions={dateFieldOptions}
                  dateFrom={dateFrom} setDateFrom={setDateFrom}
                  dateTo={dateTo} setDateTo={setDateTo}
                  sortField={sortField} setSortField={setSortField} columns={columns}
                  sortOrder={sortOrder} setSortOrder={setSortOrder}
                  collection={collection}
                  status={status} setStatus={setStatus}
                  locale={locale} setLocale={setLocale} locales={locales}
                />
                <PreviewTable
                  preview={preview}
                  busy={busy}
                  selectedColumns={selectedColumns}
                  page={page} setPage={setPage}
                  pageSize={pageSize} setPageSize={setPageSize}
                />
              </Grid.Item>
              <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
                <ExportSidebar
                  format={format} setFormat={setFormat}
                  columns={columns}
                  selectedColumns={selectedColumns}
                  setSelectedColumns={setSelectedColumns}
                />
              </Grid.Item>
            </Grid.Root>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Close</Button>
          </Modal.Close>
          <Button onClick={onDownload} loading={busy} disabled={busy || selectedColumns.length === 0}>
            Download export
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default DataExplorerModal;
