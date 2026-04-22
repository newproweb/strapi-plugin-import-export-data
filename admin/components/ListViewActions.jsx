import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useRBAC } from "@strapi/strapi/admin";
import { Button, Flex, Menu } from "@strapi/design-system";
import { Download, Upload } from "@strapi/icons";

import ImportModal from "./ImportModal";
import SimpleExportModal from "./ExportModal/SimpleExportModal";
import DataExplorerModal from "./ExportModal/DataExplorerModal";
import { PERMISSIONS } from "../constants/permissions";

const extractUid = (pathname) => {
  const match = /\/content-manager\/collection-types\/([^/?]+)/.exec(pathname || "");
  return match ? decodeURIComponent(match[1]) : null;
};

const ListViewActions = () => {
  const location = useLocation();
  const uid = useMemo(() => extractUid(location.pathname), [location.pathname]);

  const { allowedActions } = useRBAC({
    canExport: PERMISSIONS.collectionExport,
    canImport: PERMISSIONS.collectionImport,
  });

  const [importOpen, setImportOpen] = useState(false);
  const [simpleExportOpen, setSimpleExportOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);

  if (!uid) return null;
  if (!allowedActions?.canExport && !allowedActions?.canImport) return null;

  return (
    <>
      <Flex gap={2}>
        {allowedActions?.canImport && (
          <Button variant="secondary" startIcon={<Upload />} onClick={() => setImportOpen(true)}>
            Import
          </Button>
        )}
        {allowedActions?.canExport && (
          <Menu.Root>
            <Menu.Trigger variant="secondary" startIcon={<Download />}>
              Export
            </Menu.Trigger>
            <Menu.Content>
              <Menu.Item onSelect={() => setSimpleExportOpen(true)}>
                Quick export (CSV / JSON / XLSX)
              </Menu.Item>
              <Menu.Item onSelect={() => setExplorerOpen(true)}>
                Data explorer (preview &amp; pick columns)
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        )}
      </Flex>

      {importOpen && <ImportModal uid={uid} onClose={() => setImportOpen(false)} />}
      {simpleExportOpen && <SimpleExportModal uid={uid} onClose={() => setSimpleExportOpen(false)} />}
      {explorerOpen && <DataExplorerModal uid={uid} onClose={() => setExplorerOpen(false)} />}
    </>
  );
};

export default ListViewActions;
