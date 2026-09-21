export interface BranchTargetInput {
  branchId: number;
  branchName: string;
  branchFixedTotal: number; // sum FixedExpense aktif utk cabang ini
  override: number | null; // dailyTargetOverride cabang
  todayOmzet: number; // omzet hari ini cabang ini
}

export interface DailyTargetStatus {
  branchId: number;
  branchName: string;
  monthlyFixedExpense: number; // beban cabang + alokasi pusat
  dailyTarget: number; // override ?? derived
  isOverride: boolean;
  todayOmzet: number;
  pct: number; // 0..∞ (nilai asli; frontend clamp utk bar)
  met: boolean;
  shortfall: number; // max(0, dailyTarget - todayOmzet)
}

/**
 * Hitung status target omzet harian per cabang (hybrid override + fallback beban bulanan).
 *
 * @param branches daftar cabang aktif + angka-angkanya
 * @param pusatFixedTotal total FixedExpense aktif branchId=null (pusat), dialokasikan rata ke tiap cabang
 * @param daysInMonth jumlah hari kalender bulan berjalan
 */
export function computeDailyTargets(
  branches: BranchTargetInput[],
  pusatFixedTotal: number,
  daysInMonth: number,
  jumlahCabangAktif?: number,
): DailyTargetStatus[] {
  // Beban pusat dibagi rata ke SEMUA cabang aktif — walau yang ditampilkan hanya satu cabang
  // (dulu tampilan per cabang membebankan seluruh beban pusat ke cabang itu).
  const nBranches = (jumlahCabangAktif && jumlahCabangAktif > 0 ? jumlahCabangAktif : branches.length) || 1;
  const pusatSharePerBranch = pusatFixedTotal / nBranches;
  const days = daysInMonth > 0 ? daysInMonth : 30;

  return branches.map((b) => {
    const monthlyFixedExpense = b.branchFixedTotal + pusatSharePerBranch;
    const derived = monthlyFixedExpense / days;
    const isOverride = b.override != null && b.override > 0;
    const dailyTarget = isOverride ? (b.override as number) : derived;
    const pct = dailyTarget > 0 ? (b.todayOmzet / dailyTarget) * 100 : 0;
    return {
      branchId: b.branchId,
      branchName: b.branchName,
      monthlyFixedExpense,
      dailyTarget,
      isOverride,
      todayOmzet: b.todayOmzet,
      pct,
      met: b.todayOmzet >= dailyTarget && dailyTarget > 0,
      shortfall: Math.max(0, dailyTarget - b.todayOmzet),
    };
  });
}
