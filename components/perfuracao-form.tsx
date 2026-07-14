"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { normalizeDrillingHoleCode } from "@/lib/drilling";

type HoleInput = {
  key: string;
  code: string;
  meters: string;
};

type InitialHoleInput = {
  code: string;
  meters: string;
};

type DowntimeInput = {
  key: string;
  hours: string;
  reason: string;
  otherReason: string;
};

type InitialDowntimeInput = {
  hours: string;
  reason: string;
};

const DOWNTIME_REASONS = ["Esperando topógrafo", "Esperando diesel", "Manutenção", "Outro"];

function newHoleKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function blankHole(key = newHoleKey()): HoleInput {
  return { key, code: "", meters: "" };
}

function blankDowntime(key = newHoleKey()): DowntimeInput {
  return { key, hours: "", reason: "", otherReason: "" };
}

function buildInitialHoles(initialHoles: InitialHoleInput[] = []) {
  const rows = initialHoles.length > 0
    ? initialHoles.map((hole, index) => ({
        key: `initial-${index}`,
        code: normalizeDrillingHoleCode(hole.code),
        meters: hole.meters
      }))
    : [blankHole("new-0")];

  const last = rows[rows.length - 1];
  if (last.code.trim() || last.meters.trim()) {
    rows.push(blankHole("new-tail"));
  }

  return rows;
}

function buildInitialDowntimes(initialDowntimes: InitialDowntimeInput[] = []) {
  return initialDowntimes.map((downtime, index) => {
    const fixedReason = DOWNTIME_REASONS.includes(downtime.reason) ? downtime.reason : "Outro";
    return {
      key: `initial-downtime-${index}`,
      hours: downtime.hours,
      reason: fixedReason,
      otherReason: fixedReason === "Outro" ? downtime.reason : ""
    };
  });
}

export function PerfuracaoFormFields({
  initialHoles = [],
  initialDowntimes = []
}: {
  initialHoles?: InitialHoleInput[];
  initialDowntimes?: InitialDowntimeInput[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { pending } = useFormStatus();
  const [holes, setHoles] = useState<HoleInput[]>(() => buildInitialHoles(initialHoles));
  const [downtimes, setDowntimes] = useState<DowntimeInput[]>(() => buildInitialDowntimes(initialDowntimes));
  const [error, setError] = useState("");
  const wasPendingRef = useRef(false);

  function updateHole(key: string, field: "code" | "meters", value: string) {
    setHoles((current) => {
      const updated = current.map((item) => (item.key === key ? { ...item, [field]: value } : item));
      const last = updated[updated.length - 1];
      if (last.code.trim() && last.meters.trim()) {
        return [...updated, blankHole()];
      }
      return updated;
    });
  }

  function normalizeHoleCodeOnBlur(key: string) {
    setHoles((current) => current.map((item) => (
      item.key === key ? { ...item, code: normalizeDrillingHoleCode(item.code) } : item
    )));
  }
  function addHole() {
    setHoles((current) => [...current, blankHole()]);
  }

  function removeHole(key: string) {
    setHoles((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current));
  }

  function updateDowntime(key: string, field: "hours" | "reason" | "otherReason", value: string) {
    setDowntimes((current) => current.map((item) => {
      if (item.key !== key) return item;
      if (field === "reason" && value !== "Outro") {
        return { ...item, reason: value, otherReason: "" };
      }
      return { ...item, [field]: value };
    }));
  }

  function addDowntime() {
    setDowntimes((current) => [...current, blankDowntime()]);
  }

  function removeDowntime(key: string) {
    setDowntimes((current) => current.filter((item) => item.key !== key));
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
      const completeDowntimes = downtimes.filter((downtime) => {
        const reason = downtime.reason === "Outro" ? downtime.otherReason.trim() : downtime.reason.trim();
        return downtime.hours.trim() && reason;
      });
      if (completeDowntimes.length > 0) return;

      event.preventDefault();
      setError("Adicione pelo menos um furo, uma parada ou preencha a observação.");
      return;
    }

    const incompleteDowntime = downtimes.find((downtime) => {
      const reason = downtime.reason === "Outro" ? downtime.otherReason.trim() : downtime.reason.trim();
      const touched = Boolean(downtime.hours.trim() || downtime.reason.trim() || downtime.otherReason.trim());
      return touched && (!downtime.hours.trim() || !reason);
    });

    if (incompleteDowntime) {
      event.preventDefault();
      setError("Informe as horas e o motivo da parada.");
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
  }, [holes, downtimes]);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (wasPendingRef.current) {
      wasPendingRef.current = false;
      setError("");
      setHoles([blankHole("new-0")]);
      setDowntimes([]);
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
              <input
                name="holeCode"
                inputMode="text"
                placeholder={`F${index + 1} ou AUX`}
                value={hole.code}
                data-hole-field="code"
                data-hole-index={index}
                onChange={(event) => updateHole(hole.key, "code", event.target.value)}
                onBlur={() => normalizeHoleCodeOnBlur(hole.key)}
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
      <div className="downtime-section">
        <div className="holes-head">
          <strong>Horas paradas</strong>
          <button className="secondary compact" type="button" onClick={addDowntime}>+ Adicionar parada</button>
        </div>
        {downtimes.length === 0 ? <p className="muted-text">Opcional. Use quando a equipe ficou parada por topografia, diesel, manutenção ou outro motivo.</p> : null}
        {downtimes.map((downtime) => (
          <div className="downtime-row" key={downtime.key}>
            <label>
              Horas
              <input
                name="downtimeHours"
                inputMode="decimal"
                placeholder="0,00"
                value={downtime.hours}
                onChange={(event) => updateDowntime(downtime.key, "hours", event.target.value)}
              />
            </label>
            <label>
              Motivo
              <select
                name="downtimeReason"
                value={downtime.reason}
                onChange={(event) => updateDowntime(downtime.key, "reason", event.target.value)}
              >
                <option value="">Selecione</option>
                {DOWNTIME_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </label>
            {downtime.reason === "Outro" ? (
              <label>
                Outro motivo
                <input
                  name="downtimeOtherReason"
                  placeholder="Descreva o motivo"
                  value={downtime.otherReason}
                  onChange={(event) => updateDowntime(downtime.key, "otherReason", event.target.value)}
                />
              </label>
            ) : (
              <input type="hidden" name="downtimeOtherReason" value="" />
            )}
            <button className="icon-danger" type="button" tabIndex={-1} onClick={() => removeDowntime(downtime.key)} aria-label="Remover parada">
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


