import { useCallback, useEffect, useState } from "react";
import { api, Category } from "./api";

export default function useCatalogue() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    setError("");
    void api
      .categories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load the learning library",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return { categories, error, retry };
}
