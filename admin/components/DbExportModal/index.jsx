import React, { useState } from "react";

import { useNotification } from "@strapi/strapi/admin";
import { Modal, Flex, Button } from "@strapi/design-system";
import { Download } from "@strapi/icons";

import { createBackup } from "../../utils/api";
import { readServerError } from "../../utils/format";
import { BACKUP_FORMATS } from "../../constants/export";

import PreviewPane from "./PreviewPane";
import OptionsForm from "./OptionsForm";

const DbExportModal = ({ onClose, onStartJob }) => {
  const { toggleNotification } = useNotification();
  const [selected, setSelected] = useState(BACKUP_FORMATS[0]);
  const [encryptionKey, setKey] = useState("");
  const [exclude, setExclude] = useState("");
  const [working, setWorking] = useState(false);

  const onRun = async (fmt) => {
    if (fmt.requiresKey && !encryptionKey.trim()) {
      toggleNotification({
        type: "warning",
        message: "Encryption key is required for encrypted formats.",
      });
      return;
    }
    setSelected(fmt);
    setWorking(true);
    try {
      const { jobId } = await createBackup({
        encrypt: fmt.encrypt,
        compress: fmt.compress,
        key: fmt.requiresKey ? encryptionKey : undefined,
        exclude: exclude.trim() || undefined,
      });
      onStartJob?.(jobId);
    } catch (e) {
      toggleNotification({ type: "danger", message: readServerError(e) });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal.Root open onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <Modal.Content style={{ maxWidth: "960px" }}>
        <Modal.Header>
          <Modal.Title>Export database</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex gap={6} alignItems="stretch" wrap="wrap">
            <PreviewPane working={working} selected={selected} />
            <OptionsForm
              selected={selected}
              setSelected={setSelected}
              encryptionKey={encryptionKey}
              setKey={setKey}
              exclude={exclude}
              setExclude={setExclude}
              working={working}
            />
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary" onClick={onClose}>Close</Button>
          </Modal.Close>
          <Button
            startIcon={<Download />}
            onClick={() => onRun(selected)}
            loading={working}
            disabled={working}
          >
            Run `strapi export` ({selected.label})
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
};

export default DbExportModal;
