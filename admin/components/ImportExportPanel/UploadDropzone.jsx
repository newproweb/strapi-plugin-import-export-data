import React from "react";

import { Box, Flex, Button, Typography, Field, TextInput } from "@strapi/design-system";
import { Upload } from "@strapi/icons";

import { formatBytes } from "../../utils/format";

const STAGE_LABEL = {
  uploading: (pct) => `Uploading… ${pct}%`,
  finalizing: () => "Saving file…",
  starting: () => "Starting import…",
};

const STRIPE_KEYFRAMES = `
  @keyframes iedp-stripe {
    from { background-position: 200% 0; }
    to   { background-position: -200% 0; }
  }
`;

const computePercent = (progress) => {
  if (!progress || !progress.total) return 0;
  return Math.round((progress.loaded / progress.total) * 100);
};

const resolveStage = (progress) => {
  if (!progress) return null;
  if (progress.stage && progress.stage !== "uploading") return progress.stage;
  return "uploading";
};

export const UploadDropzone = ({
  file,
  encryptionKey,
  dragOver,
  working,
  limits,
  uploadProgress,
  onFile,
  onKey,
  onDragOver,
  onDragLeave,
  onDrop,
  onStage,
  onImport,
}) => {
  const isEncrypted = file?.name?.endsWith(".enc");
  const maxBytes = Number(limits?.maxFileSize) || 0;
  const maxLabel = limits?.maxFileSizeLabel || (maxBytes ? formatBytes(maxBytes) : "");
  const tooBig = Boolean(maxBytes && file && file.size > maxBytes);
  const busy = Boolean(limits?.busy);

  const percent = computePercent(uploadProgress);
  const stage = resolveStage(uploadProgress);
  const indeterminate = stage === "finalizing" || stage === "starting";
  const stageLabel = stage === "uploading" ? STAGE_LABEL.uploading(percent) : stage && STAGE_LABEL[stage]?.();

  const handleFileChange = (e) => onFile(e.target.files?.[0] || null);

  const renderProgress = () => {
    if (!uploadProgress) return null;
    return (
      <Box width="100%" paddingTop={3} paddingBottom={3}>
        <Box
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate ? undefined : percent}
          aria-label={stageLabel}
          style={{
            height: 4,
            background: "var(--strapi-colors-neutral200, #e0e0e0)",
            borderRadius: 2,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {indeterminate ? (
            <Box
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(90deg, var(--strapi-colors-primary500, #4945ff) 30%, transparent 30%, transparent 70%, var(--strapi-colors-primary500, #4945ff) 70%)",
                backgroundSize: "200% 100%",
                animation: "iedp-stripe 1.2s linear infinite",
              }}
            />
          ) : (
            <Box
              style={{
                height: "100%",
                width: `${percent}%`,
                background: "var(--strapi-colors-primary500, #4945ff)",
                transition: "width 0.3s ease-out",
              }}
            />
          )}
        </Box>
        <Typography variant="pi" textColor="neutral500" textAlign="center">
          {stageLabel}
        </Typography>
        <style>{STRIPE_KEYFRAMES}</style>
      </Box>
    );
  };

  const renderEncryptionField = () => {
    if (!file || !isEncrypted) return null;
    return (
      <Field.Root style={{ minWidth: 240 }}>
        <Field.Label>Encryption key</Field.Label>
        <TextInput
          type="password"
          value={encryptionKey}
          onChange={(e) => onKey(e.target.value)}
        />
      </Field.Root>
    );
  };

  const renderActions = () => {
    if (!file) return null;
    const disabled = working || tooBig || busy;
    return (
      <Flex gap={2} wrap="wrap" justifyContent="center">
        <Button variant="tertiary" onClick={onStage} disabled={disabled}>Save only</Button>
        <Button
          variant="default"
          startIcon={<Upload />}
          onClick={onImport}
          loading={working}
          disabled={disabled}
        >
          Import &amp; seed
        </Button>
      </Flex>
    );
  };

  const renderHints = () => (
    <>
      {file && tooBig && (
        <Typography variant="pi" textColor="danger600" textAlign="center">
          Archive is {formatBytes(file.size)} — exceeds Strapi body limit of {maxLabel}.
          Raise <code>strapi::body</code> formidable.maxFileSize and the reverse-proxy
          <code>client_max_body_size</code>, then restart Strapi.
        </Typography>
      )}
      {busy && (
        <Typography variant="pi" textColor="warning600" textAlign="center">
          A {limits?.busyLabel || "backup"} job is currently running — wait for it to finish.
        </Typography>
      )}
      {maxLabel && !tooBig && (
        <Typography variant="pi" textColor="neutral500" textAlign="center">
          Max archive size: {maxLabel}
        </Typography>
      )}
      {file && !tooBig && (
        <Typography variant="pi" textColor="warning600" textAlign="center">
          "Import &amp; seed" wipes current DB and uploads, then replays
          {" "}<code>strapi import --file … --force</code>.
        </Typography>
      )}
    </>
  );

  return (
    <Box
      flex="1"
      minWidth="280px"
      background={dragOver ? "primary100" : "neutral0"}
      borderStyle="dashed"
      borderWidth="2px"
      borderColor={dragOver ? "primary500" : "neutral300"}
      padding={5}
      hasRadius
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ transition: "background-color 0.2s ease, border-color 0.2s ease" }}
    >
      <Flex direction="column" gap={2} alignItems="center">
        <Flex background="primary100" textColor="primary600" hasRadius padding={3} aria-hidden="true">
          <Upload width="1.75rem" height="1.75rem" />
        </Flex>
        <Typography variant="delta">Import database</Typography>
        <Typography textAlign="center" textColor="neutral600">
          {file
            ? `Selected: ${file.name}`
            : "Drop a .tar / .tar.gz / .tar.enc / .tar.gz.enc archive from another Strapi project and it will be seeded via strapi import."}
        </Typography>
        <label>
          <input
            type="file"
            accept=".tar,.gz,.enc"
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-label="Choose archive file"
          />
          <Button tag="span" variant="tertiary">Browse file</Button>
        </label>

        {renderEncryptionField()}
        {renderActions()}
        {renderProgress()}
        {renderHints()}
      </Flex>
    </Box>
  );
};

export default UploadDropzone;
