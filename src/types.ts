export enum UserRole {
  ADMIN = 'ADMIN',
  DPP = 'DPP',
  DPD = 'DPD',
  DPC = 'DPC',
  PAC = 'PAC',
}

export interface User {
  uid: string;
  noAnggota: string;
  namaLengkap: string;
  email: string;
  role: UserRole;
  wilayah: string;
  createdAt: any;
}

export interface Member {
  id: string;
  noAnggota: string;
  nik: string;
  namaLengkap: string;
  alamatLengkap: string;
  noWhatsapp: string;
  pengurus: 'DPP' | 'DPD' | 'DPC' | 'PAC';
  wilayah: string;
  jabatan: string;
  seksi?: string;
  lainLain?: string;
  fotoProfileUrl?: string;
  fotoEktpUrl?: string;
  status: 'Aktif' | 'Tidak Aktif';
  createdBy: string; // uid of creator
  createdRole: UserRole;
  createdWilayah: string;
  createdAt: any;
  updatedAt: any;
}

export interface Transaction {
  id: string;
  tanggal: any;
  jenis: 'Pemasukan' | 'Pengeluaran' | 'Lain-lain';
  nominal: number;
  keterangan: string;
  operator: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  role: UserRole;
  wilayah: string;
  createdAt: any;
}

export interface AppConfig {
  logoUrl: string;
  orgName: string;
  websiteUrl: string;
}
