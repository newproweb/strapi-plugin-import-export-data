import React, { useEffect, useState } from "react";

import { useNotification } from "@strapi/strapi/admin";
import { Modal, Button, Box, Alert } from "@strapi/design-system";

import { exportData, fetchContentType, fetchLocales } from "../../../utils/api";
import { downloadBlob } from "../../../utils/download";
import OptionsForm from "./OptionsForm";

const readUrlFilters = (enabled) => {
  if (!enabled) return {};
  const params = new URLSearchParams(window.location.search);
  const out = {};
  const filters = params.get("filters");
  const sort = params.get("sort");
  if (filters) out.filters = filters;
  if (sort) out.sort = sort;
  return out;
};

const useCollectionMeta = (uid, setError) => {
  const [collection, setCollection] = useState(null);
  const [locales, setLocales] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meta, list] = await Promise.all([fetchContentType(uid), fetchLocales()]);
        if (cancelled) return;
        setCollection(meta);
        setLocales(list);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load");
      }
    })();
    return () => { cancelled = true; };
  }, [uid, setError]);

  return { collection, locales };
};

const SimpleExportModal = ({ uid, onClose }) => {
  const { toggleNotification } = useNotification();

  const [format, setFormat] = useState("json");
  const [gzip, setGzip] = useState(false);
  const [deepness, setDeepness] = useState(2);
  const [relationsAsId, setRelationsAsId] = useState(true);
  const [applyFilters, setApplyFilters] = useState(false);
  const [status, setStatus] = useState("published");
  const [locale, setLocale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const { collection, locales } = useCollectionMeta(uid, setError);

  const onSubmit = async () => {
    try {
      setBusy(true);
      setError(null);
      const { blob, filename } = await exportData({
        uid,
        format,
        gzip,
        deepness,
        relationsAsId,
        status: collection?.draftAndPublish ? status : undefined,
        locale: collection?.hasI18n && locale ? locale : undefined,
        ...readUrlFilters(applyFilters),
      });
      const ext = gzip ? `${format}.gz` : format;
      downloadBlob(blob, filename || `export.${ext}`);
      toggleNotification({ type: "success", message: "Export downloaded" });
      onClose();
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message || "Export failed";
      setError(msg);
      toggleNotification({ type: "danger", message: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Quick export — {collection?.displayName || uid}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Box paddingBottom={3}>
              <Alert variant="danger" closeLabel="Close" onClose={() => setError(null)}>{error}</Alert>
            </Box>
          )}
          <OptionsForm
            format={format} setFormat={setFormat}
            gzip={gzip} setGzip={setGzip}
            deepness={deepness} setDeepness={setDeepness}
            relationsAsId={relationsAsId} setRelationsAsId={setRelationsAsId}
            applyFilters={applyFilters} setApplyFilters={setApplyFilters}
            status={status} setStatus={setStatus}
            locale={locale} setLocale={setLocale} locales={locales}
            collection={collection}
          />
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancel</Button>
          </Modal.Close>
          <Button onClick={onSubmit} loading={busy} disabled={busy}>Download</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default SimpleExportModal;
