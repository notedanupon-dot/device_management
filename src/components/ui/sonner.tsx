"use client";
import { Toaster as SonnerToaster } from "sonner";

// Export ชื่อ Toaster ให้ใช้เหมือน component ปกติ
export function Toaster() {
  return <SonnerToaster richColors position="top-right" expand={false} />;
}
