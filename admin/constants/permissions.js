import pluginId from "../pluginId";

const uid = (suffix) => `plugin::${pluginId}.${suffix}`;

export const PERMISSIONS = {
  read: [{ action: uid("read"), subject: null }],
  create: [{ action: uid("create"), subject: null }],
  restore: [{ action: uid("restore"), subject: null }],
  delete: [{ action: uid("delete"), subject: null }],
  download: [{ action: uid("download"), subject: null }],
  settings: [{ action: uid("settings"), subject: null }],
  collectionExport: [{ action: uid("collection.export"), subject: null }],
  collectionImport: [{ action: uid("collection.import"), subject: null }],
};
