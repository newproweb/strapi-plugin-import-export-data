import { useEffect, useState } from "react";

import { fetchContentTypes } from "../utils/api";

export const useContentTypes = () => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchContentTypes();
        if (!cancelled) setCollections(data);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { collections, isLoading, error };
};
