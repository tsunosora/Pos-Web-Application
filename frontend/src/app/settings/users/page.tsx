"use client";

import { useState, useEffect } from "react";
import { getUsers, getRoles, updateUser, deleteUser, createRole, updateRole, deleteRole, createUser } from "@/lib/api";
import { Loader2, ShieldAlert, UserCog, Plus, Trash2, Edit, X, Shield, Key } from "lucide-react";

export default function UserManagementSettings() {
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modals state
    const [roleModal, setRoleModal] = useState<{ isOpen: boolean, mode: 'add' | 'edit', id?: number, name: string }>({ isOpen: false, mode: 'add', name: '' });
    const [userModal, setUserModal] = useState<{ isOpen: boolean, mode: 'add' | 'edit', id?: number, name: string, email: string, phone: string, roleId: string, password: string }>({
        isOpen: false, mode: 'add', name: '', email: '', phone: '', roleId: '', password: ''
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersData, rolesData] = await Promise.all([getUsers(), getRoles()]);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (error) {
            console.error("Gagal memuat pengguna", error);
        } finally {
            setIsLoading(false);
        }
    };

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

    // --- User CRUD ---
    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                name: userModal.name,
                email: userModal.email,
                phone: userModal.phone,
                roleId: userModal.roleId ? parseInt(userModal.roleId) : undefined,
            };
            if (userModal.password) {
                payload.password = userModal.password;
            }

            if (userModal.mode === 'add') {
                if (!userModal.password) return alert("Password wajib untuk user baru!");
                await createUser(payload);
            } else if (userModal.id) {
                await updateUser(userModal.id, payload);
            }
            setUserModal({ ...userModal, isOpen: false });
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal menyimpan user");
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm("Hapus pengguna / karyawan ini secara permanen?")) return;
        try {
            await deleteUser(id);
            loadData();
        } catch (error: any) {
            alert(error?.response?.data?.message || "Gagal menghapus pengguna.");
        }
    };


    if (isLoading) return <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <UserCog className="h-6 w-6 text-primary" />
                    Manajemen Akses & Karyawan
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Kelola data seluruh rekan kerja, kasir, dan tentukan hak akses (Role) masing-masing.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* --- BAGIAN ROLES --- */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Daftar Role</h2>
                        <button onClick={() => setRoleModal({ isOpen: true, mode: 'add', name: '' })}
                            className="bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors">
                            <Plus className="w-4 h-4" /> Tambah Role
                        </button>
                    </div>

                    <div className="glass bg-card/50 rounded-xl border border-border overflow-hidden">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Nama Role</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {roles.map(role => (
                                    <tr key={role.id} className="hover:bg-muted/20">
                                        <td className="px-4 py-3 font-medium text-sm">{role.name}</td>
                                        <td className="px-4 py-3 text-right space-x-2">
                                            <button onClick={() => setRoleModal({ isOpen: true, mode: 'edit', id: role.id, name: role.name })}
                                                className="text-muted-foreground hover:text-primary transition-colors p-1"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteRole(role.id)}
                                                className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                                {roles.length === 0 && (
                                    <tr><td colSpan={2} className="px-4 py-4 text-center text-sm text-muted-foreground">Belum ada role terdaftar.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border border-primary/20 bg-primary/5 rounded-xl text-xs space-y-2">
                        <p className="font-semibold text-primary">Info Implementasi Role:</p>
                        <p className="text-muted-foreground">Saat ini Role berfungsi sebagai "Label" pembeda (misal: Kasir, Desainer, Admin) yang tampil di invoice. Pembatasan akses ke menu lain masih dalam pengembangan lanjutan.</p>
                    </div>
                </div>

                {/* --- BAGIAN USERS --- */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold flex items-center gap-2"><UserCog className="w-5 h-5 text-primary" /> Daftar Akun Karyawan</h2>
                        <button onClick={() => setUserModal({ isOpen: true, mode: 'add', name: '', email: '', phone: '', roleId: '', password: '' })}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm">
                            <Plus className="w-4 h-4" /> Karyawan Baru
                        </button>
                    </div>

                    <div className="overflow-x-auto glass bg-card/50 rounded-xl border border-border">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Info Akun</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Kontak/No HP (Auto-Save)</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Hak Akses</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap whitespace-normal">
                                            <div className="flex items-center hidden sm:flex">
                                                <div className="h-8 w-8 flex-shrink-0 bg-primary/10 rounded-full flex justify-center items-center font-bold text-primary text-xs">
                                                    {(user.name || user.email).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="ml-3">
                                                    <div className="text-sm font-medium">{user.name || 'NN'}</div>
                                                    <div className="text-xs text-muted-foreground">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <input type="text" placeholder="08..." defaultValue={user.phone || ''}
                                                onBlur={(e) => handlePhoneChangeInline(user.id, e.target.value)}
                                                className="w-full max-w-[130px] text-sm border-b border-transparent hover:border-border focus:border-primary bg-transparent focus:bg-background px-1 py-1 outline-none transition-colors" />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <select value={user.roleId || ''} onChange={(e) => handleRoleChangeInline(user.id, e.target.value)}
                                                className="text-sm border border-border bg-background rounded-lg px-2 py-1 focus:ring-primary focus:border-primary outline-none transition-all shadow-sm max-w-[130px]">
                                                <option value="">(Kosong)</option>
                                                {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                                            <button onClick={() => setUserModal({ isOpen: true, mode: 'edit', id: user.id, name: user.name || '', email: user.email || '', phone: user.phone || '', roleId: user.roleId || '', password: '' })}
                                                className="text-muted-foreground hover:text-primary transition-colors p-1"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteUser(user.id)}
                                                className="text-muted-foreground hover:text-destructive transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- MODAL ROLE --- */}
            {roleModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden glass">
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

            {/* --- MODAL USER --- */}
            {userModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden glass">
                        <div className="flex justify-between items-center p-4 border-b border-border">
                            <h3 className="font-bold flex items-center gap-2">
                                {userModal.mode === 'add' ? <Plus className="w-5 h-5 text-primary" /> : <Edit className="w-5 h-5 text-primary" />}
                                {userModal.mode === 'add' ? 'Register Karyawan Baru' : 'Edit Data Karyawan'}
                            </h3>
                            <button onClick={() => setUserModal({ ...userModal, isOpen: false })} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">Nama Lengkap</label>
                                    <input type="text" required value={userModal.name} onChange={e => setUserModal({ ...userModal, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">No. HP</label>
                                    <input type="text" value={userModal.phone} onChange={e => setUserModal({ ...userModal, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Email (Untuk Login)</label>
                                <input type="email" required={userModal.mode === 'add'} disabled={userModal.mode === 'edit'} value={userModal.email} onChange={e => setUserModal({ ...userModal, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-background disabled:bg-muted/50 border border-border rounded-lg outline-none text-sm focus:border-primary" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Pilih Role / Jabatan</label>
                                <select value={userModal.roleId} onChange={e => setUserModal({ ...userModal, roleId: e.target.value })}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary">
                                    <option value="">Tanpa Role</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5 border-t border-dashed border-border pt-4 mt-2">
                                <label className="text-sm font-medium text-muted-foreground">{userModal.mode === 'add' ? 'Password Akses' : 'Ganti Password (Opsional)'}</label>
                                <div className="relative">
                                    <input type="password" value={userModal.password} onChange={e => setUserModal({ ...userModal, password: e.target.value })} placeholder={userModal.mode === 'edit' ? "Kosongkan jika tidak ingin mereset sandi" : "Minimal 6 karakter..."}
                                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg outline-none text-sm focus:border-primary" />
                                    <Key className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setUserModal({ ...userModal, isOpen: false })} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted border border-border">Batal</button>
                                <button type="submit" className="px-6 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-sm">Simpan Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
