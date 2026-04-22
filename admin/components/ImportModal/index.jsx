import React, { useMemo, useState } from "react";

import { useNotification } from "@strapi/strapi/admin";
import {
  Modal, Flex, Box, Button, Loader, Alert,
} from "@strapi/design-system";

import { importData } from "../../utils/api";
import { readFileAsText, readFileAsBase64, getFormatFromFilename } from "../../utils/readFile";

import FieldsGrid from "./FieldsGrid";
import SourcePicker from "./SourcePicker";
import ResultView from "./ResultView";

const readFileContent = async (file, detected) => {
  const isBinary = detected?.format === "xlsx" || detected?.gzipped;
  if (isBinary) return { base64: await readFileAsBase64(file) };
  return { text: await readFileAsText(file) };
};

const buildPayload = ({
  uid, format, fileContent, pasted, idField, existingAction, defaultStatus,
}) => {
  const body = { uid, format, idField, existingAction, defaultStatus };
  if (fileContent?.base64) body.fileContent = fileContent.base64;
  else if (fileContent?.text) body.fileContent = fileContent.text;
  else body.fileContent = pasted;
  return body;
};

const ImportModal = ({ uid, onClose }) => {
  const { toggleNotification } = useNotification();

  const [format, setFormat] = useState("csv");
  const [fileContent, setFileContent] = useState(null);
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [idField, setIdField] = useState("documentId");
  const [existingAction, setExistingAction] = useState("update");
  const [defaultStatus, setDefaultStatus] = useState("draft");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const canSubmit = useMemo(
    () => Boolean(fileContent || pasted.trim()),
    [fileContent, pasted]
  );

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    const detected = getFormatFromFilename(file.name);
    if (detected) setFormat(detected.format);
    setFileName(file.name);
    try {
      setFileContent(await readFileContent(file, detected));
    } catch (e) {
      setError(e.message || "Could not read file");
    }
  };

  const onSubmit = async () => {
    try {
      setBusy(true);
      setError(null);
      const payload = buildPayload({
        uid, format, fileContent, pasted, idField, existingAction, defaultStatus,
      });
      const res = await importData(payload);
      setResult(res);
      toggleNotification({
        type: res.failed === 0 ? "success" : "warning",
        message: `Import finished: ${res.created} created, ${res.updated} updated, ${res.failed} failed`,
      });
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message || "Import failed");
      toggleNotification({ type: "danger", message: e.message || "Import failed" });
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setFileContent(null);
    setFileName("");
    setPasted("");
  };

  return (
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content style={{ maxWidth: "920px" }}>
        <Modal.Header>
          <Modal.Title>Import into {uid}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Box paddingBottom={3}>
              <Alert variant="danger" closeLabel="Close" onClose={() => setError(null)}>{error}</Alert>
            </Box>
          )}

          {!result && (
            <>
              <FieldsGrid
                format={format}
                setFormat={setFormat}
                idField={idField}
                setIdField={setIdField}
                existingAction={existingAction}
                setExistingAction={setExistingAction}
                defaultStatus={defaultStatus}
                setDefaultStatus={setDefaultStatus}
              />
              <SourcePicker
                fileName={fileName}
                onFile={handleFile}
                pasted={pasted}
                setPasted={setPasted}
              />
            </>
          )}

          {busy && (
            <Flex justifyContent="center" padding={6}>
              <Loader>Importing...</Loader>
            </Flex>
          )}

          {result && !busy && <ResultView result={result} />}
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">{result ? "Close" : "Cancel"}</Button>
          </Modal.Close>
          {!result && (
            <Button onClick={onSubmit} loading={busy} disabled={!canSubmit || busy}>Import</Button>
          )}
          {result && (
            <Button variant="secondary" onClick={resetForm}>Import another file</Button>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default ImportModal;
