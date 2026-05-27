import { deleteBackup, restoreBackup, downloadBackup, uploadBackup } from "../../utils/api";
import { downloadBlob } from "../../utils/download";
import { readServerError } from "../../utils/format";

export const deleteAction = async (file, { notify, reload }) => {
  await deleteBackup(file);
  notify({ type: "success", message: `Deleted ${file}` });
  await reload();
};

// Returns the raw restore response — either `{ jobId }` when the import
// started, or `{ needsSchemaConfirm, schemaDiff }` when the archive schema
// differs and the caller must confirm first.
export const restoreAction = (file, options = {}) => restoreBackup(file, options);

export const downloadAction = async (file, { notify, onProgress }) => {
  try {
    const { data } = await downloadBackup(file, onProgress);
    const blob = data instanceof Blob ? data : new Blob([data]);
    if (!blob.size) {
      // Belt-and-braces guard: if the response somehow arrives empty,
      // surface a clear error instead of silently saving a 0 KB archive.
      throw new Error(
        "Server returned an empty response — the download stream was truncated. "
        + "Check the Strapi logs for [import-export:backup.download] errors and retry.",
      );
    }
    downloadBlob(blob, file);
  } catch (e) {
    notify({ type: "danger", message: readServerError(e) });
  }
};

export const stageUpload = async (file, key, { notify, reload, reset }) => {
  const staged = await uploadBackup(file, { key: key || undefined });
  notify({
    type: "success",
    message: `Staged ${staged.file}. Use Restore from the list to apply it.`,
  });
  reset();
  await reload();
  return staged;
};

// Uploads the archive, then asks the server to restore it. `restoreOptions`
// carries the scope (exclude/only) chosen in the import dialog. Returns the
// restore response (`{ jobId }` or `{ needsSchemaConfirm, schemaDiff }`) plus
// the staged file name so the caller can re-restore it after a schema confirm
// without re-uploading.
export const importUpload = async (file, key, restoreOptions, { notify, reload, onUploadProgress }) => {
  const staged = await uploadBackup(file, { key: key || undefined, onProgress: onUploadProgress });
  await reload();
  notify({ type: "info", message: "File uploaded — checking schema…" });
  const response = await restoreBackup(staged.file, { key: key || undefined, ...restoreOptions });
  return { ...response, stagedFile: staged.file };
};
