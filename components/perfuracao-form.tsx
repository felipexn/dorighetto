"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type HoleInput = {
  key: string;
  code: string;
  meters: string;
};

export function PerfuracaoFormFields() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { pending } = useFormStatus();
  const [holes, setHoles] = useState<HoleInput[]>([
    { key: crypto.randomUUID(), code: "", meters: "" }
  ]);
  const [error, setError] = useState("");
  const wasPendingRef = useRef(false);

  function updateHole(key: string, field: "code" | "meters", value: string) {
    setHoles((current) => {
      const updated = current.map((item) => (item.key === key ? { ...item, [field]: value } : item));
      const last = updated[updated.length - 1];
      if (last.code.trim() && last.meters.trim()) {
        return [...updated, { key: crypto.randomUUID(), code: "", meters: "" }];
      }
      return updated;
    });
  }

  function addHole() {
    setHoles((current) => [...current, { key: crypto.randomUUID(), code: "", meters: "" }]);
  }

  function removeHole(key: string) {
    setHoles((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current));
  }

  function validateHoles(event: Event) {
    setError("");

    const incomplete = holes.find((hole) => {
      const hasCode = Boolean(hole.code.trim());
      const hasMeters = Boolean(hole.meters.trim());
      return hasCode !== hasMeters;
    });

    if (incomplete?.code.trim() && !incomplete.meters.trim()) {
      event.preventDefault();
      setError(`Informe a metragem do furo ${incomplete.code.trim()}.`);
      return;
    }

    if (incomplete?.meters.trim() && !incomplete.code.trim()) {
      event.preventDefault();
      setError("Informe o ID do furo que possui metragem preenchida.");
      return;
    }

    const completeRows = holes.filter((hole) => hole.code.trim() && hole.meters.trim());
    if (completeRows.length === 0) {
      event.preventDefault();
      setError("Adicione pelo menos um furo com ID e metragem.");
    }
  }

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;

    const handleSubmit = (event: Event) => {
      validateHoles(event);
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [holes]);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      setError("");
      setHoles([{ key: crypto.randomUUID(), code: "", meters: "" }]);
    }
  }, [pending]);

  return (
    <div className="holes-form" ref={containerRef}>
      <div className="holes-head">
        <strong>Furos do dia</strong>
        <button className="secondary compact" type="button" onClick={addHole}>+ Adicionar furo</button>
      </div>
      {error ? <p className="inline-form-error">{error}</p> : null}
      {holes.map((hole, index) => (
        <div className="hole-row" key={hole.key}>
          <label>
            ID do furo
            <input
              name="holeCode"
              placeholder={`F${index + 1}`}
              value={hole.code}
              onChange={(event) => updateHole(hole.key, "code", event.target.value)}
            />
          </label>
          <label>
            Metros perfurados
            <input
              name="holeMeters"
              placeholder="0,00"
              value={hole.meters}
              onChange={(event) => updateHole(hole.key, "meters", event.target.value)}
            />
          </label>
          <button className="icon-danger" type="button" onClick={() => removeHole(hole.key)} aria-label="Remover furo">
            x
          </button>
        </div>
      ))}
    </div>
  );
}


