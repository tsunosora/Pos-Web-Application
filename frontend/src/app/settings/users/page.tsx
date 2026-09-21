"use client";

import { useState, useEffect, useRef } from "react";
import { getUsers, getRoles, updateUser, deleteUser, setUserStatus, createRole, updateRole, deleteRole, createUser } from "@/lib/api";
import { getDesigners, createDesigner, updateDesigner, deleteDesigner, type Designer } from "@/lib/api/designers";
import { Loader2, ShieldAlert, UserCog, Plus, Trash2, Edit, X, Shield, Key, Building2, UserX, UserCheck, Search, Users, Phone, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ResponsiveTable, EmptyState } from "@/components/ui/responsive-table";
import axios from "@/lib/api/client";
import { badgeToneClass } from "@/components/ui/status-badge";

/** Bentuk data yang dipakai halaman ini (subset dari GET /users & /users/roles). */
type AppUser = {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    roleId: number | null;
    role?: { id: number; name: string } | null;
    branchId: number | null;
    branch?: { id: number; name: string; code: string | null } | null;
    isActive?: boolean;
    resignedAt?: string | null;
    resignNote?: string | null;
};
type AppRoleRow = { id: number; name: string };

const OWNER_ROLE_NAMES = ["owner", "superadmin", "super_admin", "super admin"];
const isOwnerRoleName = (name?: string | null) =>
    !!name && OWNER_ROLE_NAMES.includes(name.toLowerCase());

export default function UserManagementSettings() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [roles, setRoles] = useState<AppRoleRow[]>([]);
    const [branches, setBranches] = useState<{ id: number; name: string; code: string | null }[]>([]);
    // Daftar PIN kerja (tab "PIN Kerja"): dipakai untuk menunjukkan siapa yang
    // punya pintu kedua, dan mengingatkan saat menandai karyawan keluar.
    const [pins, setPins] = useState<Designer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    // Karyawan yang sudah keluar disembunyikan supaya daftar harian tetap ringkas.
    const [showResigned, setShowResigned] = useState(false);
    const [search, setSearch] = useState("");

    // Modals state
    const [roleModal, setRoleModal] = useState<{ isOpen: boolean, mode: 'add' | 'edit', id?: number, name: string }>({ isOpen: false, mode: 'add', name: '' });
    // Satu modal per ORANG: bagian akun login + bagian PIN kerja.
    type OrangModal = {
        isOpen: boolean; mode: 'add' | 'edit'; id?: number;
        name: string; email: string; phone: string; roleId: string; branchId: string; password: string;
        wantLogin: boolean;                 // orang ini punya / akan dibuatkan akun login
        pinId?: number; wantPin: boolean;   // orang ini punya / akan dibuatkan PIN kerja
        pinValue: string;                   // kosong = PIN lama tidak diubah
        pinBranchId: string; pinActive: boolean;
    };
    const kosongModal: OrangModal = {
        isOpen: false, mode: 'add', name: '', email: '', phone: '', roleId: '', branchId: '', password: '',
        wantLogin: true, wantPin: false, pinValue: '', pinBranchId: '', pinActive: true,
    };
    const [userModal, setUserModal] = useState<OrangModal>(kosongModal);
    const [menyimpan, setMenyimpan] = useState(false);
    const sedangSimpan = useRef(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersData, rolesData, branchesData, pinsData] = await Promise.all([
                getUsers(),
                getRoles(),
                axios.get('/company-branches/active').then(r => r.data).catch(() => []),
                getDesigners().catch(() => [] as Designer[]),
            ]);
            setUsers(usersData);
            setRoles(rolesData);
            setBranches(branchesData);
            setPins(pinsData);
        } catch (error) {
            console.error("Gagal memuat pengguna", error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentRoleName = (() => {
        const id = userModal.roleId ? parseInt(userModal.roleId) : null;
        if (!id) return null;
        return roles.find(r => r.id === id)?.name ?? null;
    })();
    const userModalIsOwner = isOwnerRoleName(currentRoleName);

    // Staf non-owner tanpa cabang tidak bisa login (ditolak di backend) — dihitung
    // supaya kelihatan sebelum orangnya mengeluh tidak bisa masuk.
    const noBranchCount = users.filter(
        (u) => u.isActive !== false && !u.branchId && !isOwnerRoleName(u.role?.name),
    ).length;
    const memberCount = (roleId: number) => users.filter((u) => u.roleId === roleId).length;

    /**
     * SATU DAFTAR ORANG. Di belakang tetap ada dua tabel — akun login (`users`)
     * & PIN kerja (`designers`) — tapi owner cukup melihat satu baris per orang:
     * bisa login atau tidak, punya PIN kerja atau tidak, dan statusnya.
     * PIN yang belum tertaut tapi namanya sama ikut digabung ke baris orangnya
     * supaya tidak ada pintu yang terlewat saat karyawan keluar.
     */
    type Orang = {
        key: string;
        nama: string;
        user?: AppUser;
        pin?: Designer;
        pinTertaut: boolean;
        keluar: boolean;
    };

    const samakan = (v?: string | null) => (v || '').trim().toLowerCase();
    const pinByUser = new Map<number, Designer>();
    const pinLepas: Designer[] = [];
    for (const d of pins) {
        if (d.userId) pinByUser.set(d.userId, d); else pinLepas.push(d);
    }
    const pinDipakai = new Set<number>();
    const orangSemua: Orang[] = users.map((u) => {
        let pin = pinByUser.get(u.id);
        let tertaut = !!pin;
        if (!pin) {
            const cocok = pinLepas.find((d) => !pinDipakai.has(d.id) && samakan(d.name) === samakan(u.name));
            if (cocok) { pin = cocok; pinDipakai.add(cocok.id); tertaut = false; }
        }
        return {
            key: `u${u.id}`, nama: u.name || u.email, user: u, pin, pinTertaut: tertaut,
            keluar: u.isActive === false,
        };
    });
    // PIN yang sama sekali tidak punya akun login tetap muncul sebagai orang.
    for (const d of pinLepas) {
        if (pinDipakai.has(d.id)) continue;
        orangSemua.push({ key: `p${d.id}`, nama: d.name, pin: d, pinTertaut: false, keluar: !d.isActive });
    }

    const keluarCount = orangSemua.filter((o) => o.keluar).length;
    const activePinCount = pins.filter((d) => d.isActive).length;
    const tanpaLoginCount = orangSemua.filter((o) => !o.user).length;

    const q = search.trim().toLowerCase();
    const orangTampil = orangSemua
        .filter((o) => (showResigned ? true : !o.keluar))
        .filter((o) =>
            !q ||
            [o.nama, o.user?.email, o.user?.phone, o.user?.role?.name, o.user?.branch?.name, o.user?.branch?.code, o.pin?.name]
                .some((v) => (v || '').toLowerCase().includes(q)),
        )
        // Yang masih aktif selalu di atas, lalu urut nama.
        .sort((a, b) => (a.keluar ? 1 : 0) - (b.keluar ? 1 : 0) || a.nama.localeCompare(b.nama));

    useEffect(() => {
        loadData();
    }, []);

    // --- Inline Inline User Handlers (Quick Edit) ---
    const handleRoleChangeInline = async (userId: number, newRoleId: string) => {
        try {
            await updateUser(userId, { roleId: newRoleId ? parseInt(newRoleId) : undefined });
            loadData();
        } catch (error) {
            console.error(error);
            alert("Gagal memperbarui role pengguna.");
        }
    };

    const handlePhoneChangeInline = async (userId: number, newPhone: string) => {
        try {
            await updateUser(userId, { phone: newPhone });
        } catch (error) {
            console.error(error);
            alert("Gagal memperbarui nomor HP pengguna.");
        }
    };

    // --- Role CRUD ---
    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (roleModal.mode === 'add') {
                await createRole({ name: roleModal.name });
            } else if (roleModal.id) {
                await updateRole(roleModal.id, { name: roleModal.name });
            }
            setRoleModal({ ...roleModal, isOpen: false });
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal menyimpan role");
        }
    };

    const handleDeleteRole = async (id: number) => {
        if (!confirm("Hapus role ini? Pastikan tidak ada user yang sedang menggunakan role ini.")) return;
        try {
            await deleteRole(id);
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal menghapus role. Mungkin masih digunakan oleh user.");
        }
    };

    // --- SIMPAN ORANG: akun login (opsional) + PIN kerja (opsional) ---
    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const m = userModal;
        const nama = m.name.trim();
        if (!nama) return alert("Nama wajib diisi.");
        if (!m.wantLogin && !m.wantPin) {
            return alert("Pilih minimal satu akses: akun login atau PIN kerja.");
        }
        const kuat = (pw: string) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
        if (m.wantLogin) {
            if (!m.id) {
                if (!m.email.trim()) return alert("Email wajib untuk akun login.");
                if (!kuat(m.password)) return alert("Password minimal 8 karakter dan harus mengandung huruf dan angka.");
            } else if (m.password && !kuat(m.password)) {
                return alert("Password baru minimal 8 karakter dan harus mengandung huruf dan angka.");
            }
            if (!userModalIsOwner && !m.branchId) return alert("Cabang wajib dipilih untuk role non-Owner.");
        }
        if (m.wantPin && !m.pinId && !m.pinValue.trim()) {
            return alert("PIN kerja wajib diisi (4–10 angka).");
        }
        if (sedangSimpan.current) return; // klik ganda → akun ganda
        sedangSimpan.current = true;
        setMenyimpan(true);

        try {
            let userId: number | null = m.id ?? null;

            if (m.wantLogin) {
                const payload: any = {
                    name: nama,
                    email: m.email.trim(),
                    phone: m.phone,
                    roleId: m.roleId ? parseInt(m.roleId) : undefined,
                    branchId: userModalIsOwner ? null : (m.branchId ? parseInt(m.branchId) : null),
                };
                if (m.password) payload.password = m.password;
                if (userId) {
                    await updateUser(userId, payload);
                } else {
                    const dibuat: any = await createUser(payload);
                    userId = dibuat?.id ?? null;
                    // Akun sudah jadi: bila langkah PIN di bawah gagal lalu disimpan ulang, perbarui akun
                    // ini — dulu dibuat lagi (email ganda / akun dobel).
                    if (userId) setUserModal((u) => ({ ...u, id: userId as number }));
                }
            }

            const pinBranchId = m.pinBranchId ? parseInt(m.pinBranchId) : null;
            const pinBranchName = branches.find((b) => b.id === pinBranchId)?.name ?? null;

            if (m.wantPin) {
                if (m.pinId) {
                    await updateDesigner(m.pinId, {
                        name: nama,
                        ...(m.pinValue.trim() ? { pin: m.pinValue.trim() } : {}),
                        branchId: pinBranchId,
                        branchName: pinBranchName,
                        isActive: m.pinActive,
                        ...(userId ? { userId } : {}),
                    });
                } else {
                    await createDesigner({
                        name: nama, pin: m.pinValue.trim(),
                        branchId: pinBranchId, branchName: pinBranchName, userId,
                    });
                }
            } else if (m.pinId) {
                // Centang dilepas → PIN dinonaktifkan, TIDAK dihapus, supaya riwayat
                // prestasi desainer/operator (tersimpan sebagai nama) tetap utuh.
                await updateDesigner(m.pinId, { isActive: false });
            }

            setUserModal({ ...userModal, isOpen: false });
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal menyimpan data karyawan");
        } finally {
            sedangSimpan.current = false;
            setMenyimpan(false);
        }
    };

    /**
     * Karyawan keluar: data TIDAK dihapus (riwayat lead/kas/tugas/prestasi ikut
     * hilang), cukup ditutup kedua pintunya — login (langsung mati walau token
     * masih ada) dan PIN kerja, termasuk PIN yang belum tertaut.
     */
    const handleToggleResign = async (o: Orang) => {
        const label = o.nama;
        try {
            if (o.keluar) {
                if (!confirm(`Aktifkan kembali ${label}?\n\nLogin dan PIN kerjanya bisa dipakai lagi.`)) return;
                if (o.user) await setUserStatus(o.user.id, { active: true });
                if (o.pin && !o.pin.isActive && (!o.user || !o.pinTertaut)) {
                    await updateDesigner(o.pin.id, { isActive: true });
                }
                loadData();
                alert(`${label} aktif kembali.`);
                return;
            }
            const barisLogin = o.user
                ? `• Login aplikasi kasir langsung mati, termasuk yang sedang terbuka di HP-nya\n`
                : `• Orang ini tidak punya akun login\n`;
            const barisPin = o.pin
                ? `• PIN kerja "${o.pin.name}" (/so-designer, /produksi, /cetak) ikut ditutup\n`
                : `• Orang ini tidak punya PIN kerja\n`;
            const note = prompt(
                `Tandai ${label} sudah keluar?\n\n` + barisLogin + barisPin +
                `• Riwayat kerja, omzet & prestasinya TETAP utuh di laporan\n\n` +
                `Catatan (opsional, mis. tanggal atau alasan keluar):`,
                '',
            );
            if (note === null) return; // dibatalkan
            if (o.user) await setUserStatus(o.user.id, { active: false, note: note.trim() || undefined });
            if (o.pin && o.pin.isActive && (!o.user || !o.pinTertaut)) {
                await updateDesigner(o.pin.id, { isActive: false });
            }
            loadData();
            const pintu = [o.user ? 'login' : null, o.pin ? 'PIN kerja' : null].filter(Boolean).join(' & ');
            alert(`${label} ditandai sudah keluar.${pintu ? ` Akses ${pintu} sudah ditutup.` : ''}`);
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal mengubah status karyawan.");
        }
    };

    const handleDeletePerson = async (o: Orang) => {
        try {
            if (o.user) {
                if (!confirm(`Hapus akun login ${o.nama} secara permanen?\n\nHanya untuk akun yang belum pernah dipakai. Kalau karyawannya sudah bekerja, pakai "Tandai keluar" agar riwayatnya tidak hilang.${o.pin ? '\n\nPIN kerjanya TIDAK terhapus — hapus/nonaktifkan lewat tombol Ubah.' : ''}`)) return;
                await deleteUser(o.user.id);
            } else if (o.pin) {
                if (!confirm(`Hapus PIN kerja ${o.nama} secara permanen?\n\nRiwayat SO & pekerjaan cetak yang sudah tercatat tetap ada (tersimpan sebagai nama). Kalau orangnya cuma berhenti, pakai "Tandai keluar" saja.`)) return;
                await deleteDesigner(o.pin.id);
            }
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal menghapus data karyawan.");
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Memuat data karyawan…</p>
            </div>
        );
    }

    const stats = [
        { label: 'Aktif', hint: 'Karyawan yang masih aktif (punya login dan/atau PIN kerja)', value: orangSemua.length - keluarCount, icon: Users, tone: 'text-primary bg-primary/10 ring-primary/20' },
        { label: 'Sudah keluar', hint: 'Sudah ditandai keluar — login & PIN-nya ditutup', value: keluarCount, icon: UserX, tone: 'text-muted-foreground bg-muted ring-border' },
        { label: 'PIN aktif', hint: 'PIN kerja yang masih bisa dipakai di /so-designer, /produksi & /cetak', value: activePinCount, icon: KeyRound, tone: 'text-primary bg-primary/10 ring-primary/20' },
        { label: 'Tanpa login', hint: 'Cuma punya PIN kerja, tidak bisa masuk aplikasi kasir', value: tanpaLoginCount, icon: UserCog, tone: 'text-muted-foreground bg-muted ring-border' },
        {
            label: 'Tanpa cabang', hint: 'Staf non-owner tanpa cabang tidak bisa login', value: noBranchCount, icon: Building2,
            tone: noBranchCount > 0
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 ring-amber-500/30'
                : 'text-muted-foreground bg-muted ring-border',
        },
    ];

    const pill = 'inline-flex items-center gap-1 border text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap';

    const cabangOrang = (o: Orang) => {
        if (o.user?.branch) return o.user.branch.code || o.user.branch.name;
        if (isOwnerRoleName(o.user?.role?.name)) return 'Semua cabang';
        const b = branches.find((x) => x.id === o.pin?.branchId);
        return b ? (b.code || b.name) : (o.pin?.branchName || null);
    };

    const branchBadge = (o: Orang) => {
        const label = cabangOrang(o);
        if (label === 'Semua cabang') return <span className={`${pill} ${badgeToneClass.success}`}>Semua cabang</span>;
        if (label) return (
            <span className={`${pill} ${badgeToneClass.neutral}`}>
                <Building2 className="w-3 h-3" />{label}
            </span>
        );
        return (
            <span className={`${pill} ${badgeToneClass.warning}`}
                title="Staf tanpa cabang tidak bisa login. Pilih cabangnya lewat tombol Ubah.">
                Belum ada cabang
            </span>
        );
    };

    /** Dua pintu orang ini: akun login & PIN kerja — lengkap dengan statusnya. */
    const aksesChips = (o: Orang) => {
        const loginChip = o.user ? (
            <span className={`${pill} ${o.keluar ? badgeToneClass.danger : badgeToneClass.success}`}
                title={o.keluar
                    ? `Akun login ${o.user.email} sudah ditandai keluar — tidak bisa masuk aplikasi kasir.`
                    : `Bisa login aplikasi kasir dengan email ${o.user.email}.`}>
                <UserCog className="w-3 h-3" />{o.keluar ? 'Login mati' : 'Login'}
            </span>
        ) : (
            <span className={`${pill} ${badgeToneClass.neutral}`}
                title="Orang ini belum punya akun login aplikasi kasir. Buat lewat tombol Ubah bila perlu.">
                Tanpa login
            </span>
        );
        const pinChip = o.pin ? (
            <span className={`${pill} ${!o.pin.isActive ? badgeToneClass.neutral : o.pinTertaut ? badgeToneClass.info : badgeToneClass.warning}`}
                title={!o.pin.isActive
                    ? `PIN kerja "${o.pin.name}" sudah nonaktif.`
                    : o.pinTertaut
                        ? `PIN kerja "${o.pin.name}" aktif untuk /so-designer, /produksi & /cetak (tertaut ke akun login, ikut ditutup saat ditandai keluar).`
                        : `PIN kerja "${o.pin.name}" aktif tapi BELUM tertaut ke akun login. Tandai keluar dari sini tetap menutupnya, tapi sebaiknya ditautkan lewat tombol Ubah.`}>
                <KeyRound className="w-3 h-3" />
                {!o.pin.isActive ? 'PIN mati' : o.pinTertaut ? 'PIN' : 'PIN lepas'}
            </span>
        ) : (
            <span className={`${pill} ${badgeToneClass.neutral}`}
                title="Belum punya PIN kerja (halaman /so-designer, /produksi, /cetak).">
                Tanpa PIN
            </span>
        );
        return <div className="flex flex-col items-start gap-1">{loginChip}{pinChip}</div>;
    };

    const keluarInfo = (o: Orang) => {
        if (!o.keluar) return null;
        const tgl = o.user?.resignedAt
            ? new Date(o.user.resignedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            : null;
        return (
            <div className="text-[11px] text-red-600 dark:text-red-400 truncate" title={o.user?.resignNote || undefined}>
                Keluar{tgl ? ` ${tgl}` : ''}{o.user?.resignNote ? ` · ${o.user.resignNote}` : ''}
            </div>
        );
    };

    const openEdit = (o: Orang) => setUserModal({
        isOpen: true,
        mode: o.user ? 'edit' : 'add',
        id: o.user?.id,
        name: o.nama,
        email: o.user?.email || '',
        phone: o.user?.phone || '',
        roleId: o.user?.roleId ? String(o.user.roleId) : '',
        branchId: o.user?.branchId ? String(o.user.branchId) : (o.pin?.branchId ? String(o.pin.branchId) : ''),
        password: '',
        wantLogin: !!o.user,
        pinId: o.pin?.id,
        wantPin: !!o.pin,
        pinValue: '',
        pinBranchId: o.pin?.branchId ? String(o.pin.branchId) : (o.user?.branchId ? String(o.user.branchId) : ''),
        pinActive: o.pin ? o.pin.isActive : true,
    });

    // labeled=true → tombol bertulisan (dipakai di kartu HP), false → ikon saja (tabel).
    const rowActions = (o: Orang, labeled = false) => {
        const base = `inline-flex items-center gap-1.5 rounded-lg whitespace-nowrap transition-colors ${labeled ? 'px-2 py-1.5 text-xs font-semibold border border-border' : 'p-1'}`;
        return (
            <div className={labeled ? 'flex items-center gap-1.5' : 'inline-flex items-center gap-0.5'}>
                <button onClick={() => openEdit(o)} title="Ubah data, akun login & PIN kerja" aria-label={`Ubah ${o.nama}`}
                    className={`${base} text-muted-foreground hover:text-primary hover:bg-primary/10`}>
                    <Edit className="w-4 h-4" />{labeled && 'Ubah'}
                </button>
                <button onClick={() => handleToggleResign(o)}
                    title={o.keluar ? 'Aktifkan kembali — login & PIN dibuka' : 'Tandai sudah keluar — login & PIN ditutup'}
                    aria-label={o.keluar ? `Aktifkan kembali ${o.nama}` : `Tandai ${o.nama} sudah keluar`}
                    className={`${base} ${o.keluar ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10' : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10'}`}>
                    {o.keluar ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    {labeled && (o.keluar ? 'Aktifkan' : 'Tandai keluar')}
                </button>
                <button onClick={() => handleDeletePerson(o)}
                    title="Hapus permanen — hanya untuk data yang belum pernah dipakai"
                    aria-label={`Hapus ${o.nama}`}
                    className={`${base} text-muted-foreground hover:text-destructive hover:bg-destructive/10`}>
                    <Trash2 className="w-4 h-4" />{labeled && <span className="hidden min-[360px]:inline">Hapus</span>}
                </button>
            </div>
        );
    };

    const roleSelect = (o: Orang, className: string) => o.user ? (
        <select aria-label={`Role ${o.nama}`} value={o.user.roleId || ''}
            onChange={(e) => handleRoleChangeInline(o.user!.id, e.target.value)}
            className={`text-sm border border-border bg-background rounded-lg px-2 py-1.5 outline-none focus:border-primary transition-colors ${className}`}>
            <option value="">(Tanpa role)</option>
            {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
    ) : (
        <span className="text-xs text-muted-foreground italic" title="Role hanya berlaku untuk akun login. Orang ini baru punya PIN kerja.">
            hanya PIN
        </span>
    );

    const kosong = (
        <EmptyState
            icon={Search}
            title={q ? 'Tidak ada yang cocok' : 'Belum ada karyawan'}
            description={q ? `Tidak ada karyawan dengan kata "${search}". Coba kata kunci lain${keluarCount > 0 && !showResigned ? ' atau tampilkan yang sudah keluar' : ''}.` : 'Tambahkan lewat tombol "Karyawan Baru".'}
        />
    );

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Karyawan: Akun & PIN"
                description="Satu daftar orang. Tiap baris menunjukkan dua pintu aksesnya: akun login aplikasi kasir (email & sandi) dan PIN kerja untuk /so-designer, /produksi & /cetak."
                icon={UserCog}
                breadcrumbs={[{ label: 'Pengaturan', href: '/settings' }, { label: 'Karyawan' }]}
                actions={
                    <button onClick={() => setUserModal({ ...kosongModal, isOpen: true, mode: 'add' })}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" /> Karyawan Baru
                    </button>
                }
            />

            {/* Ringkasan singkat — supaya masalah (mis. staf tanpa cabang) kelihatan cepat */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
                {stats.map(({ label, value, icon: Icon, tone, hint }) => (
                    <div key={label} title={hint} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                        <div className={`h-9 w-9 shrink-0 rounded-lg ring-1 flex items-center justify-center ${tone}`}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-lg font-bold leading-none">{value}</div>
                            <div className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Satu kolom penuh: area isi cuma ~1.100px setelah 2 menu samping,
                jadi tabel tidak boleh dipepet panel Role di sebelahnya. */}
            <div className="space-y-5 sm:space-y-6">

                {/* --- KARYAWAN (utama) --- */}
                <section className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari nama, email, role, atau cabang…" aria-label="Cari karyawan"
                                className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-primary transition-colors" />
                        </div>
                        {keluarCount > 0 && (
                            <button type="button" onClick={() => setShowResigned(!showResigned)} aria-pressed={showResigned}
                                className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${showResigned ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
                                <UserX className="w-3.5 h-3.5" />
                                {showResigned ? 'Sembunyikan' : 'Tampilkan'} {keluarCount} yang keluar
                            </button>
                        )}
                    </div>

                    {/* Tabel: tablet & desktop */}
                    <div className="hidden sm:block">
                        <ResponsiveTable>
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Karyawan &amp; cabang</th>
                                        <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Akses</th>
                                        <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">No. HP</th>
                                        <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</th>
                                        <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {orangTampil.map((o) => (
                                        <tr key={o.key} className={`transition-colors ${o.keluar ? 'bg-muted/20' : 'hover:bg-muted/20'}`}>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${o.keluar ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                                        {(o.nama || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 max-w-[178px]">
                                                        <div title={o.nama} className={`text-sm font-medium truncate ${o.keluar ? 'text-muted-foreground line-through' : ''}`}>
                                                            {o.nama}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            {o.user ? (
                                                                <span title={o.user.email} className="text-xs text-muted-foreground truncate">{o.user.email}</span>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground/70 italic truncate">tanpa akun login</span>
                                                            )}
                                                            {branchBadge(o)}
                                                        </div>
                                                        {keluarInfo(o)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">{aksesChips(o)}</td>
                                            <td className="px-3 py-2.5">
                                                {o.user ? (
                                                    <>
                                                        <label className="sr-only" htmlFor={`hp-${o.user.id}`}>No. HP {o.nama}</label>
                                                        <input id={`hp-${o.user.id}`} type="tel" inputMode="tel" placeholder="08…" defaultValue={o.user.phone || ''}
                                                            onBlur={(e) => handlePhoneChangeInline(o.user!.id, e.target.value)}
                                                            title="Tersimpan otomatis saat kursor pindah"
                                                            className="w-[112px] text-sm rounded-lg border border-transparent hover:border-border focus:border-primary bg-transparent focus:bg-background px-2 py-1 outline-none transition-colors" />
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">{roleSelect(o, 'max-w-[108px]')}</td>
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">{rowActions(o)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {orangTampil.length === 0 && kosong}
                        </ResponsiveTable>
                    </div>

                    {/* Kartu: HP (tabel 5 kolom tidak terbaca di layar kecil) */}
                    <div className="sm:hidden space-y-2.5">
                        {orangTampil.map((o) => (
                            <div key={o.key} className={`rounded-xl border border-border p-3 space-y-3 ${o.keluar ? 'bg-muted/20' : 'bg-card'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${o.keluar ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                        {(o.nama || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className={`text-sm font-semibold truncate ${o.keluar ? 'text-muted-foreground line-through' : ''}`}>{o.nama}</div>
                                        {o.user ? (
                                            <div className="text-xs text-muted-foreground truncate">{o.user.email}</div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground/70 italic">tanpa akun login</div>
                                        )}
                                        {keluarInfo(o)}
                                    </div>
                                    <div className="shrink-0">{branchBadge(o)}</div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">{aksesChips(o)}</div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {roleSelect(o, 'flex-1 min-w-[120px]')}
                                </div>

                                {o.user && (
                                    <div className="relative">
                                        <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <label className="sr-only" htmlFor={`hp-m-${o.user.id}`}>No. HP {o.nama}</label>
                                        <input id={`hp-m-${o.user.id}`} type="tel" inputMode="tel" placeholder="08… (tersimpan otomatis)" defaultValue={o.user.phone || ''}
                                            onBlur={(e) => handlePhoneChangeInline(o.user!.id, e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary transition-colors" />
                                    </div>
                                )}

                                <div className="pt-2.5 border-t border-border/60">{rowActions(o, true)}</div>
                            </div>
                        ))}
                        {orangTampil.length === 0 && (
                            <div className="rounded-xl border border-border bg-card">{kosong}</div>
                        )}
                    </div>
                </section>

                {/* --- ROLE (pendamping, di bawah daftar karyawan) --- */}
                <aside className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/40">
                            <h2 className="text-sm font-bold flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" /> Role / Jabatan
                                <span className="text-xs font-normal text-muted-foreground">({roles.length})</span>
                            </h2>
                            <button onClick={() => setRoleModal({ isOpen: true, mode: 'add', name: '' })}
                                className="bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Tambah
                            </button>
                        </div>
                        <ul className="divide-y divide-border/60">
                            {roles.map(role => (
                                <li key={role.id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{role.name}</div>
                                        <div className="text-[11px] text-muted-foreground">{memberCount(role.id)} akun</div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => setRoleModal({ isOpen: true, mode: 'edit', id: role.id, name: role.name })}
                                            title="Ubah nama role" aria-label={`Ubah role ${role.name}`}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteRole(role.id)}
                                            title="Hapus role" aria-label={`Hapus role ${role.name}`}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {roles.length === 0 && (
                                <li className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada role terdaftar.</li>
                            )}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2">
                        <p className="font-semibold text-primary flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Akses manajer mengikuti nama role
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Role dengan nama berikut otomatis boleh menyetujui/menolak permintaan edit kas:
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {['Admin', 'Owner', 'Pemilik', 'Manajer*', 'Manager*', 'Supervisor*', 'Kepala*'].map(r => (
                                <span key={r} className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">{r}</span>
                            ))}
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                            *) cukup mengandung kata itu. Role lain (mis. Kasir) hanya bisa mengajukan perubahan.
                        </p>
                    </div>
                </aside>
            </div>

            {/* --- MODAL ROLE --- */}
            {roleModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/25 backdrop-blur-md">
                    <div className="glass-strong w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-border">
                            <h3 className="font-bold">{roleModal.mode === 'add' ? 'Tambah Role Baru' : 'Edit Role'}</h3>
                            <button onClick={() => setRoleModal({ ...roleModal, isOpen: false })} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveRole} className="p-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Nama Role</label>
                                <input type="text" required value={roleModal.name} onChange={e => setRoleModal({ ...roleModal, name: e.target.value })} placeholder="Cth: Kasir Shift Pagi"
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary" />
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setRoleModal({ ...roleModal, isOpen: false })} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted">Batal</button>
                                <button type="submit" className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL KARYAWAN: akun login + PIN kerja dalam satu tempat --- */}
            {userModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-background/25 backdrop-blur-md overflow-y-auto">
                    <div className="glass-strong w-full max-w-lg my-4 rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-border">
                            <h3 className="font-bold flex items-center gap-2">
                                {userModal.id ? <Edit className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                                {userModal.id ? 'Ubah Karyawan' : 'Karyawan Baru'}
                            </h3>
                            <button onClick={() => setUserModal({ ...userModal, isOpen: false })} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">Nama Lengkap *</label>
                                    <input type="text" required value={userModal.name} onChange={e => setUserModal({ ...userModal, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">No. HP</label>
                                    <input type="tel" value={userModal.phone} onChange={e => setUserModal({ ...userModal, phone: e.target.value })}
                                        disabled={!userModal.wantLogin}
                                        title={!userModal.wantLogin ? 'No. HP tersimpan di akun login' : undefined}
                                        className="w-full px-3 py-2 bg-background disabled:bg-muted/50 border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                </div>
                            </div>

                            {/* ---- PINTU 1: akun login ---- */}
                            <section className="rounded-xl border border-border bg-card/40 p-3 space-y-3">
                                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input type="checkbox" checked={userModal.wantLogin} disabled={!!userModal.id}
                                        onChange={e => setUserModal({ ...userModal, wantLogin: e.target.checked })}
                                        className="mt-0.5 rounded border-border accent-primary" />
                                    <span className="min-w-0">
                                        <span className="text-sm font-semibold flex items-center gap-1.5">
                                            <UserCog className="w-4 h-4 text-primary" /> Akun login aplikasi kasir
                                        </span>
                                        <span className="block text-[11px] text-muted-foreground leading-snug">
                                            Email &amp; sandi untuk POS, nota, kas &amp; laporan.
                                            {userModal.id ? ' Akun sudah ada — hapus permanen lewat tombol hapus di daftar.' : ' Kosongkan kalau orang ini cuma perlu PIN kerja.'}
                                        </span>
                                    </span>
                                </label>

                                {userModal.wantLogin && (
                                    <div className="space-y-3 pl-1">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Email (untuk login)</label>
                                            <input type="email" required={!userModal.id} disabled={!!userModal.id} value={userModal.email}
                                                onChange={e => setUserModal({ ...userModal, email: e.target.value })}
                                                className="w-full px-3 py-2 bg-background disabled:bg-muted/50 border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">Role / jabatan</label>
                                                <select value={userModal.roleId} onChange={e => setUserModal({ ...userModal, roleId: e.target.value })}
                                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary">
                                                    <option value="">Tanpa Role</option>
                                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    Cabang {userModalIsOwner ? '(Owner: semua)' : <span className="text-red-500">*</span>}
                                                </label>
                                                <select value={userModalIsOwner ? '' : userModal.branchId}
                                                    onChange={e => setUserModal({ ...userModal, branchId: e.target.value })}
                                                    disabled={userModalIsOwner}
                                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary disabled:bg-muted/50 disabled:text-muted-foreground">
                                                    <option value="">— Pilih Cabang —</option>
                                                    {branches.map(b => (
                                                        <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {userModal.id ? 'Ganti sandi (opsional)' : 'Sandi akses *'}
                                            </label>
                                            <div className="relative">
                                                <input type="password" value={userModal.password} onChange={e => setUserModal({ ...userModal, password: e.target.value })}
                                                    placeholder={userModal.id ? 'Kosongkan bila tidak diganti' : 'Min 8 karakter, ada huruf & angka'}
                                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                                <Key className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* ---- PINTU 2: PIN kerja ---- */}
                            <section className="rounded-xl border border-border bg-card/40 p-3 space-y-3">
                                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input type="checkbox" checked={userModal.wantPin}
                                        onChange={e => setUserModal({ ...userModal, wantPin: e.target.checked })}
                                        className="mt-0.5 rounded border-border accent-primary" />
                                    <span className="min-w-0">
                                        <span className="text-sm font-semibold flex items-center gap-1.5">
                                            <KeyRound className="w-4 h-4 text-primary" /> PIN kerja desainer / operator
                                        </span>
                                        <span className="block text-[11px] text-muted-foreground leading-snug">
                                            Untuk halaman <code className="bg-muted px-1 rounded">/so-designer</code>, <code className="bg-muted px-1 rounded">/produksi</code> &amp; <code className="bg-muted px-1 rounded">/cetak</code> — masuk pakai nama + PIN, tanpa email. Nama di sini juga yang muncul sebagai desainer/operator di laporan prestasi.
                                        </span>
                                    </span>
                                </label>

                                {userModal.wantPin && (
                                    <div className="space-y-3 pl-1">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    PIN {userModal.pinId ? '(kosongkan = PIN lama tetap)' : '*'}
                                                </label>
                                                <input type="text" inputMode="numeric" value={userModal.pinValue}
                                                    onChange={e => setUserModal({ ...userModal, pinValue: e.target.value })}
                                                    placeholder={userModal.pinId ? '••••' : '4–10 angka'} maxLength={10}
                                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm font-mono tracking-widest focus:border-primary" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">Cabang kerja</label>
                                                <select value={userModal.pinBranchId} onChange={e => setUserModal({ ...userModal, pinBranchId: e.target.value })}
                                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary">
                                                    <option value="">— Pilih Cabang —</option>
                                                    {branches.map(b => (
                                                        <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                            <input type="checkbox" checked={userModal.pinActive}
                                                onChange={e => setUserModal({ ...userModal, pinActive: e.target.checked })}
                                                className="rounded border-border accent-primary" />
                                            PIN aktif (boleh dipakai sekarang)
                                        </label>
                                    </div>
                                )}

                                {!userModal.wantPin && userModal.pinId && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                                        Centang dilepas → PIN akan <strong>dinonaktifkan</strong> (tidak dihapus), supaya riwayat prestasi desainer/operator tetap utuh.
                                    </p>
                                )}
                            </section>

                            <div className="pt-1 flex justify-end gap-2">
                                <button type="button" onClick={() => setUserModal({ ...userModal, isOpen: false })} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted border border-border">Batal</button>
                                <button type="submit" disabled={menyimpan} className="px-6 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-sm disabled:opacity-50">{menyimpan ? "Menyimpan…" : "Simpan Data"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
