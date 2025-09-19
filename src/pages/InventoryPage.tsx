// src/pages/InventoryPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Plus, Pencil, Trash2, Download, RefreshCw, QrCode, UploadCloud, Search
} from "lucide-react";

// ใช้เฉพาะคอมโพเนนต์ที่โปรเจกต์มีอยู่จริง
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

/* ================= types ================= */
export type Status = "active" | "in_repair" | "retired" | "lost";
export type Device = {
  id: string;
  asset_tag: string;
  serial_no: string;
  device_type_id?: number | null;
  model?: string | null;
  brand?: string | null;
  status: Status;
  last_seen?: string | null;
  department_id?: number | null;
  deleted_at?: string | null;
};
export type Department = { id: number; name: string; code?: string | null };

/* ================= helpers ================= */
const LOGO_SRC = "/muto-logo.png"; // วางไฟล์ไว้ที่ public/muto-logo.png

const csvEscape = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function StatusBadge({ value }: { value: Status }) {
  const color =
    value === "active"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : value === "in_repair"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : value === "retired"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : "bg-rose-100 text-rose-700 border-rose-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {value}
    </span>
  );
}

/* ============== CSV utils ============== */
type CSVPreview = { headers: string[]; rows: Record<string, string>[] };

function parseCSV(text: string): CSVPreview {
  const rows: string[][] = [];
  let cur = "", row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(cur); cur = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map((h) => h.trim());
  const mapped = rows
    .slice(1)
    .filter((r) => r.some((cell) => (cell ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
      return obj;
    });
  return { headers, rows: mapped };
}

async function parseCSVFile(file: File): Promise<CSVPreview> {
  const text = await file.text();
  return parseCSV(text);
}

async function upsertBatch(items: Partial<Device>[]) {
  const { error } = await supabase.from("devices").upsert(items, { onConflict: "asset_tag" });
  if (error) throw error;
}

/* ============== Device form dialog ============== */
function DeviceFormDialog({
  open, onOpenChange, initial, onSaved, departments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<Device> | null;
  onSaved: () => void;
  departments: Department[];
}) {
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  const [form, setForm] = useState<Partial<Device>>({
    asset_tag: initial?.asset_tag ?? "",
    serial_no: initial?.serial_no ?? "",
    status: (initial?.status ?? "active") as Status,
    model: initial?.model ?? "",
    brand: initial?.brand ?? "",
    department_id: initial?.department_id ?? undefined,
  });

  useEffect(() => {
    setForm({
      asset_tag: initial?.asset_tag ?? "",
      serial_no: initial?.serial_no ?? "",
      status: (initial?.status ?? "active") as Status,
      model: initial?.model ?? "",
      brand: initial?.brand ?? "",
      department_id: initial?.department_id ?? undefined,
    });
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.asset_tag || !form.serial_no) {
      toast("ต้องมี Asset Tag และ Serial No.");
      return;
    }
    try {
      setSaving(true);
      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from("devices")
          .update({
            asset_tag: form.asset_tag,
            serial_no: form.serial_no,
            status: form.status,
            model: form.model || null,
            brand: form.brand || null,
            department_id: form.department_id ?? null,
          })
          .eq("id", initial.id);
        if (error) throw error;
        toast.success(`อัปเดต ${form.asset_tag}`);
      } else {
        const { error } = await supabase.from("devices").insert({
          asset_tag: form.asset_tag!,
          serial_no: form.serial_no!,
          status: (form.status as Status) || "active",
          model: form.model || null,
          brand: form.brand || null,
          department_id: form.department_id ?? null,
        });
        if (error) throw error;
        toast.success(`เพิ่มอุปกรณ์ ${form.asset_tag}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  const departmentValue = form.department_id ? String(form.department_id) : "none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{isEdit ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asset_tag">Asset Tag</Label>
              <Input id="asset_tag" value={form.asset_tag || ""} onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serial_no">Serial No</Label>
              <Input id="serial_no" value={form.serial_no || ""} onChange={(e) => setForm((f) => ({ ...f, serial_no: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">สถานะ</Label>
              <Select value={(form.status as Status) ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="in_repair">in_repair</SelectItem>
                  <SelectItem value="retired">retired</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department_id">แผนก</Label>
              <Select
                value={departmentValue}
                onValueChange={(v) => setForm((f) => ({ ...f, department_id: v === "none" ? undefined : Number(v) }))}
              >
                <SelectTrigger id="department_id">
                  <SelectValue placeholder="เลือกแผนก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={form.model || ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" value={form.brand || ""} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
              {saving ? "กำลังบันทึก..." : isEdit ? "บันทึก" : "เพิ่ม"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============== main page ============== */
export default function InventoryPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ search: string; status: "all" | Status; departmentId: string | "all" }>({
    search: "",
    status: "all",
    departmentId: "all",
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);

  const deptMap = useMemo(() => {
    const m: Record<number, string> = {};
    departments.forEach((d) => (m[d.id] = d.name));
    return m;
  }, [departments]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("departments").select("id,name,code").order("name");
      if (!error) setDepartments(data || []);
    })();
  }, []);

  async function fetchDevices() {
    setLoading(true);
    try {
      let q = supabase.from("devices").select("*").is("deleted_at", null).order("asset_tag");
      if (filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.departmentId !== "all") q = q.eq("department_id", Number(filters.departmentId));
      if (filters.search.trim()) {
        const s = filters.search.trim();
        q = q.or(`asset_tag.ilike.%${s}%,serial_no.ilike.%${s}%,model.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setDevices((data as Device[]) || []);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const allSelected = useMemo(() => devices.length > 0 && devices.every((d) => selected[d.id]), [devices, selected]);
  const anySelected = useMemo(() => devices.some((d) => selected[d.id]), [devices, selected]);
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  function toggleAll() {
    const next: Record<string, boolean> = {};
    if (!allSelected) devices.forEach((d) => (next[d.id] = true));
    setSelected(next);
  }
  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  /* ====== Export CSV ====== */
  async function handleExportCSV() {
    const headers = ["asset_tag", "serial_no", "status", "model", "brand", "department", "last_seen"];
    const lines = [
      headers.join(","),
      ...devices.map((r) =>
        [
          csvEscape(r.asset_tag),
          csvEscape(r.serial_no),
          csvEscape(r.status),
          csvEscape(r.model ?? ""),
          csvEscape(r.brand ?? ""),
          csvEscape(r.department_id ? deptMap[r.department_id] ?? "" : ""),
          csvEscape(r.last_seen ?? ""),
        ].join(",")
      ),
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "devices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ====== Import CSV ====== */
  const [importPreview, setImportPreview] = useState<CSVPreview | null>(null);

  async function handleFilePick(f?: File) {
    const file = f ?? fileRef.current?.files?.[0];
    if (!file) return;
    const preview = await parseCSVFile(file);
    setImportPreview(preview);
    toast(`พรีวิว ${preview.rows.length} แถว`);
  }

  async function handleImportCommit() {
  if (!importPreview) return;

  // map สำหรับตรวจและแปลงค่าแผนกให้เป็น id ที่มีจริง
  const deptNameToId = new Map(departments.map(d => [String(d.name).trim().toLowerCase(), d.id]));
  const deptCodeToId = new Map(departments.map(d => [String(d.code ?? "").trim(), d.id]));
  const validDeptIds  = new Set(departments.map(d => d.id));

  // helper: แปลงวันที่ให้เป็น ISO 'YYYY-MM-DD'
  const toIsoDate = (v: string | null | undefined) => {
    if (!v) return null;
    const s = String(v).trim();
    // รูปแบบถูกต้องอยู่แล้ว
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // รองรับ 'DD-MM-YY' → '20YY-MM-DD'
    const m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (m) {
      const [_, dd, mm, yy] = m;
      return `20${yy}-${mm}-${dd}`;
    }
    // อื่น ๆ: ไม่แปลง
    return null;
  };

  const mapped: Partial<Device>[] = importPreview.rows
    .map((r) => {
      // ===== หาค่า department_id จากหลายความเป็นไปได้ =====
      let department_id: number | null = null;

      // 1) ถ้ามีคอลัมน์ 'department' (ชื่อแผนก)
      const depName = String(r["department"] ?? "").trim().toLowerCase();
      if (depName && deptNameToId.has(depName)) {
        department_id = deptNameToId.get(depName)!;
      }

      // 2) ถ้ายังไม่ได้ ลองอ่านจาก 'department_id' ในไฟล์ (อาจเป็น id, code หรือชื่อ)
      if (department_id == null) {
        const raw = String(r["department_id"] ?? "").trim();
        if (raw !== "") {
          const asNum = Number(raw);
          // 2.1 ถ้าเป็นเลข id ที่มีอยู่จริง
          if (!Number.isNaN(asNum) && validDeptIds.has(asNum)) {
            department_id = asNum;
          } else {
            // 2.2 ถ้าเป็น code (เช่น '15')
            const viaCode = deptCodeToId.get(raw);
            if (viaCode) department_id = viaCode;

            // 2.3 ถ้าเป็น "ชื่อแผนก" แต่พิมพ์มาในคอลัมน์ department_id
            if (department_id == null) {
              const byName = deptNameToId.get(raw.toLowerCase());
              if (byName) department_id = byName;
            }
          }
        }
      }

      // ===== แปลงวันที่ =====
      const iso = toIsoDate(String(r["last_seen"] ?? ""));

      return {
        asset_tag: r["asset_tag"] ?? r["Asset Tag"] ?? r["asset"] ?? "",
        serial_no:  r["serial_no"]  ?? r["Serial"]    ?? r["serial"] ?? "",
        status:     ((r["status"] || "active").toLowerCase() as Status),
        model:      r["model"] ?? null,
        brand:      r["brand"] ?? null,
        department_id: department_id ?? null,  // กันชน FK
        last_seen:     iso,
      };
    })
    .filter((x) => x.asset_tag && x.serial_no);

  if (!mapped.length) {
    toast.error("ไฟล์ไม่ถูกต้อง: ต้องมี asset_tag และ serial_no");
    return;
  }

  try {
    await upsertBatch(mapped);
    setImportPreview(null);
    fetchDevices();
    toast.success(`นำเข้าแล้ว ${mapped.length} รายการ`);
  } catch (err: any) {
    toast.error(err?.message ?? String(err));
  }
}


  /* ====== QR Print ====== */
  async function handlePrintQR() {
    const picked = devices.filter((d) => selected[d.id]).map((d) => ({ id: d.id, asset_tag: d.asset_tag }));
    if (!picked.length) return;
    const QRCode: any = await import("qrcode");
    const items = await Promise.all(
      picked.map(async (it) => ({ asset_tag: it.asset_tag, dataUrl: await QRCode.toDataURL(it.asset_tag, { margin: 1, width: 256 }) }))
    );
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>@page{size:A4;margin:10mm}body{font-family:ui-sans-serif,system-ui} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #ddd;padding:8px;text-align:center}img{width:100%;height:auto}small{display:block;margin-top:6px}</style></head><body>
      <div class="grid">${items.map((x) => `<div class="card"><img src="${x.dataUrl}" /><small>${x.asset_tag}</small></div>`).join("")}</div>
      <script>onload=()=>print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-white">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="MUTO" className="h-8 w-auto" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
              <p className="text-sm text-slate-500">จัดการ/ค้นหา/นำเข้า-ส่งออก และพิมพ์ QR สำหรับอุปกรณ์</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }} className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Plus className="mr-2 h-4 w-4" />เพิ่มอุปกรณ์
            </Button>
            <Button variant="outline" onClick={fetchDevices} className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <RefreshCw className="mr-2 h-4 w-4" />รีเฟรช
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Download className="mr-2 h-4 w-4" />ส่งออก CSV
            </Button>
            <Button variant="outline" disabled={!anySelected} onClick={handlePrintQR} className="border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40">
              <QrCode className="mr-2 h-4 w-4" />พิมพ์ QR
            </Button>
            <Button
              variant="destructive"
              disabled={!anySelected}
              onClick={async () => {
                const ids = Object.keys(selected).filter((k) => selected[k]);
                if (!ids.length) return;
                await supabase.from("devices").update({ deleted_at: new Date().toISOString() }).in("id", ids);
                setSelected({});
                fetchDevices();
              }}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40"
            >
              <Trash2 className="mr-2 h-4 w-4" />ลบที่เลือก
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24">
        {/* Summary */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-blue-700/80">จำนวนอุปกรณ์ทั้งหมด</div>
            <div className="mt-1 text-2xl font-semibold text-blue-700">{devices.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-blue-700/80">ที่เลือกไว้</div>
            <div className="mt-1 text-2xl font-semibold text-blue-700">{selectedCount.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-blue-700/80">ตัวกรอง</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">status: {filters.status}</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                dept: {filters.departmentId === "all" ? "ทั้งหมด" : filters.departmentId}
              </span>
              {filters.search && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">ค้นหา: “{filters.search}”</span>}
            </div>
          </div>
        </div>

        {/* Filters & Import */}
        <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs text-slate-600">ค้นหา</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="asset_tag / serial / model"
                  className="pl-9 rounded-xl border-blue-200 focus-visible:ring-blue-200"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-slate-600">สถานะ</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any }))}>
                <SelectTrigger className="rounded-xl border-blue-200 focus:ring-blue-200">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="in_repair">in_repair</SelectItem>
                  <SelectItem value="retired">retired</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-slate-600">แผนก</Label>
              <Select value={filters.departmentId} onValueChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))}>
                <SelectTrigger className="rounded-xl border-blue-200 focus:ring-blue-200">
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Import */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 md:w-auto">
              <UploadCloud className="h-4 w-4" />
              <span>เลือกไฟล์ CSV เพื่อพรีวิว</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0] || undefined)}
              />
            </label>
            <Button variant="secondary" disabled={!importPreview} onClick={handleImportCommit} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40">
              บันทึกนำเข้า
            </Button>
          </div>

          {importPreview && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
              <div className="mb-2 text-sm font-medium text-blue-700">พรีวิว {importPreview.rows.length} แถว</div>
              <div className="max-h-60 overflow-auto rounded-lg border bg-white">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-blue-50/70">
                    <tr>
                      {importPreview.headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-semibold text-slate-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="odd:bg-white even:bg-slate-50/40">
                        {importPreview.headers.map((h) => (
                          <td key={h} className="whitespace-nowrap px-2 py-1.5 text-slate-700">
                            {r[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-blue-50/50 px-4 py-3">
            <div className="text-base font-semibold text-blue-800">รายการอุปกรณ์</div>
            <div className="text-xs text-blue-700">
              แสดง {devices.length.toLocaleString()} รายการ | เลือก {selectedCount.toLocaleString()} รายการ
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-[72px] z-[1] bg-white/95 backdrop-blur">
                <tr className="border-b">
                  <th className="w-10 px-3 py-3 text-left">
                    <Checkbox checked={!!allSelected} onCheckedChange={toggleAll as any} />
                  </th>
                  {["asset_tag", "serial_no", "status", "model", "brand", "department_id", "last_seen", "actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="border-b px-3 py-3">
                        <div className="h-4 w-4 rounded bg-blue-100" />
                      </td>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="border-b px-3 py-3">
                          <div className="h-4 w-28 rounded bg-blue-100" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && devices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-blue-200">
                        <Search className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="mt-3 text-base font-medium text-slate-700">ไม่พบข้อมูล</div>
                      <div className="text-xs text-slate-500">ลองปรับตัวกรองหรือกดรีเฟรช</div>
                    </td>
                  </tr>
                )}

                {devices.map((d) => (
                  <tr key={d.id} className="border-b odd:bg-white even:bg-blue-50/30 hover:bg-blue-50">
                    <td className="px-3 py-3">
                      <Checkbox checked={!!selected[d.id]} onCheckedChange={() => toggleOne(d.id)} />
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">{d.asset_tag}</td>
                    <td className="px-3 py-3 text-slate-700">{d.serial_no}</td>
                    <td className="px-3 py-3"><StatusBadge value={d.status} /></td>
                    <td className="px-3 py-3 text-slate-700">{d.model ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{d.brand ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{d.department_id ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{d.last_seen ? new Date(d.last_seen).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditing(d); setDialogOpen(true); }} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Dialog */}
      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        onSaved={fetchDevices}
        departments={departments}
      />

      {/* local tailwind helpers for the page */}
      <style>{`
        .btn-blue { background:#2563eb; }
      `}</style>
    </div>
  );
}
