import { useEffect, useState } from "react";

import { fetchContentType, fetchLocales } from "../../../utils/api";
import { PLAIN_TYPES } from "../../../constants/export";

const uniq = (arr) => arr.filter((v, i, a) => a.indexOf(v) === i);

const pickPlainKeys = (attributes) =>
  Object.keys(attributes || {}).filter((k) => PLAIN_TYPES.has(attributes[k]?.type));

export const useCollectionSchema = (uid, setError, defaultSortIfMissing) => {
  const [collection, setCollection] = useState(null);
  const [locales, setLocales] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [meta, list] = await Promise.all([fetchContentType(uid), fetchLocales()]);
        if (cancelled) return;
        setCollection(meta);
        setLocales(list);

        const plainKeys = pickPlainKeys(meta?.attributes);
        const initial = uniq(["id", "documentId", ...plainKeys]);
        setColumns(initial);
        setSelectedColumns(initial.slice(0, Math.min(initial.length, 8)));
        if (plainKeys.includes("createdAt")) defaultSortIfMissing?.("createdAt");
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  return { collection, locales, columns, selectedColumns, setSelectedColumns, loading };
};
