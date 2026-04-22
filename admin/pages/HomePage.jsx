import React from "react";

import { Page, Layouts } from "@strapi/strapi/admin";
import { Box, Tabs, Typography } from "@strapi/design-system";

import ImportExportPanel from "../components/ImportExportPanel";
import SettingsPanel from "../components/SettingsPanel";

const TAB_DEFS = [
  { id: "import-export", label: "Import / Export", Component: ImportExportPanel },
  { id: "settings", label: "Settings", Component: SettingsPanel },
];

const HomePage = () => (
  <Page.Main>
    <Layouts.Root>
      <Layouts.Header
        id="title"
        title="Import Export Data"
        subtitle="Create, restore and schedule Strapi data transfers via the official `strapi export` / `strapi import` CLI."
      />
      <Layouts.Content>
        <Tabs.Root defaultValue={TAB_DEFS[0].id} variant="simple">
          <Tabs.List aria-label="Backup tabs">
            {TAB_DEFS.map((t) => (
              <Tabs.Trigger key={t.id} value={t.id}>
                <Typography fontWeight="bold">{t.label}</Typography>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {TAB_DEFS.map(({ id, Component }) => (
            <Tabs.Content key={id} value={id}>
              <Box paddingTop={4}>
                <Component />
              </Box>
            </Tabs.Content>
          ))}
        </Tabs.Root>
      </Layouts.Content>
    </Layouts.Root>
  </Page.Main>
);

export default HomePage;
