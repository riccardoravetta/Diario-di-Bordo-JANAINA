import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Camera,
  Search,
  Wrench,
  AlertTriangle,
  Gauge,
  Zap,
  Droplet,
  Wind,
  CheckCircle2,
  Ship,
  BookOpen,
  Trash2,
  Pencil,
  ImageOff,
  List as ListIcon,
  Settings,
  Loader2,
  ListChecks,
  Square,
  CheckSquare,
} from "lucide-react";
import { db, storage } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

/* ---------------------------------------------------------------
   Palette & type system — carta nautica: navy profondo, ottone,
   verde vela, rosso segnale pericolo, carta pergamena invecchiata.
--------------------------------------------------------------- */
const COLORS = {
  navy: "#16324A",
  navyDeep: "#0F2436",
  parchment: "#F3ECDA",
  parchmentCard: "#FBF6E9",
  ink: "#23282B",
  inkSoft: "#5B5548",
  brass: "#B8863E",
  brassSoft: "#D9B876",
  line: "#D8CBA8",
};

const CATEGORIES = [
  { id: "attrezzatura", label: "Cambio attrezzatura", icon: Wrench, color: "#B8863E" },
  { id: "riparazioni", label: "Danni e riparazioni", icon: AlertTriangle, color: "#C1483A" },
  { id: "motore", label: "Motore", icon: Gauge, color: "#3A5A6B" },
  { id: "elettricita", label: "Elettricità", icon: Zap, color: "#C98A1F" },
  { id: "idraulica", label: "Idraulica", icon: Droplet, color: "#3F6B8C" },
  { id: "vele", label: "Vele", icon: Wind, color: "#5B7B54" },
  { id: "manutenzione", label: "Manutenzione ordinaria", icon: CheckCircle2, color: "#8A8360" },
  { id: "navigazione", label: "Navigazione / Uscite", icon: Ship, color: "#16324A" },
  { id: "note", label: "Note generali", icon: BookOpen, color: "#6B6558" },
];
const catMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const PRIORITIES = [
  { id: "alta", label: "Priorità alta", color: "#C1483A" },
  { id: "media", label: "Priorità media", color: "#C98A1F" },
  { id: "bassa", label: "Priorità bassa", color: "#7A8580" },
];

const GIORNI = ["L", "M", "M", "G", "V", "S", "D"];
const GIORNI_LUNGHI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const toISO = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = () => toISO(new Date());
const humanDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return `${GIORNI_LUNGHI[dow]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
};

// Ridimensiona un'immagine in un Blob JPEG leggero, pronto per l'upload.
function resizeToBlob(file, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Carica una foto su Firebase Storage e restituisce { url, path }.
async function uploadPhoto(file) {
  const blob = await resizeToBlob(file);
  const path = `photos/${uid()}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob);
  const url = await getDownloadURL(r);
  return { url, path };
}

/* ---------------------------------------------------------------
   UI atoms
--------------------------------------------------------------- */
function Pennant({ cat, size = "sm", active, onClick }) {
  const Icon = cat.icon;
  const isBtn = typeof onClick === "function";
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 4,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    letterSpacing: "0.01em",
    border: `1px solid ${active === false ? COLORS.line : cat.color}`,
    color: active === false ? COLORS.inkSoft : "#fff",
    background: active === false ? "transparent" : cat.color,
    padding: size === "sm" ? "4px 9px" : "6px 12px",
    fontSize: size === "sm" ? 12 : 13,
    cursor: isBtn ? "pointer" : "default",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  };
  return (
    <button type="button" onClick={onClick} disabled={!isBtn} style={base} className="select-none">
      <Icon size={size === "sm" ? 12 : 14} strokeWidth={2.25} />
      {cat.label}
    </button>
  );
}

/* ---------------------------------------------------------------
   Entry card (log view) — "linea di cima" con medaglioni data
--------------------------------------------------------------- */
function EntryCard({ entry, onEdit }) {
  const cat = catMap[entry.category] || CATEGORIES[8];
  const Icon = cat.icon;
  const d = new Date(entry.date + "T00:00:00");
  return (
    <div className="relative flex gap-4 pb-8">
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 46 }}>
        <div
          className="flex flex-col items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 46,
            height: 46,
            background: COLORS.navy,
            border: `2px solid ${cat.color}`,
            color: COLORS.parchment,
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, lineHeight: 1, fontWeight: 700 }}>
            {String(d.getDate()).padStart(2, "0")}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, opacity: 0.75, textTransform: "uppercase" }}>
            {MESI[d.getMonth()].slice(0, 3)}
          </span>
        </div>
        <div className="flex-1 w-px mt-1" style={{ background: `repeating-linear-gradient(${COLORS.line}, ${COLORS.line} 4px, transparent 4px, transparent 8px)`, minHeight: 20 }} />
      </div>

      <button
        onClick={() => onEdit(entry)}
        className="flex-1 text-left rounded-sm p-4 min-w-0"
        style={{
          background: COLORS.parchmentCard,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 1px 2px rgba(22,50,74,0.06)",
        }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={15} style={{ color: cat.color, flexShrink: 0 }} strokeWidth={2.25} />
            <h3
              className="truncate"
              style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: COLORS.ink }}
            >
              {entry.title || cat.label}
            </h3>
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: cat.color,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {cat.label}
          </span>
        </div>

        {entry.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.tags.map((t) => (
              <span
                key={t}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10.5,
                  padding: "1.5px 6px",
                  borderRadius: 3,
                  background: "rgba(22,50,74,0.06)",
                  color: COLORS.inkSoft,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {entry.text && (
          <p
            className="mt-2 line-clamp-3"
            style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.inkSoft, lineHeight: 1.5 }}
          >
            {entry.text}
          </p>
        )}

        {entry.photos?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {entry.photos.slice(0, 4).map((p, i) => (
              <img
                key={i}
                src={p.url}
                alt=""
                className="rounded-sm object-cover flex-shrink-0"
                style={{ width: 52, height: 52, border: `1px solid ${COLORS.line}` }}
              />
            ))}
            {entry.photos.length > 4 && (
              <div
                className="flex items-center justify-center rounded-sm flex-shrink-0"
                style={{ width: 52, height: 52, background: "rgba(22,50,74,0.08)", color: COLORS.inkSoft, fontSize: 12, fontFamily: "'Inter', sans-serif" }}
              >
                +{entry.photos.length - 4}
              </div>
            )}
          </div>
        )}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   Calendar view
--------------------------------------------------------------- */
function CalendarView({ month, setMonth, entries, onSelectDay, selectedISO }) {
  const year = month.getFullYear();
  const mIdx = month.getMonth();
  const firstOfMonth = new Date(year, mIdx, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

  const entriesByDay = useMemo(() => {
    const map = {};
    for (const e of entries) {
      (map[e.date] ||= []).push(e);
    }
    return map;
  }, [entries]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonth(new Date(year, mIdx - 1, 1))}
          className="p-2 rounded-full hover:bg-black/5"
          style={{ color: COLORS.navy }}
          aria-label="Mese precedente"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: COLORS.navy }}>
          {MESI[mIdx]} <span style={{ opacity: 0.55 }}>{year}</span>
        </h2>
        <button
          onClick={() => setMonth(new Date(year, mIdx + 1, 1))}
          className="p-2 rounded-full hover:bg-black/5"
          style={{ color: COLORS.navy }}
          aria-label="Mese successivo"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {GIORNI.map((g, i) => (
          <div
            key={i}
            className="text-center"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.inkSoft, padding: "4px 0" }}
          >
            {g}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = toISO(new Date(year, mIdx, d));
          const dayEntries = entriesByDay[iso] || [];
          const isToday = iso === todayISO();
          const isSelected = iso === selectedISO;
          const cats = [...new Set(dayEntries.map((e) => e.category))].slice(0, 4);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(iso)}
              className="relative flex flex-col items-start justify-start rounded-sm p-1.5 text-left transition-colors"
              style={{
                aspectRatio: "1 / 1",
                background: isSelected ? COLORS.brassSoft : COLORS.parchmentCard,
                border: `1px solid ${isSelected ? COLORS.brass : COLORS.line}`,
                outline: isToday ? `1.5px solid ${COLORS.navy}` : "none",
                outlineOffset: -1,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 500,
                  color: COLORS.ink,
                }}
              >
                {d}
              </span>
              <div className="flex gap-0.5 flex-wrap mt-auto pt-1">
                {cats.map((c) => (
                  <span
                    key={c}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: catMap[c]?.color || COLORS.navy,
                      display: "inline-block",
                    }}
                  />
                ))}
                {dayEntries.length > 4 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: COLORS.inkSoft }}>
                    +{dayEntries.length - 4}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Day panel — entries for the selected day
--------------------------------------------------------------- */
function DayPanel({ iso, entries, onNew, onEdit, onClose }) {
  const dayEntries = entries.filter((e) => e.date === iso).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  return (
    <div className="mt-5 rounded-sm p-4" style={{ background: "rgba(22,50,74,0.04)", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: COLORS.navy, textTransform: "capitalize" }}>
          {humanDate(iso)}
        </h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5" style={{ color: COLORS.inkSoft }}>
          <X size={16} />
        </button>
      </div>

      {dayEntries.length === 0 && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.inkSoft }}>
          Nessuna voce in questa data. Aggiungi la prima annotazione della giornata.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {dayEntries.map((e) => {
          const cat = catMap[e.category] || CATEGORIES[8];
          const Icon = cat.icon;
          return (
            <button
              key={e.id}
              onClick={() => onEdit(e)}
              className="flex items-center gap-2 text-left rounded-sm px-3 py-2"
              style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}
            >
              <Icon size={14} style={{ color: cat.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.ink, fontWeight: 600 }} className="truncate">
                {e.title || cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onNew(iso)}
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: COLORS.brass, fontFamily: "'Inter', sans-serif" }}
      >
        <Plus size={15} /> Nuova voce per questo giorno
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------
   Entry form (modal)
--------------------------------------------------------------- */
function EntryForm({ initial, onSave, onDelete, onClose }) {
  const [date, setDate] = useState(initial?.date || todayISO());
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0].id);
  const [tagsText, setTagsText] = useState((initial?.tags || []).join(", "));
  const [text, setText] = useState(initial?.text || "");
  const [photos, setPhotos] = useState(initial?.photos || []); // [{url, path}]
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).slice(0, 6 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadPhoto(f)));
      setPhotos((p) => [...p, ...uploaded]);
    } catch (e) {
      console.error("Errore nel caricamento foto", e);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (i) => {
    const p = photos[i];
    setPhotos((ps) => ps.filter((_, idx) => idx !== i));
    if (p?.path) deleteObject(ref(storage, p.path)).catch(() => {});
  };

  const save = async () => {
    if (!date || saving) return;
    setSaving(true);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await onSave({
      id: initial?.id || uid(),
      date,
      title: title.trim(),
      category,
      tags,
      text: text.trim(),
      photos,
      createdAt: initial?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSaving(false);
  };

  const inputStyle = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    background: "#fff",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
    padding: "8px 10px",
    color: COLORS.ink,
    width: "100%",
  };
  const labelStyle = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11.5,
    fontWeight: 700,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 5,
    display: "block",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(15,36,54,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-lg sm:rounded-lg"
        style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0"
          style={{ background: COLORS.navy, color: COLORS.parchment }}
        >
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>
            {initial?.id ? "Modifica voce" : "Nuova voce di diario"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label style={labelStyle}>Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Titolo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Sostituito strallo di prua"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Categoria</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Pennant key={c.id} cat={c} active={category === c.id} onClick={() => setCategory(c.id)} />
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Componenti / tag (separati da virgola)</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Es. stralli, vele, parabordi"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Annotazioni</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Descrivi cosa è successo, cosa è stato fatto, ricambi usati…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Foto ({photos.length}/6)</label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p.path || i} className="relative">
                  <img src={p.url} alt="" className="rounded-sm object-cover" style={{ width: 64, height: 64, border: `1px solid ${COLORS.line}` }} />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center"
                    style={{ width: 18, height: 18, background: COLORS.navy, color: "#fff" }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex flex-col items-center justify-center rounded-sm gap-1"
                  style={{ width: 64, height: 64, border: `1px dashed ${COLORS.brass}`, color: COLORS.brass, background: "rgba(184,134,62,0.06)" }}
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={17} />}
                  <span style={{ fontSize: 9.5, fontFamily: "'Inter', sans-serif" }}>{uploading ? "…" : "Aggiungi"}</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          {initial?.id ? (
            <button
              onClick={() => onDelete(initial.id)}
              className="flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "#C1483A", fontFamily: "'Inter', sans-serif" }}
            >
              <Trash2 size={15} /> Elimina
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-sm font-semibold"
              style={{ fontFamily: "'Inter', sans-serif", color: COLORS.inkSoft, background: "transparent" }}
            >
              Annulla
            </button>
            <button
              onClick={save}
              disabled={saving || uploading}
              className="px-4 py-2 rounded text-sm font-semibold"
              style={{ fontFamily: "'Inter', sans-serif", color: "#fff", background: COLORS.brass, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Lista annuale — cose da fare, ordinate per priorità
--------------------------------------------------------------- */
function TaskList({ tasks, onAdd, onToggle, onDelete }) {
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("alta");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onAdd({ id: uid(), text: t, priority, done: false, createdAt: new Date().toISOString() });
    setText("");
  };

  const groups = PRIORITIES.map((p) => ({
    prio: p,
    items: tasks.filter((t) => t.priority === p.id).sort((a, b) => (a.done === b.done ? (a.createdAt > b.createdAt ? 1 : -1) : a.done ? 1 : -1)),
  }));

  const inputStyle = {
    fontFamily: "'Inter', sans-serif",
    fontSize: 13.5,
    background: "#fff",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
    padding: "8px 10px",
    color: COLORS.ink,
  };

  return (
    <div>
      <div className="rounded-sm p-4 mb-6" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
        <label
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 11.5,
            fontWeight: 700,
            color: COLORS.inkSoft,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 8,
            display: "block",
          }}
        >
          Aggiungi cosa da fare per l'anno
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Es. Revisione motore, cambio zinchi…"
            style={{ ...inputStyle, flex: 1 }}
          />
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPriority(p.id)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "6px 10px",
                  borderRadius: 4,
                  border: `1px solid ${priority === p.id ? p.color : COLORS.line}`,
                  background: priority === p.id ? p.color : "transparent",
                  color: priority === p.id ? "#fff" : COLORS.inkSoft,
                  whiteSpace: "nowrap",
                }}
              >
                {p.label.replace("Priorità ", "")}
              </button>
            ))}
            <button
              onClick={add}
              className="flex items-center justify-center rounded-sm px-3"
              style={{ background: COLORS.brass, color: "#fff" }}
              aria-label="Aggiungi"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="flex flex-col items-center text-center gap-2 py-16" style={{ color: COLORS.inkSoft }}>
          <ListChecks size={26} style={{ opacity: 0.5 }} />
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
            Nessuna voce in lista. Aggiungi le cose da fare quest'anno, dalle più importanti alle meno urgenti.
          </p>
        </div>
      )}

      {groups.map(
        ({ prio, items }) =>
          items.length > 0 && (
            <div key={prio.id} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: prio.color, display: "inline-block" }} />
                <h3
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: prio.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {prio.label} · {items.filter((t) => !t.done).length} da fare
                </h3>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2.5 rounded-sm px-3 py-2.5"
                    style={{
                      background: COLORS.parchmentCard,
                      border: `1px solid ${COLORS.line}`,
                      borderLeft: `3px solid ${prio.color}`,
                      opacity: t.done ? 0.55 : 1,
                    }}
                  >
                    <button onClick={() => onToggle(t.id)} className="flex-shrink-0" style={{ color: t.done ? prio.color : COLORS.inkSoft }} aria-label="Segna come fatto">
                      {t.done ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <span
                      className="flex-1 truncate"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 14,
                        color: COLORS.ink,
                        textDecoration: t.done ? "line-through" : "none",
                      }}
                    >
                      {t.text}
                    </span>
                    <button onClick={() => onDelete(t.id)} className="flex-shrink-0 p-1" style={{ color: COLORS.inkSoft }} aria-label="Elimina">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   App
--------------------------------------------------------------- */
export default function DiarioDiBordo() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({ boatName: "Il mio veliero" });
  const [saveError, setSaveError] = useState(false);
  const [tasks, setTasks] = useState([]);

  const [view, setView] = useState("calendar");
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeCats, setActiveCats] = useState(() => new Set(CATEGORIES.map((c) => c.id)));
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Sincronizzazione in tempo reale con Firestore: chiunque apra il sito
  // vede subito le voci aggiunte da un altro familiare.
  useEffect(() => {
    const unsubEntries = onSnapshot(
      collection(db, "entries"),
      (snap) => {
        setEntries(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
        setSaveError(true);
      }
    );
    const unsubTasks = onSnapshot(collection(db, "tasks"), (snap) => {
      setTasks(snap.docs.map((d) => d.data()));
    });
    const unsubSettings = onSnapshot(doc(db, "settings", "config"), (snap) => {
      setSettings(snap.exists() ? snap.data() : { boatName: "Il mio veliero" });
    });
    return () => {
      unsubEntries();
      unsubTasks();
      unsubSettings();
    };
  }, []);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    try {
      await setDoc(doc(db, "settings", "config"), next, { merge: true });
    } catch {
      setSaveError(true);
    }
  }, []);

  const toggleCat = (id) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allOn = activeCats.size === CATEGORIES.length;
  const toggleAll = () => setActiveCats(allOn ? new Set() : new Set(CATEGORIES.map((c) => c.id)));

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => activeCats.has(e.category))
      .filter((e) => {
        if (!q) return true;
        return (
          e.title?.toLowerCase().includes(q) ||
          e.text?.toLowerCase().includes(q) ||
          e.tags?.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
  }, [entries, activeCats, search]);

  const pendingDate = useRef(todayISO());
  const openEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleSave = async (entry) => {
    try {
      await setDoc(doc(db, "entries", entry.id), entry);
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleDelete = async (id) => {
    const entry = entries.find((e) => e.id === id);
    try {
      if (entry?.photos?.length) {
        await Promise.all(entry.photos.map((p) => deleteObject(ref(storage, p.path)).catch(() => {})));
      }
      await deleteDoc(doc(db, "entries", id));
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
    setShowForm(false);
    setEditingEntry(null);
  };

  const handleAddTask = async (task) => {
    try {
      await setDoc(doc(db, "tasks", task.id), task);
    } catch {
      setSaveError(true);
    }
  };
  const handleToggleTask = async (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    try {
      await setDoc(doc(db, "tasks", id), { ...t, done: !t.done });
    } catch {
      setSaveError(true);
    }
  };
  const handleDeleteTask = async (id) => {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch {
      setSaveError(true);
    }
  };

  const doReset = async () => {
    try {
      await Promise.all(
        entries.flatMap((e) => (e.photos || []).map((p) => deleteObject(ref(storage, p.path)).catch(() => {})))
      );
      await Promise.all(entries.map((e) => deleteDoc(doc(db, "entries", e.id))));
      await Promise.all(tasks.map((t) => deleteDoc(doc(db, "tasks", t.id))));
    } catch {
      setSaveError(true);
    }
    setConfirmReset(false);
    setShowSettingsMenu(false);
  };

  return (
    <div className="w-full min-h-full" style={{ background: COLORS.parchment }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.2); }
      `}</style>

      {/* Header */}
      <div style={{ background: COLORS.navy }} className="px-4 sm:px-6 pt-6 pb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <svg width="34" height="34" viewBox="0 0 34 34" style={{ flexShrink: 0 }}>
                <circle cx="17" cy="17" r="15.5" fill="none" stroke={COLORS.brassSoft} strokeWidth="1.2" />
                <circle cx="17" cy="17" r="1.6" fill={COLORS.brassSoft} />
                <path d="M17 4 L19.5 15.5 L17 17 L14.5 15.5 Z" fill={COLORS.brassSoft} />
                <path d="M17 30 L19.5 18.5 L17 17 L14.5 18.5 Z" fill="none" stroke={COLORS.brassSoft} strokeWidth="1" />
                <path d="M4 17 L15.5 14.5 L17 17 L15.5 19.5 Z" fill="none" stroke={COLORS.brassSoft} strokeWidth="1" />
                <path d="M30 17 L18.5 19.5 L17 17 L18.5 14.5 Z" fill="none" stroke={COLORS.brassSoft} strokeWidth="1" />
              </svg>
              <div className="min-w-0">
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.brassSoft, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Diario di bordo
                </p>
                {editingName ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      persistSettings({ ...settings, boatName: nameDraft.trim() || settings.boatName });
                      setEditingName(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: 22,
                      fontWeight: 600,
                      background: "transparent",
                      color: COLORS.parchment,
                      border: "none",
                      borderBottom: `1px solid ${COLORS.brassSoft}`,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setNameDraft(settings.boatName);
                      setEditingName(true);
                    }}
                    className="flex items-center gap-2 truncate"
                  >
                    <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: COLORS.parchment }} className="truncate">
                      {settings.boatName}
                    </h1>
                    <Pencil size={12} style={{ color: COLORS.brassSoft, flexShrink: 0 }} />
                  </button>
                )}
              </div>
            </div>

            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowSettingsMenu((s) => !s)}
                className="p-2 rounded-full hover:bg-white/10"
                style={{ color: COLORS.parchment }}
                aria-label="Impostazioni"
              >
                <Settings size={18} />
              </button>
              {showSettingsMenu && (
                <div
                  className="absolute right-0 top-11 z-40 rounded-sm overflow-hidden"
                  style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}`, minWidth: 200 }}
                >
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-black/5"
                    style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#C1483A" }}
                  >
                    <Trash2 size={14} /> Cancella tutti i dati
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 mt-5 p-1 rounded-md w-fit" style={{ background: "rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => setView("calendar")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                background: view === "calendar" ? COLORS.brass : "transparent",
                color: view === "calendar" ? "#fff" : COLORS.parchment,
              }}
            >
              <CalendarIcon size={14} /> Calendario
            </button>
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                background: view === "list" ? COLORS.brass : "transparent",
                color: view === "list" ? "#fff" : COLORS.parchment,
              }}
            >
              <ListIcon size={14} /> Registro
            </button>
            <button
              onClick={() => setView("tasks")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                background: view === "tasks" ? COLORS.brass : "transparent",
                color: view === "tasks" ? "#fff" : COLORS.parchment,
              }}
            >
              <ListChecks size={14} /> Lista annuale
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div style={{ color: COLORS.navy }}>
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <Loader2 className="animate-spin" size={26} style={{ color: COLORS.brass }} />
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.inkSoft }}>Apro il diario di bordo…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Search + filters */}
            {view !== "tasks" && (
              <div className="flex flex-col gap-3 mb-5">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cerca nelle voci del diario…"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13.5,
                      width: "100%",
                      padding: "9px 12px 9px 32px",
                      borderRadius: 5,
                      border: `1px solid ${COLORS.line}`,
                      background: "#fff",
                      color: COLORS.ink,
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={toggleAll}
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: COLORS.navy,
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                      padding: "4px 4px",
                    }}
                  >
                    {allOn ? "Deseleziona tutte" : "Seleziona tutte"}
                  </button>
                  {CATEGORIES.map((c) => (
                    <Pennant key={c.id} cat={c} active={activeCats.has(c.id)} onClick={() => toggleCat(c.id)} />
                  ))}
                </div>
              </div>
            )}

            {view === "tasks" ? (
              <TaskList tasks={tasks} onAdd={handleAddTask} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
            ) : view === "calendar" ? (
              <>
                <CalendarView
                  month={month}
                  setMonth={setMonth}
                  entries={filteredEntries}
                  onSelectDay={(iso) => setSelectedDay(iso === selectedDay ? null : iso)}
                  selectedISO={selectedDay}
                />
                {selectedDay && (
                  <DayPanel
                    iso={selectedDay}
                    entries={filteredEntries}
                    onNew={(iso) => {
                      pendingDate.current = iso;
                      setEditingEntry(null);
                      setShowForm(true);
                    }}
                    onEdit={openEdit}
                    onClose={() => setSelectedDay(null)}
                  />
                )}
                {!selectedDay && (
                  <button
                    onClick={() => {
                      pendingDate.current = todayISO();
                      setEditingEntry(null);
                      setShowForm(true);
                    }}
                    className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-sm"
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: "#fff", background: COLORS.brass }}
                  >
                    <Plus size={16} /> Nuova voce
                  </button>
                )}
              </>
            ) : (
              <div>
                <button
                  onClick={() => {
                    pendingDate.current = todayISO();
                    setEditingEntry(null);
                    setShowForm(true);
                  }}
                  className="mb-6 w-full flex items-center justify-center gap-2 py-3 rounded-sm"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: "#fff", background: COLORS.brass }}
                >
                  <Plus size={16} /> Nuova voce
                </button>

                {filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-2 py-16" style={{ color: COLORS.inkSoft }}>
                    <ImageOff size={26} style={{ opacity: 0.5 }} />
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
                      {entries.length === 0
                        ? "Il diario è ancora vuoto. Registra la prima voce di bordo."
                        : "Nessuna voce corrisponde ai filtri o alla ricerca."}
                    </p>
                  </div>
                ) : (
                  <div>
                    {filteredEntries.map((e) => (
                      <EntryCard key={e.id} entry={e} onEdit={openEdit} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-center mt-6" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.inkSoft, opacity: 0.7 }}>
              {entries.length} {entries.length === 1 ? "voce registrata" : "voci registrate"} · dati condivisi tra chi usa questo sito
              {saveError && <span style={{ color: "#C1483A" }}> · errore di connessione, riprova</span>}
            </p>
          </>
        )}
      </div>

      {showForm && (
        <EntryForm
          initial={editingEntry || (pendingDate.current ? { date: pendingDate.current } : null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setShowForm(false);
            setEditingEntry(null);
          }}
        />
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,36,54,0.55)" }}>
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: COLORS.ink }}>Cancellare tutti i dati?</h3>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.inkSoft, marginTop: 8 }}>
              Tutte le voci del diario, le foto e la lista annuale verranno eliminate per chiunque usi questo sito. L'operazione non è reversibile.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 rounded text-sm font-semibold"
                style={{ fontFamily: "'Inter', sans-serif", color: COLORS.inkSoft }}
              >
                Annulla
              </button>
              <button
                onClick={doReset}
                className="px-4 py-2 rounded text-sm font-semibold"
                style={{ fontFamily: "'Inter', sans-serif", color: "#fff", background: "#C1483A" }}
              >
                Cancella
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
