import React from "react";

import { Page, Layouts, useRBAC } from "@strapi/strapi/admin";
import { Box, Tabs, Typography, Loader, Flex, Divider } from "@strapi/design-system";
import { Database, Cog } from "@strapi/icons";

import ImportExportPanel from "../components/ImportExportPanel";
import SettingsPanel from "../components/SettingsPanel";
import { PERMISSIONS } from "../constants/permissions";
import pkg from "../../package.json";

const BASE_TAB = { id: "import-export", label: "Import / Export", Icon: Database, Component: ImportExportPanel };
const SETTINGS_TAB = { id: "settings", label: "Settings", Icon: Cog, Component: SettingsPanel };

const HomePage = () => {
  const { isLoading, allowedActions } = useRBAC({
    canRead: PERMISSIONS.read,
    canSettings: PERMISSIONS.settings,
  });

  if (isLoading || !allowedActions) {
    return ( 
      <Page.Main>
        <Flex justifyContent="center" padding={6}>
          <Loader>Checking permissions…</Loader>
        </Flex>
      </Page.Main>
    );
  }

  if (!allowedActions.canRead) {
    return (
      <Page.Main>
        <Page.NoPermissions />
      </Page.Main>
    );
  }

  const tabs = [BASE_TAB];
  if (allowedActions?.canSettings) tabs.push(SETTINGS_TAB);

  return (
    <Page.Main style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Layouts.Root>
        <Layouts.Header
          id="title"
          title="Import / Export Data"
          subtitle="Back up, restore and schedule your Strapi data."
        />
        <Layouts.Content>
          <Tabs.Root defaultValue={tabs[0].id} variant="simple">
            <Tabs.List aria-label="Import export data tabs">
              {tabs.map(({ id, label, Icon }) => (
                <Tabs.Trigger key={id} value={id}>
                  <Flex gap={2} alignItems="center">
                    <Icon />
                    <Typography fontWeight="bold">{label}</Typography>
                  </Flex>
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

      <Box style={{ marginTop: "auto" }} paddingTop={6} paddingBottom={4}>
        <Divider />
        <Flex justifyContent="center" paddingTop={3}>
          <Typography variant="pi" textColor="neutral500">
            Import / Export Data · v{pkg.version}
          </Typography>
        </Flex>
      </Box>
    </Page.Main>
  );
};

export default HomePage;
