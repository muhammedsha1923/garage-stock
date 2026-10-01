import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Package, ArrowRightLeft, FileBarChart, Plus, Search,
  Pencil, Trash2, ArrowUp, ArrowDown, X, AlertTriangle, Printer,
  ChevronDown, Gauge as GaugeIcon
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const CATEGORIES = [
  "Engine", "Brakes", "Electrical", "Suspension", "Transmission",
  "Body Parts", "Filters", "Tyres & Tubes", "Lubricants", "Accessories", "Other"
];

const COLORS = {
  bg: "#15181B",
  panel: "#1D2124",
  panel2: "#262B2F",
  border: "#34393E",
  borderSoft: "#282D31",
  text: "#ECEDEA",
  textDim: "#9AA1A6",
  textFaint: "#6B7378",
  amber: "#F2A93B",
  amberDim: "#8A611F",
  steel: "#5FA3BD",
  red: "#E2574C",
  green: "#6FBE72",
};

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ---------- storage ----------
async function loadParts() {
  try {
    const res = await window.storage.get("garage-parts", false);
    return res ? JSON.parse(res.value) : [];
  } catch {
    return [];
  }
}
async function saveParts(parts) {
  try { await window.storage.set("garage-parts", JSON.stringify(parts), false); }
  catch (e) { console.error("save parts failed", e); }
}
async function loadTx() {
  try {
    const res = await window.storage.get("garage-transactions", false);
    return res ? JSON.parse(res.value) : [];
  } catch {
    return [];
  }
}
async function saveTx(tx) {
  try { await window.storage.set("garage-transactions", JSON.stringify(tx), false); }
  catch (e) { console.error("save tx failed", e); }
}

// ---------- small UI atoms ----------
function Badge({ children, tone = "steel" }) {
  const map = {
    steel: { bg: "#1E3038", fg: COLORS.steel },
    amber: { bg: "#3A2C10", fg: COLORS.amber },
    red: { bg: "#3A1D1A", fg: COLORS.red },
    green: { bg: "#1C3320", fg: COLORS.green },
    gray: { bg: COLORS.panel2, fg: COLORS.textDim },
  };
  const c = map[tone] || map.gray;
  return (
    <span style={{
      background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700,
      padding: "3px 8px", borderRadius: 4, letterSpacing: 0.4, textTransform: "uppercase"
    }}>{children}</span>
  );
}

function StockGaugeBar({ qty, min }) {
  const max = Math.max(min * 2, qty, 1);
  const pct = Math.min(100, (qty / max) * 100);
  let color = COLORS.green;
  if (qty <= min) color = COLORS.red;
  else if (qty <= min * 1.5) color = COLORS.amber;
  return (
    <div style={{ width: 84 }}>
      <div style={{ height: 6, background: COLORS.panel2, borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
        {min > 0 && (
          <div style={{
            position: "absolute", left: `${Math.min(100, (min / max) * 100)}%`,
            top: -2, width: 2, height: 10, background: COLORS.textFaint
          }} />
        )}
      </div>
    </div>
  );
}

// Big radial fuel-style gauge for dashboard overall health
function HealthGauge({ pct }) {
  const size = 180;
  const cx = size / 2, cy = size / 2 + 10, r = 78;
  const startAngle = 200, endAngle = -20; // degrees, sweep 220deg
  const toRad = (deg) => (deg * Math.PI) / 180;
  const point = (angleDeg, radius) => {
    const a = toRad(angleDeg);
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
  };
  const arcPath = (a1, a2, radius) => {
    const [x1, y1] = point(a1, radius);
    const [x2, y2] = point(a2, radius);
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 0 ${x2} ${y2}`;
  };
  const sweep = startAngle - endAngle;
  const needleAngle = startAngle - (pct / 100) * sweep;
  const [nx, ny] = point(needleAngle, r - 14);
  let color = COLORS.green;
  if (pct < 40) color = COLORS.red;
  else if (pct < 70) color = COLORS.amber;

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
      <path d={arcPath(startAngle, endAngle, r)} stroke={COLORS.panel2} strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d={arcPath(startAngle, startAngle - (pct / 100) * sweep, r)} stroke={color} strokeWidth={14} fill="none" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={COLORS.text} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill={COLORS.text} />
      <text x={cx} y={cy - 34} textAnchor="middle" fontSize={26} fontWeight={700} fill={COLORS.text} fontFamily="Oswald, sans-serif">
        {Math.round(pct)}%
      </text>
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={11} fill={COLORS.textDim} letterSpacing="1">
        STOCK HEALTH
      </text>
    </svg>
  );
}

function StatCard({ label, value, sub, tone }) {
  const fg = tone === "red" ? COLORS.red : tone === "amber" ? COLORS.amber : COLORS.text;
  return (
    <div style={{
      background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10,
      padding: "14px 16px", flex: 1, minWidth: 140
    }}>
      <div style={{ fontSize: 11, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: fg, fontFamily: "Oswald, sans-serif", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Btn({ children, onClick, variant = "ghost", style, type = "button", disabled }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
    padding: "8px 14px", borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent", opacity: disabled ? 0.5 : 1, transition: "opacity .15s",
    fontFamily: "Inter, sans-serif"
  };
  const variants = {
    primary: { background: COLORS.amber, color: "#1A1300", border: `1px solid ${COLORS.amber}` },
    steel: { background: COLORS.steel, color: "#06202A", border: `1px solid ${COLORS.steel}` },
    ghost: { background: "transparent", color: COLORS.text, border: `1px solid ${COLORS.border}` },
    danger: { background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.red}` },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%", background: COLORS.panel2, border: `1px solid ${COLORS.border}`,
  borderRadius: 6, padding: "9px 10px", color: COLORS.text, fontSize: 13.5,
  fontFamily: "Inter, sans-serif", outline: "none", boxSizing: "border-box"
};

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16
    }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 12,
        width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1px solid ${COLORS.borderSoft}`, position: "sticky", top: 0,
          background: COLORS.panel, borderRadius: "12px 12px 0 0"
        }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: 0.3 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- Part Form ----------
function PartForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: "", partNumber: "", category: CATEGORIES[0], compatibleModels: "",
    quantity: 0, minStock: 5, unitPrice: 0, supplier: "", location: ""
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...form,
      quantity: Number(form.quantity) || 0,
      minStock: Number(form.minStock) || 0,
      unitPrice: Number(form.unitPrice) || 0,
    });
  };

  return (
    <form onSubmit={submit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Field label="Part name">
          <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Front brake pad set" required />
        </Field>
        <Field label="Part number / SKU">
          <input style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }} value={form.partNumber} onChange={(e) => set("partNumber", e.target.value)} placeholder="BRK-0142" />
        </Field>
        <Field label="Category">
          <select style={inputStyle} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Compatible models">
          <input style={inputStyle} value={form.compatibleModels} onChange={(e) => set("compatibleModels", e.target.value)} placeholder="Splendor, Passion Pro" />
        </Field>
        <Field label="Quantity in stock">
          <input type="number" min="0" style={inputStyle} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </Field>
        <Field label="Reorder level (min stock)">
          <input type="number" min="0" style={inputStyle} value={form.minStock} onChange={(e) => set("minStock", e.target.value)} />
        </Field>
        <Field label="Unit price (₹)">
          <input type="number" min="0" style={inputStyle} value={form.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} />
        </Field>
        <Field label="Shelf / rack location">
          <input style={inputStyle} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Rack B-3" />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Supplier">
            <input style={inputStyle} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Sri Balaji Auto Parts" />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" type="submit">Save part</Btn>
      </div>
    </form>
  );
}

// ---------- Stock Adjust Modal ----------
function StockAdjustForm({ part, type, onSubmit, onCancel }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const q = Number(qty);
    if (!q || q <= 0) return;
    if (type === "OUT" && q > part.quantity) return;
    onSubmit(q, note);
  };
  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 14, padding: "10px 12px", background: COLORS.panel2, borderRadius: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{part.name}</div>
        <div style={{ fontSize: 12, color: COLORS.textDim, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>
          {part.partNumber || "—"} · Current stock: {part.quantity}
        </div>
      </div>
      <Field label={type === "IN" ? "Quantity received" : "Quantity issued"}>
        <input type="number" min="1" max={type === "OUT" ? part.quantity : undefined} style={inputStyle} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      </Field>
      {type === "OUT" && Number(qty) > part.quantity && (
        <div style={{ color: COLORS.red, fontSize: 12, marginTop: -8, marginBottom: 10 }}>Only {part.quantity} in stock.</div>
      )}
      <Field label="Note (optional)">
        <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "IN" ? "Purchased from supplier" : "Sold to customer"} />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant={type === "IN" ? "steel" : "primary"} type="submit">
          {type === "IN" ? "Record stock in" : "Record stock out"}
        </Btn>
      </div>
    </form>
  );
}

// ---------- Main App ----------
export default function App() {
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [tx, setTx] = useState([]);
  const [tab, setTab] = useState("dashboard");

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const [partModal, setPartModal] = useState(null); // null | {} (new) | part (edit)
  const [stockModal, setStockModal] = useState(null); // {part, type}
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [reportPeriod, setReportPeriod] = useState("daily");

  useEffect(() => {
    (async () => {
      const [p, t] = await Promise.all([loadParts(), loadTx()]);
      setParts(p);
      setTx(t);
      setLoading(false);
    })();
  }, []);

  const persistParts = useCallback((next) => { setParts(next); saveParts(next); }, []);
  const persistTx = useCallback((next) => { setTx(next); saveTx(next); }, []);

  const handleSavePart = (form) => {
    if (form.id) {
      const next = parts.map((p) => (p.id === form.id ? { ...form, updatedAt: new Date().toISOString() } : p));
      persistParts(next);
    } else {
      const newPart = { ...form, id: uid("part"), updatedAt: new Date().toISOString() };
      const next = [newPart, ...parts];
      persistParts(next);
      if (newPart.quantity > 0) {
        const t = {
          id: uid("tx"), partId: newPart.id, partName: newPart.name, type: "IN",
          quantity: newPart.quantity, note: "Initial stock", date: new Date().toISOString(),
          balanceAfter: newPart.quantity, unitPrice: newPart.unitPrice
        };
        persistTx([t, ...tx]);
      }
    }
    setPartModal(null);
  };

  const handleDeletePart = (id) => {
    persistParts(parts.filter((p) => p.id !== id));
    setConfirmDelete(null);
  };

  const handleStockAdjust = (qty, note) => {
    const { part, type } = stockModal;
    const delta = type === "IN" ? qty : -qty;
    const newQty = Math.max(0, part.quantity + delta);
    const nextParts = parts.map((p) => (p.id === part.id ? { ...p, quantity: newQty, updatedAt: new Date().toISOString() } : p));
    persistParts(nextParts);
    const t = {
      id: uid("tx"), partId: part.id, partName: part.name, type, quantity: qty,
      note: note || (type === "IN" ? "Stock received" : "Stock issued"),
      date: new Date().toISOString(), balanceAfter: newQty, unitPrice: part.unitPrice
    };
    persistTx([t, ...tx]);
    setStockModal(null);
  };

  const lowStock = useMemo(() => parts.filter((p) => p.quantity <= p.minStock), [parts]);
  const totalUnits = useMemo(() => parts.reduce((s, p) => s + p.quantity, 0), [parts]);
  const totalValue = useMemo(() => parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0), [parts]);
  const healthPct = parts.length ? ((parts.length - lowStock.length) / parts.length) * 100 : 100;

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.partNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.compatibleModels || "").toLowerCase().includes(search.toLowerCase());
      const matchesCat = catFilter === "All" || p.category === catFilter;
      return matchesSearch && matchesCat;
    });
  }, [parts, search, catFilter]);

  const recentTx = tx.slice(0, 8);

  // ----- report calculations -----
  const reportRange = useMemo(() => {
    const now = new Date();
    let start;
    if (reportPeriod === "daily") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (reportPeriod === "weekly") {
      start = new Date(now); start.setDate(now.getDate() - 6);
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start, end: now };
  }, [reportPeriod]);

  const reportTx = useMemo(() => {
    return tx.filter((t) => new Date(t.date) >= reportRange.start && new Date(t.date) <= reportRange.end);
  }, [tx, reportRange]);

  const reportSummary = useMemo(() => {
    const map = {};
    let totalIn = 0, totalOut = 0, valueIn = 0, valueOut = 0;
    reportTx.forEach((t) => {
      if (!map[t.partId]) map[t.partId] = { name: t.partName, in: 0, out: 0 };
      if (t.type === "IN") { map[t.partId].in += t.quantity; totalIn += t.quantity; valueIn += t.quantity * (t.unitPrice || 0); }
      else { map[t.partId].out += t.quantity; totalOut += t.quantity; valueOut += t.quantity * (t.unitPrice || 0); }
    });
    return { rows: Object.values(map), totalIn, totalOut, valueIn, valueOut };
  }, [reportTx]);

  const chartData = reportSummary.rows.slice(0, 10).map((r) => ({ name: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name, In: r.in, Out: r.out }));

  const periodLabel = reportPeriod === "daily" ? "Today" : reportPeriod === "weekly" ? "Last 7 days" : "This month";

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: COLORS.textDim, fontFamily: "Inter, sans-serif" }}>
        Loading inventory…
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "log", label: "Stock log", icon: ArrowRightLeft },
    { id: "reports", label: "Reports", icon: FileBarChart },
  ];

  return (
    <div style={{
      fontFamily: "Inter, sans-serif", background: COLORS.bg, color: COLORS.text,
      borderRadius: 14, border: `1px solid ${COLORS.borderSoft}`, overflow: "hidden",
      display: "flex", minHeight: 640
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: ${COLORS.amber} !important; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: ${COLORS.textFaint}; padding: 8px 10px; border-bottom: 1px solid ${COLORS.borderSoft}; font-weight: 600; }
        td { padding: 10px; border-bottom: 1px solid ${COLORS.borderSoft}; font-size: 13.5px; vertical-align: middle; }
        tr:hover td { background: rgba(255,255,255,0.015); }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        .navitem { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; cursor:pointer; font-size:13.5px; font-weight:600; color:${COLORS.textDim}; }
        .navitem:hover { background: ${COLORS.panel2}; color: ${COLORS.text}; }
        .navitem.active { background: rgba(242,169,59,0.12); color: ${COLORS.amber}; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 210, background: COLORS.panel, borderRight: `1px solid ${COLORS.borderSoft}`, padding: 16, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 20px" }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.amber, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GaugeIcon size={17} color="#1A1300" />
          </div>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 0.3, lineHeight: 1 }}>GARAGE STOCK</div>
            <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 2 }}>2-wheeler spares</div>
          </div>
        </div>
        {NAV.map((n) => (
          <div key={n.id} className={`navitem ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
            <n.icon size={16} /> {n.label}
            {n.id === "dashboard" && lowStock.length > 0 && (
              <span style={{ marginLeft: "auto", background: COLORS.red, color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>{lowStock.length}</span>
            )}
          </div>
        ))}
        <div style={{ marginTop: "auto", padding: "10px 6px", fontSize: 11, color: COLORS.textFaint, borderTop: `1px solid ${COLORS.borderSoft}` }}>
          {parts.length} parts tracked
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto", minWidth: 0 }}>

        {tab === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 600 }}>Dashboard</div>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2 }}>Overview of your spare parts stock</div>
              </div>
              <Btn variant="primary" onClick={() => setPartModal({})}><Plus size={15} /> Add part</Btn>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
                <HealthGauge pct={healthPct} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <StatCard label="Total parts" value={parts.length} />
                  <StatCard label="Total units in stock" value={totalUnits.toLocaleString("en-IN")} />
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <StatCard label="Inventory value" value={fmtMoney(totalValue)} />
                  <StatCard label="Low stock alerts" value={lowStock.length} tone={lowStock.length ? "red" : undefined} />
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <AlertTriangle size={16} color={COLORS.red} />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Low stock — needs reorder</div>
                </div>
                {lowStock.length === 0 ? (
                  <div style={{ color: COLORS.textFaint, fontSize: 13, padding: "16px 0" }}>Nothing below reorder level. Stock looks healthy.</div>
                ) : (
                  <div>
                    {lowStock.map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: COLORS.textFaint, fontFamily: "JetBrains Mono, monospace" }}>{p.partNumber || "—"} · {p.category}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Badge tone={p.quantity === 0 ? "red" : "amber"}>{p.quantity} / min {p.minStock}</Badge>
                          <Btn variant="steel" onClick={() => setStockModal({ part: p, type: "IN" })}><ArrowDown size={13} /> Restock</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Recent activity</div>
                {recentTx.length === 0 ? (
                  <div style={{ color: COLORS.textFaint, fontSize: 13, padding: "16px 0" }}>No stock movements recorded yet.</div>
                ) : recentTx.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${COLORS.borderSoft}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.partName}</div>
                      <div style={{ fontSize: 11, color: COLORS.textFaint }}>{fmtDateTime(t.date)} · {t.note}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: t.type === "IN" ? COLORS.green : COLORS.red, fontWeight: 700, fontSize: 13 }}>
                      {t.type === "IN" ? <ArrowDown size={13} /> : <ArrowUp size={13} />} {t.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 600 }}>Inventory</div>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2 }}>{filteredParts.length} of {parts.length} parts</div>
              </div>
              <Btn variant="primary" onClick={() => setPartModal({})}><Plus size={15} /> Add part</Btn>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <Search size={14} color={COLORS.textFaint} style={{ position: "absolute", left: 10, top: 10 }} />
                <input style={{ ...inputStyle, paddingLeft: 30 }} placeholder="Search name, part number, model…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select style={{ ...inputStyle, width: 170 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="All">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, overflow: "hidden" }}>
              {filteredParts.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textFaint, fontSize: 13.5 }}>
                  {parts.length === 0 ? "No parts yet. Add your first spare part to start tracking stock." : "No parts match your search."}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Part</th><th>Category</th><th>Stock</th><th>Level</th><th>Unit price</th><th>Location</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParts.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: COLORS.textFaint, fontFamily: "JetBrains Mono, monospace" }}>{p.partNumber || "—"}</div>
                          </td>
                          <td><Badge tone="gray">{p.category}</Badge></td>
                          <td>
                            <span style={{ fontWeight: 700, color: p.quantity <= p.minStock ? COLORS.red : COLORS.text }}>{p.quantity}</span>
                            <span style={{ color: COLORS.textFaint }}> / min {p.minStock}</span>
                          </td>
                          <td><StockGaugeBar qty={p.quantity} min={p.minStock} /></td>
                          <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{fmtMoney(p.unitPrice)}</td>
                          <td style={{ color: COLORS.textDim }}>{p.location || "—"}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button title="Stock in" onClick={() => setStockModal({ part: p, type: "IN" })} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6, cursor: "pointer", color: COLORS.green }}><ArrowDown size={14} /></button>
                              <button title="Stock out" onClick={() => setStockModal({ part: p, type: "OUT" })} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6, cursor: "pointer", color: COLORS.red }}><ArrowUp size={14} /></button>
                              <button title="Edit" onClick={() => setPartModal(p)} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6, cursor: "pointer", color: COLORS.textDim }}><Pencil size={14} /></button>
                              <button title="Delete" onClick={() => setConfirmDelete(p)} style={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6, cursor: "pointer", color: COLORS.textDim }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 600, marginBottom: 2 }}>Stock log</div>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16 }}>Full history of stock movements</div>
            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, overflow: "hidden" }}>
              {tx.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textFaint, fontSize: 13.5 }}>No transactions yet.</div>
              ) : (
                <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Part</th><th>Type</th><th>Qty</th><th>Balance after</th><th>Note</th></tr>
                    </thead>
                    <tbody>
                      {tx.map((t) => (
                        <tr key={t.id}>
                          <td style={{ color: COLORS.textDim, whiteSpace: "nowrap" }}>{fmtDateTime(t.date)}</td>
                          <td style={{ fontWeight: 600 }}>{t.partName}</td>
                          <td><Badge tone={t.type === "IN" ? "green" : "red"}>{t.type === "IN" ? "Stock in" : "Stock out"}</Badge></td>
                          <td style={{ fontWeight: 700 }}>{t.quantity}</td>
                          <td style={{ fontFamily: "JetBrains Mono, monospace" }}>{t.balanceAfter}</td>
                          <td style={{ color: COLORS.textDim }}>{t.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 600 }}>Reports</div>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 2 }}>Stock movement summary — {periodLabel.toLowerCase()}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ display: "flex", background: COLORS.panel2, borderRadius: 7, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                  {[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(([id, label]) => (
                    <button key={id} onClick={() => setReportPeriod(id)} style={{
                      padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                      background: reportPeriod === id ? COLORS.amber : "transparent",
                      color: reportPeriod === id ? "#1A1300" : COLORS.textDim
                    }}>{label}</button>
                  ))}
                </div>
                <Btn variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print</Btn>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <StatCard label="Stock in (units)" value={reportSummary.totalIn} sub={fmtMoney(reportSummary.valueIn)} />
              <StatCard label="Stock out (units)" value={reportSummary.totalOut} sub={fmtMoney(reportSummary.valueOut)} />
              <StatCard label="Net change" value={reportSummary.totalIn - reportSummary.totalOut} />
              <StatCard label="Transactions" value={reportTx.length} />
            </div>

            {chartData.length > 0 && (
              <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 16, marginBottom: 16, height: 280 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Movement by part</div>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.borderSoft} />
                    <XAxis dataKey="name" tick={{ fill: COLORS.textDim, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: COLORS.textDim, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="In" fill={COLORS.green} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Out" fill={COLORS.red} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, overflow: "hidden" }}>
              {reportSummary.rows.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.textFaint, fontSize: 13.5 }}>No stock movement in this period.</div>
              ) : (
                <table>
                  <thead><tr><th>Part</th><th>Stock in</th><th>Stock out</th><th>Net</th></tr></thead>
                  <tbody>
                    {reportSummary.rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td style={{ color: COLORS.green }}>{r.in > 0 ? `+${r.in}` : "—"}</td>
                        <td style={{ color: COLORS.red }}>{r.out > 0 ? `-${r.out}` : "—"}</td>
                        <td style={{ fontWeight: 700 }}>{r.in - r.out}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {partModal !== null && (
        <Modal title={partModal.id ? "Edit part" : "Add spare part"} onClose={() => setPartModal(null)}>
          <PartForm initial={partModal.id ? partModal : null} onSave={handleSavePart} onCancel={() => setPartModal(null)} />
        </Modal>
      )}

      {stockModal && (
        <Modal title={stockModal.type === "IN" ? "Stock in" : "Stock out"} onClose={() => setStockModal(null)} width={400}>
          <StockAdjustForm part={stockModal.part} type={stockModal.type} onSubmit={handleStockAdjust} onCancel={() => setStockModal(null)} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete part" onClose={() => setConfirmDelete(null)} width={380}>
          <div style={{ fontSize: 13.5, color: COLORS.textDim, marginBottom: 18 }}>
            Remove <strong style={{ color: COLORS.text }}>{confirmDelete.name}</strong> from inventory? This won't delete its past transaction history.
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => handleDeletePart(confirmDelete.id)}>Delete part</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
