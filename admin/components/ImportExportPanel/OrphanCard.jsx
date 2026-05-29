import React, { useCallback, useEffect, useState } from "react";

import { Box, Flex, Button, Typography } from "@strapi/design-system";
import { ArrowClockwise, Plus, Folder } from "@strapi/icons";

import { adoptOrphans, diagnoseOrphans } from "../../utils/api";
import { readServerError } from "../../utils/format";
import SectionHeading from "../SectionHeading";

const ORPHAN_HINT =
  "Files in public/uploads/ with no matching plugin::upload.file row. They remain after a failed restore "
  + "(new media was extracted, but the rollback restored the old DB). Adopting inserts the missing rows so the "
  + "files appear in the Media Library and survive future backups.";

const formatNumber = (n) => (typeof n === "number" ? n.toLocaleString() : "—");

const Stat = ({ label, value }) => (
  <Flex
    direction="column"
    gap={1}
    flex="1"
    minWidth="6rem"
    paddingTop={2}
    paddingBottom={2}
    paddingLeft={3}
    paddingRight={3}
    background="neutral100"
    borderColor="neutral200"
    hasRadius
    alignItems="flex-start"
  >
    <Typography variant="sigma" textColor="neutral500">{label}</Typography>
    <Typography variant="delta" fontWeight="bold" textColor="neutral800">{formatNumber(value)}</Typography>
  </Flex>
);

const OrphanCard = ({ notify, onAdopted }) => {
  const [diag, setDiag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adopting, setAdopting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDiag(await diagnoseOrphans());
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdopt = async () => {
    setAdopting(true);
    try {
      const result = await adoptOrphans();
      setDiag(result?.after || null);
      notify({ type: "success", message: `Adopted ${result?.adopted || 0} orphan file(s) into the Media Library.` });
      onAdopted?.(result);
    } catch (e) {
      notify({ type: "danger", message: readServerError(e) });
    } finally {
      setAdopting(false);
    }
  };

  const orphans = diag?.orphans || 0;
  const hasOrphans = orphans > 0;
  const busy = loading || adopting;
  const statusText = hasOrphans
    ? `orphan file${orphans === 1 ? "" : "s"} need adopting into the Media Library`
    : "no orphans — every file on disk is tracked";

  const renderHeader = () => (
    <SectionHeading
      icon={<Folder width="1.5rem" height="1.5rem" />}
      title="Orphan files"
      hint={ORPHAN_HINT}
      actions={(
        <>
          <Button size="S" variant="tertiary" startIcon={<ArrowClockwise />} onClick={refresh} loading={loading} disabled={busy}>
            Refresh
          </Button>
          <Button size="S" startIcon={<Plus />} onClick={handleAdopt} loading={adopting} disabled={!hasOrphans || busy}>
            Adopt now
          </Button>
        </>
      )}
    />
  );

  const renderBody = () => (
    <Flex gap={3} alignItems="stretch" wrap="wrap">
      <Flex
        gap={3}
        alignItems="center"
        flex="1"
        minWidth="18rem"
        paddingTop={3}
        paddingBottom={3}
        paddingLeft={4}
        paddingRight={4}
        hasRadius
        background={hasOrphans ? "danger100" : "success100"}
        borderColor={hasOrphans ? "danger200" : "success200"}
      >
        <Typography variant="alpha" fontWeight="bold" textColor={hasOrphans ? "danger600" : "success600"}>
          {formatNumber(orphans)}
        </Typography>
        <Typography variant="omega" textColor={hasOrphans ? "danger700" : "success700"}>
          {statusText}
        </Typography>
      </Flex>
      <Stat label="DB rows" value={diag?.dbRows} />
      <Stat label="Files on disk" value={diag?.diskFiles} />
      <Stat label="Variants" value={diag?.variants} />
    </Flex>
  );

  return (
    <Box borderColor="neutral200" background="neutral0" padding={5} hasRadius shadow="filterShadow">
      <Flex direction="column" gap={4} alignItems="stretch">
        {renderHeader()}
        {renderBody()}
      </Flex>
    </Box>
  );
};

export default OrphanCard;
