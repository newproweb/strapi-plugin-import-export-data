import React, { useEffect, useRef, useState } from "react";

import { Box, Flex, Button, Typography, Loader } from "@strapi/design-system";
import { Upload } from "@strapi/icons";

import {
  uploadBackup, fullSeedPlan, fullSeedSync, getFullSeedPending,
  clearFullSeedPending, restoreBackup,
} from "../../utils/api";
import { readServerError } from "../../utils/format";
import SectionHeading from "../SectionHeading";

const DESCRIPTION =
  "Seeds an archive into a project that does not yet have its content-types — writes the "
  + "missing schema into src/, restarts Strapi, then imports the data.";

const UidList = ({ label, uids, color }) => {
  if (!uids || uids.length === 0) return null;
  return (
    <Flex direction="column" gap={1} alignItems="stretch">
      <Typography variant="sigma" textColor={color}>{label} ({uids.length})</Typography>
      <Box padding={2} background="neutral100" hasRadius>
        <div style={{ maxHeight: "120px", overflowY: "auto" }}>
          {uids.map((uid) => <Typography key={uid} tag="div" variant="pi">{uid}</Typography>)}
        </div>
      </Box>
    </Flex>
  );
};

const FullSeedCard = ({ onStartJob, notify }) => {
  const [phase, setPhase] = useState("loading");
  const [staged, setStaged] = useState(null);
  const [plan, setPlan] = useState(null);
  const [pending, setPending] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    getFullSeedPending()
      .then((marker) => {
        if (marker && marker.archive) {
          setPending(marker);
          setPhase("pending");
        } else {
          setPhase("idle");
        }
      })
      .catch(() => setPhase("idle"));
  }, []);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhase("analyzing");
    try {
      const up = await uploadBackup(file);
      setStaged(up.file);
      setPlan(await fullSeedPlan(up.file));
      setPhase("plan");
    } catch (err) {
      notify({ type: "danger", message: readServerError(err) });
      setPhase("idle");
    }
  };

  const onSync = async () => {
    setPhase("syncing");
    try {
      await fullSeedSync(staged);
    } catch {
      // Writing src/ triggers a dev-server restart that can drop this very
      // response — a transport error here still means the files were written.
    }
    setPhase("restarting");
    notify({
      type: "info",
      message: "Schema files written. Strapi is restarting — reload this page in ~10s to import the data.",
    });
  };

  const onImport = async () => {
    setPhase("importing");
    try {
      const res = await restoreBackup(pending.archive, { confirmSchemaChange: true });
      await clearFullSeedPending().catch(() => {});
      setPending(null);
      setPhase("idle");
      if (res?.jobId) onStartJob(res.jobId);
    } catch (err) {
      notify({ type: "danger", message: readServerError(err) });
      setPhase("pending");
    }
  };

  const onDiscard = async () => {
    await clearFullSeedPending().catch(() => {});
    setPending(null);
    setPhase("idle");
  };

  const noWork = plan
    && plan.contentTypesToCreate.length === 0
    && plan.componentsToCreate.length === 0;

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".tar,.gz"
      style={{ display: "none" }}
      onChange={onPick}
    />
  );

  const renderIdle = () => (
    <>
      {fileInput}
      <SectionHeading
        icon={<Upload width="1.5rem" height="1.5rem" />}
        title="Import & Create"
        subtitle={DESCRIPTION}
        actions={(
          <Button variant="secondary" startIcon={<Upload />} onClick={() => fileRef.current?.click()}>
            Choose archive
          </Button>
        )}
      />
    </>
  );

  const renderHeader = () => (
    <SectionHeading
      icon={<Upload width="1.5rem" height="1.5rem" />}
      title="Import & Create"
      subtitle={DESCRIPTION}
    />
  );

  const renderPlan = () => (
    <Flex direction="column" gap={3} alignItems="stretch">
      <UidList label="Content-types to create" uids={plan.contentTypesToCreate} color="primary600" />
      <UidList label="Components to create" uids={plan.componentsToCreate} color="primary600" />
      {plan.missingPlugins?.length > 0 && (
        <Flex direction="column" gap={1} alignItems="stretch">
          <Typography variant="sigma" textColor="warning600">
            Needs these plugins installed — their data will be skipped ({plan.missingPlugins.length})
          </Typography>
          <Box padding={2} background="warning100" hasRadius>
            <Typography variant="pi">{plan.missingPlugins.join(", ")}</Typography>
          </Box>
        </Flex>
      )}
      {noWork && (
        <Typography variant="pi" textColor="success600">
          Schema already matches this project — nothing to create. Use the normal Import zone instead.
        </Typography>
      )}
      <Flex gap={2} justifyContent="flex-end">
        <Button variant="tertiary" onClick={() => setPhase("idle")}>Cancel</Button>
        <Button variant="default" onClick={onSync} disabled={noWork}>
          Create schema &amp; restart
        </Button>
      </Flex>
    </Flex>
  );

  const renderPending = () => (
    <Flex direction="column" gap={3} alignItems="stretch">
      <Typography variant="pi" textColor="success600" textAlign="center">
        Schema synced — {pending.created?.contentTypes?.length || 0} content-type(s) and{" "}
        {pending.created?.components?.length || 0} component(s) created.
      </Typography>
      <Typography variant="pi" textColor="neutral600" textAlign="center">
        Ready to import data from <code>{pending.archive}</code>.
      </Typography>
      <Flex gap={2} justifyContent="center">
        <Button variant="tertiary" onClick={onDiscard}>Discard</Button>
        <Button variant="default" onClick={onImport}>Import data now</Button>
      </Flex>
    </Flex>
  );

  const renderBusy = () => (
    <Flex direction="column" gap={3} alignItems="stretch">
      {renderHeader()}
      {phase === "loading" && <Flex justifyContent="center"><Loader small>Loading…</Loader></Flex>}
      {phase === "analyzing" && <Flex justifyContent="center"><Loader small>Analyzing archive…</Loader></Flex>}
      {phase === "plan" && plan && renderPlan()}
      {phase === "syncing" && <Flex justifyContent="center"><Loader small>Writing schema files…</Loader></Flex>}
      {phase === "restarting" && (
        <Typography variant="pi" textColor="warning600" textAlign="center">
          Strapi is restarting to pick up the new content-types. Reload this page in ~10 seconds —
          an &quot;Import data now&quot; button will appear here.
        </Typography>
      )}
      {phase === "pending" && pending && renderPending()}
      {phase === "importing" && <Flex justifyContent="center"><Loader small>Starting import…</Loader></Flex>}
    </Flex>
  );

  return (
    <Box borderColor="neutral200" padding={5} hasRadius background="neutral0" shadow="filterShadow">
      {phase === "idle" ? renderIdle() : renderBusy()}
    </Box>
  );
};

export default FullSeedCard;
