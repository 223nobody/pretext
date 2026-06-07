import { useEffect, useState } from "react";
import { Library } from "lucide-react";

import { getSample, listSamples } from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { t } from "../../lib/i18n";
import { useReaderStore } from "../../store/readerStore";
import type { SampleSummary } from "../../types";

export function SampleLoader() {
  const [samples, setSamples] = useState<SampleSummary[]>([]);
  const setLoading = useReaderStore((state) => state.setLoading);
  const setContent = useReaderStore((state) => state.setContent);
  const setError = useReaderStore((state) => state.setError);
  const isLoading = useReaderStore((state) => state.isLoading);
  const language = useReaderStore((state) => state.language);

  useEffect(() => {
    listSamples()
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  const load = async (id: string) => {
    if (isLoading) {
      return;
    }
    setLoading(true, 20);
    try {
      const sample = await getSample(id);
      setContent(
        sample.text,
        { title: sample.title, author: sample.author, source: sample.category },
        "sample",
      );
    } catch (error) {
      setError(getApiErrorMessage(language, error, "sampleLoadFailed"));
    }
  };

  return (
    <div className="sample-row">
      <Library size={16} />
      <select
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) {
            void load(event.target.value);
          }
        }}
        aria-label={t(language, "samples")}
        disabled={isLoading}
      >
        <option value="" disabled>
          {t(language, "samples")}
        </option>
        {samples.map((sample) => (
          <option key={sample.id} value={sample.id}>
            {sample.title}
          </option>
        ))}
      </select>
    </div>
  );
}
