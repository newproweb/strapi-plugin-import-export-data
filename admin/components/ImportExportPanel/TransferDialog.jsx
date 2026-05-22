import React, { useState } from "react";

import { Dialog, Flex, Button, Typography, Checkbox } from "@strapi/design-system";

import { transferBackup } from "../../utils/api";
import { readServerError } from "../../utils/format";
import EmailChipsInput from "../EmailChipsInput";

const TransferDialog = ({ file, onClose, notify }) => {
  const [emails, setEmails] = useState([]);
  const [useSettings, setUseSettings] = useState(true);
  const [sending, setSending] = useState(false);

  if (!file) return null;

  const onSend = async () => {
    setSending(true);
    try {
      const res = await transferBackup(file, { emails, useSettingsRecipients: useSettings });
      const results = (res && res.results) || [];
      const sent = results.filter((r) => r.sent).length;
      if (sent > 0 && sent === results.length) {
        notify({ type: "success", message: `Download link emailed to ${sent} recipient(s).` });
        onClose();
      } else {
        const firstError = (results.find((r) => !r.sent) || {}).error || "unknown error";
        notify({ type: "danger", message: `Emailed ${sent} of ${results.length}. Email failed: ${firstError}` });
      }
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Content>
        <Dialog.Header>Send backup</Dialog.Header>
        <Dialog.Body>
          <Flex direction="column" gap={3} alignItems="stretch">
            <Typography>
              A time-limited download link for <code>{file}</code> will be emailed.
              The archive itself is not attached — anyone with the link can download it.
            </Typography>
            <EmailChipsInput
              label="Recipient emails"
              hint="Optional when the settings recipients are used."
              value={emails}
              onChange={setEmails}
            />
            <Checkbox checked={useSettings} onCheckedChange={(v) => setUseSettings(Boolean(v))}>
              Also send to the recipients saved in Settings
            </Checkbox>
          </Flex>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Cancel</Button>
          </Dialog.Cancel>
          <Dialog.Action>
            <Button onClick={onSend} loading={sending}>Send link</Button>
          </Dialog.Action>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default TransferDialog;
