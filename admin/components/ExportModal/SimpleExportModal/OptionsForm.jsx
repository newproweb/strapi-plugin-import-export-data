import React from "react";

import {
  Flex, Field, SingleSelect, SingleSelectOption, NumberInput, Toggle, Typography,
} from "@strapi/design-system";

const ToggleField = ({ label, checked, onChange, onLabel, offLabel, hint }) => (
  <Field.Root>
    <Field.Label>{label}</Field.Label>
    <Flex alignItems="center" gap={3}>
      <Toggle
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onLabel={onLabel}
        offLabel={offLabel}
      />
      <Typography variant="pi" textColor="neutral600">{hint}</Typography>
    </Flex>
  </Field.Root>
);

const OptionsForm = ({
  format, setFormat,
  gzip, setGzip,
  deepness, setDeepness,
  relationsAsId, setRelationsAsId,
  applyFilters, setApplyFilters,
  status, setStatus,
  locale, setLocale, locales,
  collection,
}) => (
  <Flex direction="column" gap={4} alignItems="stretch">
    <Field.Root name="format" required>
      <Field.Label>Format</Field.Label>
      <SingleSelect value={format} onChange={setFormat}>
        <SingleSelectOption value="json">JSON</SingleSelectOption>
        <SingleSelectOption value="csv">CSV</SingleSelectOption>
        <SingleSelectOption value="xlsx">XLSX</SingleSelectOption>
        <SingleSelectOption value="sql">SQL (INSERTs)</SingleSelectOption>
      </SingleSelect>
      <Field.Hint>CSV/XLSX flatten nested fields; JSON keeps structure.</Field.Hint>
    </Field.Root>

   

    <Field.Root name="deepness">
      <Field.Label>Deepness (relations levels)</Field.Label>
      <NumberInput
        value={deepness}
        onValueChange={(v) => setDeepness(Number(v) || 1)}
        minimum={1}
        maximum={20}
      />
      <Field.Hint>How many relation levels to include (1–20).</Field.Hint>
    </Field.Root>
    
    {collection?.draftAndPublish && (
      <Field.Root name="status">
        <Field.Label>Status</Field.Label>
        <SingleSelect value={status} onChange={setStatus}>
          <SingleSelectOption value="published">Published only</SingleSelectOption>
          <SingleSelectOption value="draft">Drafts only</SingleSelectOption>
        </SingleSelect>
      </Field.Root>
    )}


  {collection?.hasI18n && locales.length > 0 && (
      <Field.Root name="locale">
        <Field.Label>Locale</Field.Label>
        <SingleSelect value={locale} onChange={setLocale} placeholder="All locales">
          {locales.map((l) => (
            <SingleSelectOption key={l.code} value={l.code}>{l.name || l.code}</SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
    )}
    <ToggleField
      label="Compress with gzip (.gz)"
      checked={gzip}
      onChange={setGzip}
      onLabel="Yes"
      offLabel="No"
      hint={<>Smaller file, adds <code>.gz</code> suffix.</>}
    />
    <ToggleField
      label="Export relations as IDs only"
      checked={relationsAsId}
      onChange={setRelationsAsId}
      onLabel="ID"
      offLabel="Full"
      hint="ID = just the related row's id/documentId; Full = the entire nested object."
    />

    <ToggleField
      label={<>Apply current list-view filters &amp; sort</>}
      checked={applyFilters}
      onChange={setApplyFilters}
      onLabel="Yes"
      offLabel="No"
      hint="Export only rows visible in the list view right now."
    />

  </Flex>
);

export default OptionsForm;
