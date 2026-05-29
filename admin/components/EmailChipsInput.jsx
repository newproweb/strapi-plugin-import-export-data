import React, { useState } from "react";

import { Flex, Field, TextInput, Typography } from "@strapi/design-system";

import HintTooltip from "./HintTooltip";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CHIP_STYLE = { background: "#4945ff", borderRadius: 4, padding: "2px 4px 2px 8px" };
const CLOSE_STYLE = { cursor: "pointer", color: "#ffffff", fontWeight: 700, padding: "0 4px", lineHeight: 1 };

/**
 * Free-form multi-email input: typed addresses become removable chips on Enter
 * or comma. `value` is an array of emails; `onChange` receives the new array.
 */
const EmailChipsInput = ({ label, hint, value, onChange }) => {
  const emails = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const commitDraft = () => {
    const parts = draft.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    const next = emails.slice();
    let invalid = "";
    for (const part of parts) {
      if (!EMAIL_RE.test(part)) { invalid = part; continue; }
      if (!next.includes(part)) next.push(part);
    }
    setError(invalid ? `"${invalid}" is not a valid email address` : "");
    setDraft(invalid);
    if (next.length !== emails.length) onChange(next);
  };

  const removeEmail = (email) => {
    setError("");
    onChange(emails.filter((e) => e !== email));
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  return (
    <Field.Root>
      {label && (
        <Field.Label
          marginBottom={2}
          action={hint ? <HintTooltip label={hint} ariaLabel={`${label} help`} /> : undefined}
        >
          {label}
        </Field.Label>
      )}
      {emails.length > 0 && (
        <Flex gap={1} wrap="wrap" marginBottom={2}>
          {emails.map((email) => (
            <Flex key={email} alignItems="center" style={CHIP_STYLE}>
              <Typography variant="pi" style={{ color: "#ffffff" }}>{email}</Typography>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${email}`}
                onClick={() => removeEmail(email)}
                style={CLOSE_STYLE}
              >
                ×
              </span>
            </Flex>
          ))}
        </Flex>
      )}
      <TextInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
        placeholder="type an email and press Enter"
      />
      {error && <Typography variant="pi" textColor="danger600" marginTop={1}>{error}</Typography>}
    </Field.Root>
  );
};

export default EmailChipsInput;
