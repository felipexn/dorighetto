"use client";

import { useState } from "react";

type HoleInput = {
  key: string;
  code: string;
  meters: string;
};

export function PerfuracaoFormFields() {
  const [holes, setHoles] = useState<HoleInput[]>([
    { key: crypto.randomUUID(), code: "", meters: "" }
  ]);

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

  return (
    <div className="holes-form">
      <div className="holes-head">
        <strong>Furos do dia</strong>
        <button className="secondary compact" type="button" onClick={addHole}>+ Adicionar furo</button>
      </div>
      {holes.map((hole, index) => (
        <div className="hole-row" key={hole.key}>
          <label>
            ID do furo
            <input
              name="holeCode"
              placeholder={`F${index + 1}`}
              value={hole.code}
              onChange={(event) => updateHole(hole.key, "code", event.target.value)}
              required
            />
          </label>
          <label>
            Metros perfurados
            <input
              name="holeMeters"
              placeholder="0,00"
              value={hole.meters}
              onChange={(event) => updateHole(hole.key, "meters", event.target.value)}
              required
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
