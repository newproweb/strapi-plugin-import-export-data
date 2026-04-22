import pluginId from "./pluginId";
import { PluginIcon } from "./components/PluginIcon.jsx";
import ListViewActions from "./components/ListViewActions.jsx";
import { PERMISSIONS } from "./constants/permissions";

export default {
  register(app) {

    app.createSettingSection(
      {
        id: pluginId,
        intlLabel: {
          id: `${pluginId}.plugin.name`,
          defaultMessage: "Database Backup & Restore",
        },
      },
      [
        {
          intlLabel: {
            id: "settings.import-export-data",
            defaultMessage: "Import Export Data",
          },
          id: "settings",
          to: `/settings/import-export-data/`,
          icon: PluginIcon,
          Component: async () => {
            const mod = await import("./pages/HomePage.jsx");
            return mod.default;
          },
          permissions: PERMISSIONS.read,
        },
      ]
    );
    // app.addMenuLink({
    //   to: `/plugins/${pluginId}`,
    //   icon: PluginIcon,
    //   intlLabel: {
    //     id: `${pluginId}.plugin.name`,
    //     defaultMessage: "Import Export Data",
    //   },
    //   position: 2,
    //   Component: async () => {
    //     const mod = await import("./pages/HomePage.jsx");
    //     return { default: mod.default };
    //   },
    // });
  },

  bootstrap(app) {
    const contentManager = app.getPlugin("content-manager");
    if (!contentManager?.injectComponent) return;
    contentManager.injectComponent("listView", "actions", {
      name: `${pluginId}-list-view-actions`,
      Component: ListViewActions,
    });
  },
};
