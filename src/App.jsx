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
  ChevronDown,
  Square,
  CheckSquare,
  Sailboat,
  FileText,
  Upload,
  MessageCircleQuestion,
  User,
  Anchor,
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
   Palette & type system
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

const S = {
  input: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 13.5,
    background: "#fff",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 4,
    padding: "8px 10px",
    color: COLORS.ink,
    width: "100%",
  },
  label: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11.5,
    fontWeight: 700,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 5,
    display: "block",
  },
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

const MANUAL_CATEGORIES = [
  { id: "manuale", label: "Manuale barca" },
  { id: "elettrico", label: "Schema elettrico" },
  { id: "idraulico", label: "Schema idraulico" },
  { id: "altro", label: "Altro documento" },
];

const DEFAULT_PROFILES = [
  { id: "p1", name: "Membro 1", color: "#B8863E" },
  { id: "p2", name: "Membro 2", color: "#3F6B8C" },
  { id: "p3", name: "Membro 3", color: "#5B7B54" },
  { id: "p4", name: "Membro 4", color: "#C1483A" },
];

// Punti dello schema barca (vista dall'alto) dove si agganciano cime e catena.
const RIGGING_CATEGORIES = [
  { id: "drizze", label: "Drizze" },
  { id: "scotte", label: "Scotte" },
  { id: "terzaroli", label: "Terzaroli" },
  { id: "dormeggio", label: "Cime di ormeggio" },
];
const MARKERS = [
  { id: "drizza_randa", label: "Drizza randa", category: "drizze" },
  { id: "drizza_genoa", label: "Drizza genoa / fiocco", category: "drizze" },
  { id: "scotta_genoa_sx", label: "Scotta genoa sinistra", category: "scotte" },
  { id: "scotta_genoa_dx", label: "Scotta genoa dritta", category: "scotte" },
  { id: "scotta_randa", label: "Scotta randa", category: "scotte" },
  { id: "terzarolo_1", label: "Terzarolo 1", category: "terzaroli" },
  { id: "terzarolo_2", label: "Terzarolo 2", category: "terzaroli" },
  { id: "ancora", label: "Catena / cima ancora", category: "dormeggio" },
  { id: "prua", label: "Cima di prua", category: "dormeggio" },
  { id: "traverso_sx", label: "Traverso sinistra", category: "dormeggio" },
  { id: "traverso_dx", label: "Traverso dritta", category: "dormeggio" },
  { id: "spring_sx", label: "Spring sinistra", category: "dormeggio" },
  { id: "spring_dx", label: "Spring dritta", category: "dormeggio" },
  { id: "poppa", label: "Cima di poppa", category: "dormeggio" },
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
  const dow = (d.getDay() + 6) % 7;
  return `${GIORNI_LUNGHI[dow]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
};

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

function AuthorTag({ name }) {
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: COLORS.inkSoft, opacity: 0.85 }}
    >
      <User size={10} /> {name}
    </span>
  );
}

/* ---------------------------------------------------------------
   Entry card (log view)
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
          style={{ width: 46, height: 46, background: COLORS.navy, border: `2px solid ${cat.color}`, color: COLORS.parchment }}
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
        style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}`, boxShadow: "0 1px 2px rgba(22,50,74,0.06)" }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={15} style={{ color: cat.color, flexShrink: 0 }} strokeWidth={2.25} />
            <h3 className="truncate" style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: COLORS.ink }}>
              {entry.title || cat.label}
            </h3>
          </div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, color: cat.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {cat.label}
          </span>
        </div>

        {entry.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.tags.map((t) => (
              <span key={t} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, padding: "1.5px 6px", borderRadius: 3, background: "rgba(22,50,74,0.06)", color: COLORS.inkSoft }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {entry.text && (
          <p className="mt-2 line-clamp-3" style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.inkSoft, lineHeight: 1.5 }}>
            {entry.text}
          </p>
        )}

        {entry.photos?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {entry.photos.slice(0, 4).map((p, i) => (
              <img key={i} src={p.url} alt="" className="rounded-sm object-cover flex-shrink-0" style={{ width: 52, height: 52, border: `1px solid ${COLORS.line}` }} />
            ))}
            {entry.photos.length > 4 && (
              <div className="flex items-center justify-center rounded-sm flex-shrink-0" style={{ width: 52, height: 52, background: "rgba(22,50,74,0.08)", color: COLORS.inkSoft, fontSize: 12, fontFamily: "'Inter', sans-serif" }}>
                +{entry.photos.length - 4}
              </div>
            )}
          </div>
        )}

        {entry.author && (
          <div className="mt-2">
            <AuthorTag name={entry.author} />
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
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, mIdx + 1, 0).getDate();

  const entriesByDay = useMemo(() => {
    const map = {};
    for (const e of entries) (map[e.date] ||= []).push(e);
    return map;
  }, [entries]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(new Date(year, mIdx - 1, 1))} className="p-2 rounded-full hover:bg-black/5" style={{ color: COLORS.navy }} aria-label="Mese precedente">
          <ChevronLeft size={18} />
        </button>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: COLORS.navy }}>
          {MESI[mIdx]} <span style={{ opacity: 0.55 }}>{year}</span>
        </h2>
        <button onClick={() => setMonth(new Date(year, mIdx + 1, 1))} className="p-2 rounded-full hover:bg-black/5" style={{ color: COLORS.navy }} aria-label="Mese successivo">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {GIORNI.map((g, i) => (
          <div key={i} className="text-center" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.inkSoft, padding: "4px 0" }}>
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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: isToday ? 700 : 500, color: COLORS.ink }}>{d}</span>
              <div className="flex gap-0.5 flex-wrap mt-auto pt-1">
                {cats.map((c) => (
                  <span key={c} style={{ width: 6, height: 6, borderRadius: "50%", background: catMap[c]?.color || COLORS.navy, display: "inline-block" }} />
                ))}
                {dayEntries.length > 4 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: COLORS.inkSoft }}>+{dayEntries.length - 4}</span>
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
   Day panel
--------------------------------------------------------------- */
function DayPanel({ iso, entries, onNew, onEdit, onClose }) {
  const dayEntries = entries.filter((e) => e.date === iso).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  return (
    <div className="mt-5 rounded-sm p-4" style={{ background: "rgba(22,50,74,0.04)", border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: COLORS.navy, textTransform: "capitalize" }}>{humanDate(iso)}</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5" style={{ color: COLORS.inkSoft }}>
          <X size={16} />
        </button>
      </div>

      {dayEntries.length === 0 && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.inkSoft }}>Nessuna voce in questa data. Aggiungi la prima annotazione della giornata.</p>
      )}

      <div className="flex flex-col gap-2">
        {dayEntries.map((e) => {
          const cat = catMap[e.category] || CATEGORIES[8];
          const Icon = cat.icon;
          return (
            <button key={e.id} onClick={() => onEdit(e)} className="flex items-center gap-2 text-left rounded-sm px-3 py-2" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
              <Icon size={14} style={{ color: cat.color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.ink, fontWeight: 600 }} className="truncate">
                {e.title || cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <button onClick={() => onNew(iso)} className="mt-3 flex items-center gap-1.5 text-sm font-semibold" style={{ color: COLORS.brass, fontFamily: "'Inter', sans-serif" }}>
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
  const [photos, setPhotos] = useState(initial?.photos || []);
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
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    await onSave({
      id: initial?.id || uid(),
      date,
      title: title.trim(),
      category,
      tags,
      text: text.trim(),
      photos,
      author: initial?.author,
      createdAt: initial?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(15,36,54,0.55)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-lg sm:rounded-lg" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: COLORS.navy, color: COLORS.parchment }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>{initial?.id ? "Modifica voce" : "Nuova voce di diario"}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label style={S.label}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Titolo</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Sostituito strallo di prua" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Categoria</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Pennant key={c.id} cat={c} active={category === c.id} onClick={() => setCategory(c.id)} />
              ))}
            </div>
          </div>
          <div>
            <label style={S.label}>Componenti / tag (separati da virgola)</label>
            <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Es. stralli, vele, parabordi" style={S.input} />
          </div>
          <div>
            <label style={S.label}>Annotazioni</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Descrivi cosa è successo, cosa è stato fatto, ricambi usati…" style={{ ...S.input, resize: "vertical" }} />
          </div>
          <div>
            <label style={S.label}>Foto ({photos.length}/6)</label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={p.path || i} className="relative">
                  <img src={p.url} alt="" className="rounded-sm object-cover" style={{ width: 64, height: 64, border: `1px solid ${COLORS.line}` }} />
                  <button onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center" style={{ width: 18, height: 18, background: COLORS.navy, color: "#fff" }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex flex-col items-center justify-center rounded-sm gap-1" style={{ width: 64, height: 64, border: `1px dashed ${COLORS.brass}`, color: COLORS.brass, background: "rgba(184,134,62,0.06)" }}>
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={17} />}
                  <span style={{ fontSize: 9.5, fontFamily: "'Inter', sans-serif" }}>{uploading ? "…" : "Aggiungi"}</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          {initial?.id ? (
            <button onClick={() => onDelete(initial.id)} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#C1483A", fontFamily: "'Inter', sans-serif" }}>
              <Trash2 size={15} /> Elimina
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif", color: COLORS.inkSoft, background: "transparent" }}>
              Annulla
            </button>
            <button onClick={save} disabled={saving || uploading} className="px-4 py-2 rounded text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif", color: "#fff", background: COLORS.brass, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Lista (annuale / stagione successiva) — riusabile
--------------------------------------------------------------- */
function TaskList({ tasks, onAdd, onToggle, onDelete, placeholder }) {
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

  return (
    <div>
      <div className="rounded-sm p-4 mb-6" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
        <label style={S.label}>Aggiungi cosa da fare</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={placeholder} style={{ ...S.input, flex: 1 }} />
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPriority(p.id)}
                style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600, padding: "6px 10px", borderRadius: 4,
                  border: `1px solid ${priority === p.id ? p.color : COLORS.line}`,
                  background: priority === p.id ? p.color : "transparent",
                  color: priority === p.id ? "#fff" : COLORS.inkSoft,
                  whiteSpace: "nowrap",
                }}
              >
                {p.label.replace("Priorità ", "")}
              </button>
            ))}
            <button onClick={add} className="flex items-center justify-center rounded-sm px-3" style={{ background: COLORS.brass, color: "#fff" }} aria-label="Aggiungi">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="flex flex-col items-center text-center gap-2 py-16" style={{ color: COLORS.inkSoft }}>
          <ListChecks size={26} style={{ opacity: 0.5 }} />
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14 }}>Nessuna voce in lista. Aggiungi le cose da fare, dalle più importanti alle meno urgenti.</p>
        </div>
      )}

      {groups.map(
        ({ prio, items }) =>
          items.length > 0 && (
            <div key={prio.id} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: prio.color, display: "inline-block" }} />
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 700, color: prio.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {prio.label} · {items.filter((t) => !t.done).length} da fare
                </h3>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-sm px-3 py-2.5" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}`, borderLeft: `3px solid ${prio.color}`, opacity: t.done ? 0.55 : 1 }}>
                    <button onClick={() => onToggle(t.id)} className="flex-shrink-0" style={{ color: t.done ? prio.color : COLORS.inkSoft }} aria-label="Segna come fatto">
                      {t.done ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.ink, textDecoration: t.done ? "line-through" : "none" }}>
                        {t.text}
                      </span>
                      {t.author && <AuthorTag name={t.author} />}
                    </div>
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
   Cime e catena — schema barca con marker interattivi
--------------------------------------------------------------- */
function RiggingCard({ marker, item, isOpen, onToggle, onSave }) {
  const [length, setLength] = useState(item?.length ?? "");
  const [changedDate, setChangedDate] = useState(item?.changedDate ?? "");
  const [ropeType, setRopeType] = useState(item?.ropeType ?? "");
  const [whipped, setWhipped] = useState(item?.whipped ?? "");

  const save = (overrides) =>
    onSave({ id: marker.id, markerId: marker.id, label: marker.label, length, changedDate, ropeType, whipped, ...overrides });

  return (
    <div className="rounded-sm overflow-hidden" style={{ background: COLORS.parchmentCard, border: `1px solid ${isOpen ? COLORS.brass : COLORS.line}` }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{marker.label}</span>
        <ChevronDown size={16} style={{ color: COLORS.inkSoft, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 flex flex-col gap-2.5" style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 10 }}>
          <div>
            <label style={{ ...S.label, marginBottom: 2 }}>Lunghezza (m)</label>
            <input value={length} onChange={(e) => setLength(e.target.value)} onBlur={() => save({ length })} style={S.input} inputMode="decimal" />
          </div>
          <div>
            <label style={{ ...S.label, marginBottom: 2 }}>Quando è stata cambiata</label>
            <input
              type="date"
              value={changedDate}
              onChange={(e) => {
                setChangedDate(e.target.value);
                save({ changedDate: e.target.value });
              }}
              style={S.input}
            />
          </div>
          <div>
            <label style={{ ...S.label, marginBottom: 2 }}>Tipo di cima</label>
            <input value={ropeType} onChange={(e) => setRopeType(e.target.value)} onBlur={() => save({ ropeType })} style={S.input} placeholder="Es. dyneema, poliestere, catena calibrata" />
          </div>
          <div>
            <label style={{ ...S.label, marginBottom: 2 }}>Piombatura</label>
            <div className="flex gap-1.5">
              {["Sì", "No"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setWhipped(opt);
                    save({ whipped: opt });
                  }}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "5px 14px",
                    borderRadius: 4,
                    border: `1px solid ${whipped === opt ? COLORS.brass : COLORS.line}`,
                    background: whipped === opt ? COLORS.brass : "transparent",
                    color: whipped === opt ? "#fff" : COLORS.inkSoft,
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function RiggingView({ items, onSaveItem, onDeleteExtra, onAddExtra }) {
  const [openId, setOpenId] = useState(null);
  const [extraText, setExtraText] = useState("");
  const extras = items.filter((it) => !it.markerId);

  return (
    <div>
      <img
        src="/schema-cime.png"
        alt="Schema cime e catena della barca"
        className="w-full rounded-sm mb-2"
        style={{ border: `1px solid ${COLORS.line}` }}
      />
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 12 }}>
        Tocca il nome di una voce qui sotto per aprire i dettagli.
      </p>

      {RIGGING_CATEGORIES.map((cat) => (
        <div key={cat.id} className="mt-6">
          <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: COLORS.navy, marginBottom: 8 }}>{cat.label}</h3>
          <div className="flex flex-col gap-2">
            {MARKERS.filter((m) => m.category === cat.id).map((m) => (
              <RiggingCard
                key={m.id}
                marker={m}
                item={items.find((it) => it.id === m.id)}
                isOpen={openId === m.id}
                onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                onSave={onSaveItem}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6">
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: COLORS.navy, marginBottom: 8 }}>Altre cime</h3>
        <div className="flex flex-col gap-1.5 mb-3">
          {extras.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
              <span className="flex-1 truncate" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.ink }}>
                {it.label} {it.length && `· ${it.length} m`} {it.ropeType && `· ${it.ropeType}`}
              </span>
              <button onClick={() => onDeleteExtra(it.id)} style={{ color: COLORS.inkSoft }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={extraText} onChange={(e) => setExtraText(e.target.value)} placeholder="Es. cima di rimorchio…" style={{ ...S.input, flex: 1 }} />
          <button
            onClick={() => {
              if (!extraText.trim()) return;
              onAddExtra({ id: uid(), markerId: null, label: extraText.trim(), length: "", changedDate: "", ropeType: "", whipped: "" });
              setExtraText("");
            }}
            className="flex items-center justify-center rounded-sm px-3"
            style={{ background: COLORS.brass, color: "#fff" }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Manuali — upload + domande all'AI
--------------------------------------------------------------- */
function ManualsView({ manuals, onUpload, onDelete }) {
  const [category, setCategory] = useState("manuale");
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState([]);
  const [askError, setAskError] = useState("");
  const fileRef = useRef(null);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      await onUpload(file, category);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || manuals.length === 0 || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const res = await fetch("/api/ask-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, manuals: manuals.map((m) => ({ name: m.name, url: m.url })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Errore nella richiesta");
      setHistory((h) => [{ question: q, answer: data.answer }, ...h]);
      setQuestion("");
    } catch (e) {
      setAskError(e.message || "Non sono riuscito a leggere i manuali. Riprova.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div>
      <div className="rounded-sm p-4 mb-6" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
        <label style={S.label}>Carica manuale o schema (PDF)</label>
        <div className="flex flex-wrap gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...S.input, width: "auto" }}>
            {MANUAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-sm px-3 py-2" style={{ background: COLORS.brass, color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600 }}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? "Carico…" : "Scegli file PDF"}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </div>
      </div>

      {manuals.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-10" style={{ color: COLORS.inkSoft }}>
          <FileText size={26} style={{ opacity: 0.5 }} />
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14 }}>Nessun manuale caricato ancora.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-6">
          {manuals.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
              <FileText size={15} style={{ color: COLORS.brass, flexShrink: 0 }} />
              <a href={m.url} target="_blank" rel="noreferrer" className="flex-1 truncate" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.ink, fontWeight: 600 }}>
                {m.name}
              </a>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: COLORS.inkSoft, textTransform: "uppercase" }}>
                {MANUAL_CATEGORIES.find((c) => c.id === m.category)?.label || "Documento"}
              </span>
              <button onClick={() => onDelete(m)} style={{ color: COLORS.inkSoft }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-sm p-4" style={{ background: "rgba(22,50,74,0.04)", border: `1px solid ${COLORS.line}` }}>
        <label style={S.label}>Chiedi aiuto sui manuali caricati</label>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={manuals.length === 0 ? "Carica prima almeno un manuale…" : "Es. Come faccio a resettare il quadro elettrico?"}
            disabled={manuals.length === 0}
            style={{ ...S.input, flex: 1 }}
          />
          <button onClick={ask} disabled={asking || manuals.length === 0} className="flex items-center gap-1.5 rounded-sm px-3" style={{ background: COLORS.brass, color: "#fff", opacity: asking ? 0.7 : 1 }}>
            {asking ? <Loader2 size={16} className="animate-spin" /> : <MessageCircleQuestion size={16} />}
          </button>
        </div>
        {askError && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "#C1483A", marginTop: 6 }}>{askError}</p>}

        <div className="flex flex-col gap-3 mt-4">
          {history.map((h, i) => (
            <div key={i} className="rounded-sm p-3" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: COLORS.navy }}>{h.question}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.ink, marginTop: 4, whiteSpace: "pre-wrap" }}>{h.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Selettore profilo
--------------------------------------------------------------- */
function ProfileModal({ profiles, currentId, onChoose, onRename, onClose, canClose }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,36,54,0.6)" }} onClick={() => canClose && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-sm p-5" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>Chi sei tu?</h3>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 14 }}>
          Scegli il tuo profilo, così sappiamo chi ha scritto ogni voce. Puoi rinominare i profili toccando la matita.
        </p>
        <div className="flex flex-col gap-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-sm px-3 py-2" style={{ border: `2px solid ${currentId === p.id ? p.color : COLORS.line}` }}>
              {editing === p.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    onRename(p.id, draft.trim() || p.name);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  style={{ ...S.input, flex: 1 }}
                />
              ) : (
                <button onClick={() => onChoose(p.id)} className="flex items-center gap-2 flex-1 text-left">
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, display: "inline-block" }} />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{p.name}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setEditing(p.id);
                  setDraft(p.name);
                }}
                style={{ color: COLORS.inkSoft }}
              >
                <Pencil size={13} />
              </button>
            </div>
          ))}
        </div>
        {canClose && (
          <button onClick={onClose} className="mt-4 text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif", color: COLORS.inkSoft }}>
            Chiudi
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   App
--------------------------------------------------------------- */
export default function DiarioDiBordo() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({ boatName: "Il mio veliero", profiles: DEFAULT_PROFILES, boatStatus: "acqua" });
  const [saveError, setSaveError] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [seasonTasks, setSeasonTasks] = useState([]);
  const [riggingItems, setRiggingItems] = useState([]);
  const [manuals, setManuals] = useState([]);

  const [view, setView] = useState("calendar");
  const [taskTab, setTaskTab] = useState("year");
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
  const [profileId, setProfileId] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem("diario:profileId") : null));
  const [showProfileModal, setShowProfileModal] = useState(false);
  const pendingDate = useRef(todayISO());

  const profiles = settings.profiles || DEFAULT_PROFILES;
  const currentProfile = profiles.find((p) => p.id === profileId);

  useEffect(() => {
    const unsubEntries = onSnapshot(collection(db, "entries"), (snap) => { setEntries(snap.docs.map((d) => d.data())); setLoading(false); }, () => { setLoading(false); setSaveError(true); });
    const unsubTasks = onSnapshot(collection(db, "tasks"), (snap) => setTasks(snap.docs.map((d) => d.data())));
    const unsubSeason = onSnapshot(collection(db, "season_tasks"), (snap) => setSeasonTasks(snap.docs.map((d) => d.data())));
    const unsubManuals = onSnapshot(collection(db, "manuals"), (snap) => setManuals(snap.docs.map((d) => d.data())));
    const unsubSettings = onSnapshot(doc(db, "settings", "config"), (snap) => {
      setSettings(snap.exists() ? { boatName: "Il mio veliero", profiles: DEFAULT_PROFILES, boatStatus: "acqua", ...snap.data() } : { boatName: "Il mio veliero", profiles: DEFAULT_PROFILES, boatStatus: "acqua" });
    });
    const unsubRigging = onSnapshot(doc(db, "rigging", "data"), (snap) => setRiggingItems(snap.exists() ? snap.data().items || [] : []));
    return () => { unsubEntries(); unsubTasks(); unsubSeason(); unsubManuals(); unsubSettings(); unsubRigging(); };
  }, []);

  useEffect(() => {
    if (!loading && !profileId) setShowProfileModal(true);
  }, [loading, profileId]);

  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    try {
      await setDoc(doc(db, "settings", "config"), next, { merge: true });
    } catch {
      setSaveError(true);
    }
  }, []);

  const chooseProfile = (id) => {
    setProfileId(id);
    window.localStorage.setItem("diario:profileId", id);
    setShowProfileModal(false);
  };
  const renameProfile = (id, name) => {
    const next = { ...settings, profiles: profiles.map((p) => (p.id === id ? { ...p, name } : p)) };
    persistSettings(next);
  };
  const toggleBoatStatus = () => persistSettings({ ...settings, boatStatus: settings.boatStatus === "acqua" ? "secca" : "acqua" });

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
      .filter((e) => !q || e.title?.toLowerCase().includes(q) || e.text?.toLowerCase().includes(q) || e.tags?.some((t) => t.toLowerCase().includes(q)))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
  }, [entries, activeCats, search]);

  const openEdit = (entry) => { setEditingEntry(entry); setShowForm(true); };
  const openNewAt = (iso) => { pendingDate.current = iso; setEditingEntry(null); setShowForm(true); };

  const handleSave = async (entry) => {
    const withAuthor = { ...entry, author: entry.author || currentProfile?.name || null };
    try { await setDoc(doc(db, "entries", entry.id), withAuthor); } catch (e) { console.error(e); setSaveError(true); }
    setShowForm(false); setEditingEntry(null);
  };
  const handleDelete = async (id) => {
    const entry = entries.find((e) => e.id === id);
    try {
      if (entry?.photos?.length) await Promise.all(entry.photos.map((p) => deleteObject(ref(storage, p.path)).catch(() => {})));
      await deleteDoc(doc(db, "entries", id));
    } catch (e) { console.error(e); setSaveError(true); }
    setShowForm(false); setEditingEntry(null);
  };

  const makeTaskHandlers = (collectionName, list) => ({
    onAdd: async (task) => { try { await setDoc(doc(db, collectionName, task.id), { ...task, author: currentProfile?.name || null }); } catch { setSaveError(true); } },
    onToggle: async (id) => { const t = list.find((x) => x.id === id); if (!t) return; try { await setDoc(doc(db, collectionName, id), { ...t, done: !t.done }); } catch { setSaveError(true); } },
    onDelete: async (id) => { try { await deleteDoc(doc(db, collectionName, id)); } catch { setSaveError(true); } },
  });
  const yearHandlers = makeTaskHandlers("tasks", tasks);
  const seasonHandlers = makeTaskHandlers("season_tasks", seasonTasks);

  const saveRiggingItem = async (item) => {
    const next = riggingItems.some((it) => it.id === item.id) ? riggingItems.map((it) => (it.id === item.id ? item : it)) : [...riggingItems, item];
    try { await setDoc(doc(db, "rigging", "data"), { items: next }); } catch { setSaveError(true); }
  };
  const deleteExtraRigging = async (id) => {
    const next = riggingItems.filter((it) => it.id !== id);
    try { await setDoc(doc(db, "rigging", "data"), { items: next }); } catch { setSaveError(true); }
  };

  const uploadManual = async (file, category) => {
    const path = `manuals/${uid()}.pdf`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    const id = uid();
    await setDoc(doc(db, "manuals", id), { id, name: file.name, category, url, path, uploadedAt: new Date().toISOString() });
  };
  const deleteManual = async (m) => {
    try {
      await deleteObject(ref(storage, m.path)).catch(() => {});
      await deleteDoc(doc(db, "manuals", m.id));
    } catch { setSaveError(true); }
  };

  const doReset = async () => {
    try {
      await Promise.all(entries.flatMap((e) => (e.photos || []).map((p) => deleteObject(ref(storage, p.path)).catch(() => {}))));
      await Promise.all(entries.map((e) => deleteDoc(doc(db, "entries", e.id))));
      await Promise.all(tasks.map((t) => deleteDoc(doc(db, "tasks", t.id))));
      await Promise.all(seasonTasks.map((t) => deleteDoc(doc(db, "season_tasks", t.id))));
      await Promise.all(manuals.map((m) => deleteManual(m)));
      await setDoc(doc(db, "rigging", "data"), { items: [] });
    } catch { setSaveError(true); }
    setConfirmReset(false); setShowSettingsMenu(false);
  };

  const TABS = [
    { id: "calendar", label: "Calendario", icon: CalendarIcon },
    { id: "list", label: "Registro", icon: ListIcon },
    { id: "tasks", label: "Lista", icon: ListChecks },
    { id: "rigging", label: "Cime & catena", icon: Sailboat },
    { id: "manuals", label: "Manuali", icon: FileText },
  ];

  return (
    <div className="w-full min-h-full" style={{ background: COLORS.parchment }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.2); }
      `}</style>

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
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: COLORS.brassSoft, letterSpacing: "0.08em", textTransform: "uppercase" }}>Diario di bordo</p>
                {editingName ? (
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => { persistSettings({ ...settings, boatName: nameDraft.trim() || settings.boatName }); setEditingName(false); }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, background: "transparent", color: COLORS.parchment, border: "none", borderBottom: `1px solid ${COLORS.brassSoft}`, outline: "none", width: "100%" }}
                  />
                ) : (
                  <button onClick={() => { setNameDraft(settings.boatName); setEditingName(true); }} className="flex items-center gap-2 truncate">
                    <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, color: COLORS.parchment }} className="truncate">{settings.boatName}</h1>
                    <Pencil size={12} style={{ color: COLORS.brassSoft, flexShrink: 0 }} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={toggleBoatStatus}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ background: "rgba(255,255,255,0.08)" }}
                title="Tocca per cambiare stato"
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: settings.boatStatus === "acqua" ? "#5B9C6E" : "#D9A441", display: "inline-block" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600, color: COLORS.parchment }}>
                  {settings.boatStatus === "acqua" ? "In acqua" : "In secca"}
                </span>
              </button>

              <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-1.5 rounded-full px-2 py-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: currentProfile?.color || COLORS.brassSoft, display: "inline-block" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 600, color: COLORS.parchment }}>{currentProfile?.name || "Chi sei?"}</span>
              </button>

              <div className="relative">
                <button onClick={() => setShowSettingsMenu((s) => !s)} className="p-2 rounded-full hover:bg-white/10" style={{ color: COLORS.parchment }} aria-label="Impostazioni">
                  <Settings size={18} />
                </button>
                {showSettingsMenu && (
                  <div className="absolute right-0 top-11 z-40 rounded-sm overflow-hidden" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}`, minWidth: 200 }}>
                    <button onClick={() => setConfirmReset(true)} className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-black/5" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#C1483A" }}>
                      <Trash2 size={14} /> Cancella tutti i dati
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-1 mt-5 p-1 rounded-md w-fit flex-wrap" style={{ background: "rgba(255,255,255,0.08)" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded"
                style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, background: view === t.id ? COLORS.brass : "transparent", color: view === t.id ? "#fff" : COLORS.parchment }}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="animate-spin" size={26} style={{ color: COLORS.brass }} />
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: COLORS.inkSoft }}>Apro il diario di bordo…</p>
          </div>
        ) : (
          <>
            {(view === "calendar" || view === "list") && (
              <div className="flex flex-col gap-3 mb-5">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca nelle voci del diario…" style={{ ...S.input, padding: "9px 12px 9px 32px" }} />
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button onClick={toggleAll} style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, fontWeight: 700, color: COLORS.navy, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    {allOn ? "Deseleziona tutte" : "Seleziona tutte"}
                  </button>
                  {CATEGORIES.map((c) => (
                    <Pennant key={c.id} cat={c} active={activeCats.has(c.id)} onClick={() => toggleCat(c.id)} />
                  ))}
                </div>
              </div>
            )}

            {view === "calendar" && (
              <>
                <CalendarView month={month} setMonth={setMonth} entries={filteredEntries} onSelectDay={(iso) => setSelectedDay(iso === selectedDay ? null : iso)} selectedISO={selectedDay} />
                {selectedDay ? (
                  <DayPanel iso={selectedDay} entries={filteredEntries} onNew={openNewAt} onEdit={openEdit} onClose={() => setSelectedDay(null)} />
                ) : (
                  <button onClick={() => openNewAt(todayISO())} className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-sm" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: "#fff", background: COLORS.brass }}>
                    <Plus size={16} /> Nuova voce
                  </button>
                )}
              </>
            )}

            {view === "list" && (
              <div>
                <button onClick={() => openNewAt(todayISO())} className="mb-6 w-full flex items-center justify-center gap-2 py-3 rounded-sm" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: "#fff", background: COLORS.brass }}>
                  <Plus size={16} /> Nuova voce
                </button>
                {filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-2 py-16" style={{ color: COLORS.inkSoft }}>
                    <ImageOff size={26} style={{ opacity: 0.5 }} />
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14 }}>
                      {entries.length === 0 ? "Il diario è ancora vuoto. Registra la prima voce di bordo." : "Nessuna voce corrisponde ai filtri o alla ricerca."}
                    </p>
                  </div>
                ) : (
                  <div>{filteredEntries.map((e) => <EntryCard key={e.id} entry={e} onEdit={openEdit} />)}</div>
                )}
              </div>
            )}

            {view === "tasks" && (
              <div>
                <div className="flex gap-1 mb-5 p-1 rounded-md w-fit" style={{ background: "rgba(22,50,74,0.06)" }}>
                  <button onClick={() => setTaskTab("year")} className="px-3.5 py-1.5 rounded" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, background: taskTab === "year" ? COLORS.navy : "transparent", color: taskTab === "year" ? "#fff" : COLORS.navy }}>
                    Quest'anno
                  </button>
                  <button onClick={() => setTaskTab("season")} className="px-3.5 py-1.5 rounded" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, background: taskTab === "season" ? COLORS.navy : "transparent", color: taskTab === "season" ? "#fff" : COLORS.navy }}>
                    Stagione successiva
                  </button>
                </div>
                {taskTab === "year" ? (
                  <TaskList tasks={tasks} {...yearHandlers} placeholder="Es. Revisione motore, cambio zinchi…" />
                ) : (
                  <TaskList tasks={seasonTasks} {...seasonHandlers} placeholder="Es. Rifare l'antivegetativa, cambiare le cime…" />
                )}
              </div>
            )}

            {view === "rigging" && (
              <RiggingView items={riggingItems} onSaveItem={saveRiggingItem} onDeleteExtra={deleteExtraRigging} onAddExtra={saveRiggingItem} />
            )}

            {view === "manuals" && <ManualsView manuals={manuals} onUpload={uploadManual} onDelete={deleteManual} />}

            <p className="text-center mt-6" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.inkSoft, opacity: 0.7 }}>
              {entries.length} {entries.length === 1 ? "voce registrata" : "voci registrate"} · dati condivisi tra chi usa questo sito
              {saveError && <span style={{ color: "#C1483A" }}> · errore di connessione, riprova</span>}
            </p>
          </>
        )}
      </div>

      {showForm && (
        <EntryForm
          initial={editingEntry || { date: pendingDate.current }}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowForm(false); setEditingEntry(null); }}
        />
      )}

      {showProfileModal && (
        <ProfileModal profiles={profiles} currentId={profileId} onChoose={chooseProfile} onRename={renameProfile} onClose={() => setShowProfileModal(false)} canClose={!!profileId} />
      )}

      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,36,54,0.55)" }}>
          <div className="w-full max-w-sm rounded-sm p-5" style={{ background: COLORS.parchmentCard, border: `1px solid ${COLORS.line}` }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: COLORS.ink }}>Cancellare tutti i dati?</h3>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: COLORS.inkSoft, marginTop: 8 }}>
              Voci, foto, liste, cime/catena e manuali verranno eliminati per chiunque usi questo sito. L'operazione non è reversibile.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmReset(false)} className="px-4 py-2 rounded text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif", color: COLORS.inkSoft }}>Annulla</button>
              <button onClick={doReset} className="px-4 py-2 rounded text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif", color: "#fff", background: "#C1483A" }}>Cancella</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
