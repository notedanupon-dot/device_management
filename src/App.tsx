import InventoryPage from "./pages/InventoryPage";
// ถ้า *ไม่ได้* ตั้ง path alias "@/*" ให้ใช้ relative path แบบนี้
import { Toaster } from "./components/ui/sonner";

// ถ้าคุณตั้ง path alias "@/*" ใน tsconfig แล้ว ใช้อันนี้แทน
// import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <>
      <InventoryPage />
      <Toaster richColors position="top-center" />
    </>
  );
}