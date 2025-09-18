import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase"; // หรือ "../../lib/supabase"
import { Plus, Pencil, Trash2, Download, RefreshCw, QrCode } from "lucide-react";
// shadcn/ui
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";


// ====== ภายในฟังก์ชัน component InventoryPage ======
const fileRef = useRef<HTMLInputElement | null>(null)
const [importing, setImporting] = useState(false)

// ตัวอย่าง mapping: คาด header = asset_tag, serial_no, status, model, brand, department_code, last_seen
async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setImporting(true)
  try {
    const rows = await parseCSVFile(file)

    // map เป็น payload สำหรับ Supabase
    const payload = rows.map((r) => ({
      asset_tag: r.asset_tag || r.asset || '',
      serial_no: r.serial_no || '',
      status: (r.status || 'active').toLowerCase() as 'active' | 'in_repair' | 'retired' | 'lost',
      model: r.model || null,
      brand: r.brand || null,
      // ถ้ามี department_id โดยตรงให้ใช้เลย; ถ้ามีแต่รหัสแผนก (code) คุณอาจต้อง query กลับเพื่อหา id ก่อน
      department_id: r.department_id ? Number(r.department_id) : null,
      last_seen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
    }))

    // อัปเซิร์ตเข้า Supabase (onConflict ตามคีย์ที่คุณต้องการ เช่น asset_tag)
    const { error } = await supabase
      .from('devices')
      .upsert(payload, { onConflict: 'asset_tag' })

    if (error) {
      toast({ variant: 'destructive', title: 'นำเข้าไม่สำเร็จ', description: error.message })
    } else {
      toast({ title: `นำเข้าแล้ว ${payload.length} รายการ` })
      // รีเฟรชตารางหลังนำเข้า
      fetchDevices()
    }
  } catch (err: any) {
    toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: String(err?.message || err) })
  } finally {
    setImporting(false)
    if (e.target) e.target.value = '' // reset file input
  }
}

{/* ปุ่มใน toolbar ด้านบน */}
<Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
  นำเข้า CSV
</Button>

{/* file input ซ่อนไว้ */}
<input
  ref={fileRef}
  type="file"
  accept=".csv,text/csv"
  className="hidden"
  onChange={handleImportCSV}
/>



// ---------- Types ----------
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
export type Department = { id: number; name: string };

// ---------- Helpers ----------
// ✅ ใช้ตัวนี้แทนของเดิม
const csvEscape = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // ครอบกรณีมีเครื่องหมายคำพูด , หรือขึ้นบรรทัดใหม่
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};


// ---------- Device Form Dialog ----------
function DeviceFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
  departments,
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
      toast({ title: "กรอกข้อมูลไม่ครบ", description: "ต้องมี Asset Tag และ Serial No." });
      return;
    }
    try {
      setSaving(true);
      if (isEdit && initial?.id) {
        const { error } = await supabase.from("devices").update({
          asset_tag: form.asset_tag,
          serial_no: form.serial_no,
          status: form.status,
          model: form.model || null,
          brand: form.brand || null,
          department_id: form.department_id ?? null,
        }).eq("id", initial.id);
        if (error) throw error;
        toast({ title: "บันทึกแล้ว", description: `อัปเดต ${form.asset_tag}` });
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
        toast({ title: "เพิ่มอุปกรณ์แล้ว", description: form.asset_tag });
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "บันทึกล้มเหลว", description: err?.message ?? String(err) });
    } finally {
      setSaving(false);
    }
  }

  // NOTE: shadcn Select ห้ามใช้ค่า "" ใน SelectItem
  // ใช้ค่า "none" แล้ว map กลับเป็น undefined/Null แทน
  const departmentValue = form.department_id ? String(form.department_id) : "none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}</DialogTitle>
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
                <SelectTrigger id="status"><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
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
              <Select value={departmentValue} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v === "none" ? undefined : Number(v) }))}>
                <SelectTrigger id="department_id"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ไม่ระบุ —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>ยกเลิก</Button>
            <Button type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : isEdit ? "บันทึก" : "เพิ่ม"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== CSV utils (วางไว้ด้านบนไฟล์ InventoryPage.tsx ก่อน export default) =====

/** แปลง text CSV -> array of object โดยอิง header แถวแรก (รองรับ "ค่า,มี,คอมมา" แบบใส่เครื่องหมายคำพูด) */
function parseCSV(text: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let cur = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      // ดูว่ามี "" (escaped quote) ไหม
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cur)
      cur = ''
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      // ปิดแถว (รองรับ \r\n)
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else {
      cur += c
    }
  }
  // ค่าคอลัมน์สุดท้ายของไฟล์
  if (cur.length > 0 || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }

  if (rows.length === 0) return []

  const headers = rows[0].map(h => h.trim())
  const dataRows = rows.slice(1)

  return dataRows
    .filter(r => r.some(cell => cell.trim() !== '')) // ตัดแถวว่าง
    .map(r => {
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => (obj[h] = (r[idx] ?? '').trim()))
      return obj
    })
}

/** อ่านไฟล์ CSV ที่เลือกจาก input[type=file] */
async function parseCSVFile(file: File): Promise<Array<Record<string, string>>> {
  const text = await file.text()
  return parseCSV(text)
}


// ---------- Main Page ----------
export default function InventoryPage() {
 
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ search: string; status: "all" | Status; departmentId: string | "all" }>({ search: "", status: "all", departmentId: "all" });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("departments").select("id,name").order("name");
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
      toast({ title: "โหลดข้อมูลล้มเหลว", description: err?.message ?? String(err) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchDevices(); }, [filters]);

  const allSelected = useMemo(() => devices.length > 0 && devices.every((d) => selected[d.id]), [devices, selected]);
  const anySelected = useMemo(() => devices.some((d) => selected[d.id]), [devices, selected]);

  function toggleAll() {
    const next: Record<string, boolean> = {};
    if (!allSelected) devices.forEach((d) => (next[d.id] = true));
    setSelected(next);
  }
  function toggleOne(id: string) { setSelected((prev) => ({ ...prev, [id]: !prev[id] })); }

  async function handleExportCSV() {
    const headers = ["asset_tag","serial_no","status","model","brand","department","last_seen"];
const lines = [
  headers.join(","),
  ...rows.map(r =>
    [
      csvEscape(r.asset_tag),
      csvEscape(r.serial_no),
      csvEscape(r.status),
      csvEscape(r.model ?? ""),
      csvEscape(r.brand ?? ""),
      csvEscape(r.department_name ?? ""),
      csvEscape(r.last_seen ?? "")
    ].join(",")
  ),
];
const csv = lines.join("\n");
  }

  async function handleDeleteSelected() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return;
    await supabase.from("devices").update({ deleted_at: new Date().toISOString() }).in("id", ids);
    setSelected({});
    fetchDevices();
  }

  async function handleFilePick(f?: File) {
    const file = f ?? fileRef.current?.files?.[0];
    if (!file) return;
    const preview = await parseCSVFile(file);
    setImportPreview(preview);
  }

  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  async function handleImportCommit() {
    if (!importPreview) return;
    const mapped: Partial<Device>[] = importPreview.rows.map((r) => ({
      asset_tag: r["asset_tag"] ?? r["Asset Tag"] ?? r["asset"] ?? "",
      serial_no: r["serial_no"] ?? r["Serial"] ?? r["serial"] ?? "",
      status: ((r["status"] || "active").toLowerCase() as Status),
      model: r["model"] ?? null,
      brand: r["brand"] ?? null,
      department_id: r["department_id"] ? Number(r["department_id"]) : null,
    })).filter((x) => x.asset_tag && x.serial_no);
    if (!mapped.length) { toast({ title: "ไฟล์ไม่ถูกต้อง", description: "ต้องมี asset_tag และ serial_no" }); return; }
    await upsertBatch(mapped);
    setImportPreview(null);
    fetchDevices();
    toast({ title: "นำเข้าแล้ว", description: `${mapped.length} รายการ` });
  }

  async function handlePrintQR() {
    const picked = devices.filter((d) => selected[d.id]).map((d) => ({ id: d.id, asset_tag: d.asset_tag }));
    if (!picked.length) return;
    const QRCode: any = await import("qrcode");
    const items = await Promise.all(picked.map(async (it) => ({ asset_tag: it.asset_tag, dataUrl: await QRCode.toDataURL(it.asset_tag, { margin: 1, width: 256 }) })));
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>@page{size:A4;margin:10mm}body{font-family:ui-sans-serif,system-ui} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #ddd;padding:8px;text-align:center}img{width:100%;height:auto}small{display:block;margin-top:6px}</style></head><body>
      <div class="grid">${items.map((x) => `<div class="card"><img src="${x.dataUrl}" /><small>${x.asset_tag}</small></div>`).join("")}</div>
      <script>onload=()=>print()</script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
     
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
              <p className="text-sm text-slate-500">จัดการ/ค้นหา/นำเข้า-ส่งออก และพิมพ์ QR สำหรับอุปกรณ์</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4"/>เพิ่มอุปกรณ์</Button>
              <Button variant="outline" onClick={fetchDevices}><RefreshCw className="mr-2 h-4 w-4"/>รีเฟรช</Button>
              <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4"/>ส่งออก CSV</Button>
              <Button variant="outline" disabled={!anySelected} onClick={handlePrintQR}><QrCode className="mr-2 h-4 w-4"/>พิมพ์ QR</Button>
              <Button variant="destructive" disabled={!anySelected} onClick={handleDeleteSelected}><Trash2 className="mr-2 h-4 w-4"/>ลบที่เลือก</Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16">
        {/* Filters */}
        <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs text-slate-600">ค้นหา</Label>
              <div className="relative">
                <svg width="16" height="16" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
                <Input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="asset_tag / serial / model" className="pl-9" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-slate-600">สถานะ</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Import */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFilePick(e.target.files?.[0] || undefined)} />
              <span>นำเข้า CSV</span>
            </Label>
            <Button variant="secondary" disabled={!importPreview} onClick={handleImportCommit}>บันทึกนำเข้า</Button>
          </div>

          {importPreview && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-medium text-slate-600">พรีวิว {importPreview.rows.length} แถว</div>
              <div className="max-h-60 overflow-auto rounded-lg border bg-white">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {importPreview.headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-2 py-2 text-left font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="odd:bg-white even:bg-slate-50/40">
                        {importPreview.headers.map((h) => (
                          <td key={h} className="whitespace-nowrap px-2 py-1.5 text-slate-700">{r[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Table */}
        <section className="mt-6 rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-[72px] z-[1] bg-slate-50/90 backdrop-blur">
                <tr>
                  <th className="w-10 px-3 py-3 text-left">
                    <Checkbox checked={!!allSelected} onCheckedChange={toggleAll as any} />
                  </th>
                  {["asset_tag", "serial_no", "status", "model", "brand", "department_id", "last_seen", "actions"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="border-t px-3 py-3"><div className="h-4 w-4 rounded bg-slate-200"/></td>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="border-t px-3 py-3"><div className="h-4 w-28 rounded bg-slate-200"/></td>
                    ))}
                  </tr>
                ))}

                {!loading && devices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      <div className="mx-auto h-12 w-12 rounded-full border border-dashed border-slate-300" />
                      <div className="mt-3 font-medium">ไม่พบข้อมูล</div>
                      <div className="text-xs">ลองปรับตัวกรองหรือกดรีเฟรช</div>
                    </td>
                  </tr>
                )}

                {devices.map((d) => (
                  <tr key={d.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-violet-50/50">
                    <td className="border-t px-3 py-3">
                      <Checkbox checked={!!selected[d.id]} onCheckedChange={() => toggleOne(d.id)} />
                    </td>
                    <td className="border-t px-3 py-3 font-medium text-slate-800">{d.asset_tag}</td>
                    <td className="border-t px-3 py-3 text-slate-700">{d.serial_no}</td>
                    <td className="border-t px-3 py-3"><StatusBadge value={d.status} /></td>
                    <td className="border-t px-3 py-3 text-slate-700">{d.model ?? "-"}</td>
                    <td className="border-t px-3 py-3 text-slate-700">{d.brand ?? "-"}</td>
                    <td className="border-t px-3 py-3 text-slate-700">{d.department_id ?? "-"}</td>
                    <td className="border-t px-3 py-3 text-slate-700">{d.last_seen ? new Date(d.last_seen).toLocaleString() : "-"}</td>
                    <td className="border-t px-3 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditing(d); setDialogOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Add/Edit Dialog */}
      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        initial={editing}
        onSaved={fetchDevices}
        departments={departments}
      />
    </div>
  );
}
