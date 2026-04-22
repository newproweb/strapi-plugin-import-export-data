import React from "react";

import { Box, Flex, Checkbox, Typography, IconButton } from "@strapi/design-system";
import { ArrowUp, ArrowDown } from "@strapi/icons";

const ActiveRow = ({ item, onToggle, onMove }) => (
  <Flex alignItems="center" gap={2}>
    <Checkbox checked onCheckedChange={onToggle} />
    <Typography flex="1">{item}</Typography>
    <IconButton label="Move up" onClick={() => onMove(-1)}><ArrowUp /></IconButton>
    <IconButton label="Move down" onClick={() => onMove(1)}><ArrowDown /></IconButton>
  </Flex>
);

const InactiveRow = ({ item, onToggle }) => (
  <Flex alignItems="center" gap={2}>
    <Checkbox checked={false} onCheckedChange={onToggle} />
    <Typography flex="1">{item}</Typography>
  </Flex>
);

const ColumnPicker = ({ columns, selected, setSelected }) => {
  const toggle = (key) => {
    if (selected.includes(key)) return setSelected(selected.filter((k) => k !== key));
    setSelected([...selected, key]);
  };

  const move = (key, dir) => {
    const index = selected.indexOf(key);
    if (index < 0) return;
    const target = index + dir;
    if (target < 0 || target >= selected.length) return;
    const next = selected.slice();
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    setSelected(next);
  };

  const unselected = columns.filter((c) => !selected.includes(c));

  return (
    <Box>
      <Typography variant="sigma" textColor="neutral500">Active columns (drag order)</Typography>
      <Flex direction="column" alignItems="stretch" gap={1} paddingTop={2} paddingBottom={3}>
        {selected.map((key) => (
          <ActiveRow
            key={key}
            item={key}
            onToggle={() => toggle(key)}
            onMove={(dir) => move(key, dir)}
          />
        ))}
      </Flex>

      {unselected.length > 0 && (
        <>
          <Typography variant="sigma" textColor="neutral500">Available columns</Typography>
          <Flex direction="column" alignItems="stretch" gap={1} paddingTop={2}>
            {unselected.map((key) => (
              <InactiveRow key={key} item={key} onToggle={() => toggle(key)} />
            ))}
          </Flex>
        </>
      )}
    </Box>
  );
};

export default ColumnPicker;
