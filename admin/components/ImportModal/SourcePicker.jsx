import React, { useState } from "react";

import {
  Tabs, Box, Flex, Button, Typography, Field, Textarea,
} from "@strapi/design-system";
import { File } from "@strapi/icons";

const FileDropzone = ({ fileName, onFile }) => {
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Box
      background={dragOver ? "primary100" : "neutral100"}
      hasRadius
      padding={6}
      borderStyle="dashed"
      borderWidth="2px"
      borderColor={dragOver ? "primary500" : "neutral300"}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Flex direction="column" alignItems="center" gap={3}>
        <File width="2rem" height="2rem" />
        <Typography>
          {fileName ? `Selected: ${fileName}` : "Drop a CSV / JSON / XLSX / SQL (or .gz) file here"}
        </Typography>
        <label>
          <input
            type="file"
            accept=".csv,.json,.xlsx,.sql,.gz"
            onChange={(e) => onFile(e.target.files?.[0])}
            style={{ display: "none" }}
          />
          <Button tag="span" variant="tertiary">Browse file</Button>
        </label>
      </Flex>
    </Box>
  );
};

const SourcePicker = ({ fileName, onFile, pasted, setPasted }) => (
  <Box paddingTop={5}>
    <Tabs.Root defaultValue="upload" variant="simple">
      <Tabs.List aria-label="Import source">
        <Tabs.Trigger value="upload">
          <Typography fontWeight="bold">Upload file</Typography>
        </Tabs.Trigger>
        <Tabs.Trigger value="paste">
          <Typography fontWeight="bold">Paste text</Typography>
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="upload">
        <Box paddingTop={3}>
          <FileDropzone fileName={fileName} onFile={onFile} />
        </Box>
      </Tabs.Content>

      <Tabs.Content value="paste">
        <Box paddingTop={3}>
          <Field.Root>
            <Field.Label>Paste raw content</Field.Label>
            <Textarea
              placeholder="Paste CSV / JSON here"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={10}
            />
            <Field.Hint>Useful for quick tests — pick the matching Format above.</Field.Hint>
          </Field.Root>
        </Box>
      </Tabs.Content>
    </Tabs.Root>
  </Box>
);

export default SourcePicker;
