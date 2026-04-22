import React from "react";

import {
  Field, Grid, SingleSelect, SingleSelectOption,
} from "@strapi/design-system";

import { ID_FIELDS, EXISTING_ACTIONS } from "../../constants/import";

const FORMAT_OPTIONS = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "xlsx", label: "XLSX" },
  { value: "sql", label: "SQL (INSERTs)" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

const GridField = ({ name, label, hint, value, onChange, options }) => (
  <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
    <Field.Root name={name}>
      <Field.Label>{label}</Field.Label>
      <SingleSelect value={value} onChange={onChange}>
        {options.map((o) => (
          <SingleSelectOption key={o.value} value={o.value}>{o.label}</SingleSelectOption>
        ))}
      </SingleSelect>
      <Field.Hint>{hint}</Field.Hint>
    </Field.Root>
  </Grid.Item>
);

const FieldsGrid = ({
  format, setFormat, idField, setIdField,
  existingAction, setExistingAction, defaultStatus, setDefaultStatus,
}) => (
  <Grid.Root gap={4}>
    <GridField
      name="format"
      label="Format"
      hint={<>Gzipped <code>.gz</code> files are auto-detected.</>}
      value={format}
      onChange={setFormat}
      options={FORMAT_OPTIONS}
    />
    <GridField
      name="idField"
      label="ID field"
      hint="Column used to match existing entries."
      value={idField}
      onChange={setIdField}
      options={ID_FIELDS}
    />
    <GridField
      name="existingAction"
      label="When row matches"
      hint="Behaviour when the ID field already exists in the DB."
      value={existingAction}
      onChange={setExistingAction}
      options={EXISTING_ACTIONS}
    />
    <GridField
      name="defaultStatus"
      label={<>Default status (D&amp;P)</>}
      hint={<>For content-types with Draft &amp; Publish enabled.</>}
      value={defaultStatus}
      onChange={setDefaultStatus}
      options={STATUS_OPTIONS}
    />
  </Grid.Root>
);

export default FieldsGrid;
