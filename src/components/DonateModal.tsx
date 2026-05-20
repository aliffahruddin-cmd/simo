import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useConfig } from '../context/ConfigContext';

interface DonateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DonateModal({ open, onOpenChange }: DonateModalProps) {
  const { qrisUrl, merchantName } = useConfig();
  const defaultQris = "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-xs bg-white p-4">
        <DialogHeader className="pt-2">
          <DialogTitle className="text-xl font-bold text-center">Infaq Operasional</DialogTitle>
          <DialogDescription className="text-center text-slate-500 text-xs">
            Bantu operasional organisasi melalui QRIS
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4">
            <img 
              src={qrisUrl || defaultQris} 
              alt="QRIS" 
              className="w-48 h-48 mix-blend-multiply"
            />
          </div>
          
          <div className="w-full space-y-2">
            <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Merchant</span>
              <span className="font-bold text-slate-800 text-xs">{merchantName}</span>
            </div>
          </div>

          <div className="mt-4">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5 px-3 text-[10px] font-bold">
              QRIS STATUS RESMI
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
