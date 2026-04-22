import React from "react";

import { Flex, Field, SingleSelect, SingleSelectOption } from "@strapi/design-system";

import ColumnPicker from "../../ColumnPicker.jsx";

const ExportSidebar = ({ format, setFormat, columns, selectedColumns, setSelectedColumns }) => (
  <Flex direction="column" gap={3} alignItems="stretch">
    <Field.Root name="format">
      <Field.Label>Export format</Field.Label>
      <SingleSelect value={format} onChange={setFormat}>
        <SingleSelectOption value="xlsx">XLSX</SingleSelectOption>
        <SingleSelectOption value="csv">CSV</SingleSelectOption>
        <SingleSelectOption value="json">JSON</SingleSelectOption>
      </SingleSelect>
    </Field.Root>
    <ColumnPicker
      columns={columns}
      selected={selectedColumns}
      setSelected={setSelectedColumns}
    />
  </Flex>
);

export default ExportSidebar;
