"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type HoleInput = {
  key: string;
  code: string;
  meters: string;
};

type InitialHoleInput = {
  code: string;
  meters: string;
};

function newHoleKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function blankHole(key = newHoleKey()): HoleInput {
  return { key, code: "", meters: "" };
}

function numericHoleCode(value: string) {
  return value.replace(/^F/i, "").replace(/\D/g, "");
}

function buildInitialHoles(initialHoles: InitialHoleInput[] = []) {
  const rows = initialHoles.length > 0
    ? initialHoles.map((hole, index) => ({
        key: `initial-${index}`,
        code: numericHoleCode(hole.code),
        meters: hole.meters
      }))
    : [blankHole("new-0")];

  const last = rows[rows.length - 1];
  if (last.code.trim() || last.meters.trim()) {
    rows.push(blankHole("new-tail"));
  }

  return rows;
}

export function PerfuracaoFormFields({ initialHoles = [] }: { initialHoles?: InitialHoleInput[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { pending } = useFormStatus();
  const [holes, setHoles] = useState<HoleInput[]>(() => buildInitialHoles(initialHoles));
  const [error, setError] = useState("");
  const wasPendingRef = useRef(false);

  function updateHole(key: string, field: "code" | "meters", value: string) {
    const fieldValue = field === "code" ? numericHoleCode(value) : value;
    setHoles((current) => {
      const updated = current.map((item) => (item.key === key ? { ...item, [field]: fieldValue } : item));
      const last = updated[updated.length - 1];
      if (last.code.trim() && last.meters.trim()) {
        return [...updated, blankHole()];
      }
      return updated;
    });
  }

  function addHole() {
    setHoles((current) => [...current, blankHole()]);
  }

  function removeHole(key: string) {
    setHoles((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current));
  }

  function focusHole(index: number, field: "code" | "meters") {
    window.setTimeout(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>(
        `input[data-hole-field="${field}"][data-hole-index="${index}"]`
      );
      input?.focus();
      input?.select();
    }, 0);
  }

  function handleHoleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    field: "code" | "meters"
  ) {
    if (event.key !== "Enter" && event.key !== "Tab") return;
    if (event.key === "Tab" && event.shiftKey) return;

    if (event.key === "Enter") {
      event.preventDefault();
    }

    const value = event.currentTarget.value.trim();
    if (field === "code" && value) {
      event.preventDefault();
      focusHole(index, "meters");
      return;
    }

    const currentCode = holes[index]?.code.trim();
    if (field === "meters" && value && currentCode) {
      event.preventDefault();
      const currentKey = holes[index]?.key;
      setHoles((current) => {
        const currentIndex = current.findIndex((hole) => hole.key === currentKey);
        if (currentIndex === current.length - 1) {
          return [...current, blankHole()];
        }
        return current;
      });
      focusHole(index + 1, "code");
    }
  }

  function validateHoles(event: Event) {
    setError("");
    const form = containerRef.current?.closest("form");
    const notes = form ? String(new FormData(form).get("notes") ?? "").trim() : "";

    const incomplete = holes.find((hole) => {
      const hasCode = Boolean(hole.code.trim());
      const hasMeters = Boolean(hole.meters.trim());
      return hasCode !== hasMeters;
    });

    if (incomplete?.code.trim() && !incomplete.meters.trim()) {
      event.preventDefault();
      setError(`Informe a metragem do furo F${incomplete.code.trim()}.`);
      return;
    }

    if (incomplete?.meters.trim() && !incomplete.code.trim()) {
      event.preventDefault();
      setError("Informe o ID do furo que possui metragem preenchida.");
      return;
    }

    const completeRows = holes.filter((hole) => hole.code.trim() && hole.meters.trim());
    if (completeRows.length === 0 && !notes) {
      event.preventDefault();
      setError("Adicione pelo menos um furo com ID e metragem ou preencha a observação.");
    }
  }

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    if (!form) return;

    const handleSubmit = (event: Event) => {
      validateHoles(event);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== "Enter" || !(target instanceof HTMLInputElement)) return;
      if (target.type === "submit") return;
      event.preventDefault();
    };

    form.addEventListener("submit", handleSubmit);
    form.addEventListener("keydown", handleKeyDown);
    return () => {
      form.removeEventListener("submit", handleSubmit);
      form.removeEventListener("keydown", handleKeyDown);
    };
  }, [holes]);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      setError("");
      setHoles([blankHole("new-0")]);
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
            <span className="hole-code-control">
              <span>F</span>
              <input
                name="holeCode"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`${index + 1}`}
                value={hole.code}
                data-hole-field="code"
                data-hole-index={index}
                onChange={(event) => updateHole(hole.key, "code", event.target.value)}
                onKeyDown={(event) => handleHoleKeyDown(event, index, "code")}
              />
            </span>
          </label>
          <label>
            Metros perfurados
            <input
              name="holeMeters"
              inputMode="decimal"
              placeholder="0,00"
              value={hole.meters}
              data-hole-field="meters"
              data-hole-index={index}
              onChange={(event) => updateHole(hole.key, "meters", event.target.value)}
              onKeyDown={(event) => handleHoleKeyDown(event, index, "meters")}
            />
          </label>
          <button className="icon-danger" type="button" tabIndex={-1} onClick={() => removeHole(hole.key)} aria-label="Remover furo">
            x
          </button>
        </div>
      ))}
    </div>
  );
}


