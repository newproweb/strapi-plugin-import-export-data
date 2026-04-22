import React from "react";

import { Page, Layouts, useRBAC } from "@strapi/strapi/admin";
import { Box, Tabs, Typography, Loader, Flex } from "@strapi/design-system";

import ImportExportPanel from "../components/ImportExportPanel";
import SettingsPanel from "../components/SettingsPanel";
import { PERMISSIONS } from "../constants/permissions";

const BASE_TAB = { id: "import-export", label: "Import / Export", Component: ImportExportPanel };
const SETTINGS_TAB = { id: "settings", label: "Settings", Component: SettingsPanel };

const HomePage = () => {
  const { isLoading, allowedActions } = useRBAC({
    canRead: PERMISSIONS.read,
    canSettings: PERMISSIONS.settings,
  });

  if (isLoading) {
    return (
      <Page.Main>
        <Flex justifyContent="center" padding={6}>
          <Loader>Checking permissions…</Loader>
        </Flex>
      </Page.Main>
    );
  }

  if (!allowedActions?.canRead) {
    return (
      <Page.Main>
        <Page.NoPermissions />
      </Page.Main>
    );
  }

  const tabs = [BASE_TAB];
  if (allowedActions?.canSettings) tabs.push(SETTINGS_TAB);

  return (
    <Page.Main>
      <Layouts.Root>
        <Layouts.Header
          id="title"
          title="Import Export Data"
          subtitle="Create, restore and schedule Strapi data transfers via the official `strapi export` / `strapi import` CLI."
        />
        <Layouts.Content>
          <Tabs.Root defaultValue={tabs[0].id} variant="simple">
            <Tabs.List aria-label="Backup tabs">
              {tabs.map((t) => (
                <Tabs.Trigger key={t.id} value={t.id}>
                  <Typography fontWeight="bold">{t.label}</Typography>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {tabs.map(({ id, Component }) => (
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
};

export default HomePage;
