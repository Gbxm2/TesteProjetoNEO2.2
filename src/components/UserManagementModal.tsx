import React, { useState, useEffect } from "react";
import { 
  Shield, 
  X, 
  Plus, 
  Search, 
  Edit3, 
  CheckCircle, 
  Crown, 
  Building2, 
  Eye, 
  Lock, 
  UserCheck, 
  UserX,
  Mail,
  Phone,
  AlertCircle,
  Trash2
} from "lucide-react";
import { UserRecord, UserRole } from "../types";
import { dataService } from "../services/dataService";
import { formatCPF, formatPhone } from "../utils/formatters";
import { maskCPF } from "../utils/security";
import { motion, AnimatePresence } from "motion/react";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
  currentUsername: string;
}

export default function UserManagementModal({
  isOpen,
  onClose,
  currentUserRole,
  currentUsername
}: UserModalProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isMaster = currentUserRole === "MASTER";
  const isCompanyAdmin = currentUserRole === "COMPANY_ADMIN";

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      // Sincronização em tempo real: reflete alterações na raiz do Supabase
      const unsubscribe = dataService.subscribeToRealtime((table) => {
        if (table === "users") {
          loadUsers();
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    const data = await dataService.getUsers();
    setUsers(data);
  };

  const handleToggleStatus = async (username: string) => {
    if (username === currentUsername) {
      alert("Você não pode desativar o seu próprio usuário logado.");
      return;
    }
    await dataService.toggleUserStatus(username, currentUsername);
    await loadUsers();
  };

  const handleDeleteUser = async (userToDelete: string) => {
    if (userToDelete === currentUsername) {
      alert("Você não pode excluir o seu próprio usuário logado.");
      return;
    }
    if (window.confirm(`Confirma a exclusão definitiva do usuário @${userToDelete}? Esta ação é irreversível e será auditada.`)) {
      await dataService.deleteUser(userToDelete, currentUsername);
      setSuccessMsg(`Usuário @${userToDelete} excluído com sucesso.`);
      setTimeout(() => setSuccessMsg(""), 3000);
      await loadUsers();
    }
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    if (!editingUser) return;

    // Se for COMPANY_ADMIN, não pode criar ou editar para MASTER
    if (!isMaster && editingUser.role === "MASTER") {
      setErrorMsg("Apenas Administradores Master podem conceder ou alterar permissões de nível Master.");
      return;
    }

    await dataService.saveUser(editingUser, currentUsername);
    setSuccessMsg("Usuário salvo com sucesso e credenciais protegidas!");
    setTimeout(() => setSuccessMsg(""), 3000);
    setIsFormOpen(false);
    setEditingUser(null);
    await loadUsers();
  };

  const openNewUserForm = () => {
    const newUser: UserRecord = {
      firstName: "",
      lastName: "",
      username: "",
      role: "VIEWER",
      password: "123456",
      cpf: "",
      position: "Técnico de Segurança",
      department: "Operações",
      email: "",
      phone: "",
      active: true
    };
    setEditingUser(newUser);
    setIsFormOpen(true);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "MASTER":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex items-center gap-1.5 w-fit">
            <Crown className="w-3.5 h-3.5 text-yellow-500" />
            Admin Master
          </span>
        );
      case "COMPANY_ADMIN":
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 w-fit">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            Admin Empresa
          </span>
        );
      case "VIEWER":
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1.5 w-fit">
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            Visualizador
          </span>
        );
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === "ALL" || u.role === filterRole;
    const matchesSearch = 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Usuários & Controle de Acesso (RBAC)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                  {isMaster ? "Acesso Master Pleno" : "Gestor da Empresa"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">Controle de credenciais, papéis de permissão e status de acesso ao sistema</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-6 border-b border-white/5 bg-zinc-900/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Buscar por usuário, nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-yellow-500"
            >
              <option value="ALL">Todos os Perfis (RBAC)</option>
              <option value="MASTER">👑 Admin Master</option>
              <option value="COMPANY_ADMIN">🏢 Admin Empresa</option>
              <option value="VIEWER">👁️ Visualizador</option>
            </select>
          </div>

          <button
            onClick={openNewUserForm}
            className="w-full md:w-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Novo Usuário
          </button>
        </div>

        {/* Feedback Messages */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        {/* Table / List */}
        <div className="p-6 overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Usuário / Identificação</th>
                <th className="pb-3 px-3">Nível de Acesso (RBAC)</th>
                <th className="pb-3 px-3">Cargo & Departamento</th>
                <th className="pb-3 px-3">Contato</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-zinc-200">
              {filteredUsers.map((u) => {
                const isCurrent = u.username === currentUsername;
                return (
                  <tr key={u.id || u.username} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-yellow-500/30 flex items-center justify-center font-bold text-yellow-400 text-xs">
                          {u.firstName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {u.firstName} {u.lastName}
                            {isCurrent && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-400 font-normal">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">@{u.username}</div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                            CPF: {maskCPF(u.cpf, isMaster)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-3">
                      {getRoleBadge(u.role)}
                    </td>

                    <td className="py-4 px-3">
                      <div className="font-semibold text-zinc-200">{u.position || "Sem cargo"}</div>
                      <div className="text-[10px] text-zinc-400">{u.department || "Geral"}</div>
                    </td>

                    <td className="py-4 px-3">
                      <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                        <Mail className="w-3 h-3 text-zinc-500" />
                        <span>{u.email || "Sem email"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{u.phone || "Sem telefone"}</span>
                      </div>
                    </td>

                    <td className="py-4 px-3">
                      <button
                        onClick={() => handleToggleStatus(u.username)}
                        disabled={isCurrent}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                          u.active 
                            ? "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20" 
                            : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                        } ${isCurrent ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        title={isCurrent ? "Você não pode desativar seu próprio usuário" : "Clique para alternar"}
                      >
                        {u.active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {u.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>

                    <td className="py-4 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingUser({ ...u });
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                          title="Editar Credenciais e Dados"
                          aria-label={`Editar usuário ${u.username}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20"
                            title="Excluir Usuário"
                            aria-label={`Excluir usuário ${u.username}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal de Criação / Edição de Usuário */}
        <AnimatePresence>
          {isFormOpen && editingUser && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-yellow-500" />
                    {editingUser.id ? `Editar Usuário: @${editingUser.username}` : "Novo Usuário"}
                  </h3>
                  <button onClick={() => setIsFormOpen(false)} className="text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Nome</label>
                      <input 
                        type="text"
                        required
                        value={editingUser.firstName}
                        onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Ex: Carlos"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Sobrenome</label>
                      <input 
                        type="text"
                        required
                        value={editingUser.lastName}
                        onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Ex: Silva"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Username (Login)</label>
                      <input 
                        type="text"
                        required
                        value={editingUser.username}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="csilva"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Senha</label>
                      <input 
                        type="text"
                        required
                        value={editingUser.password || "123456"}
                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="123456"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Perfil de Acesso (RBAC)</label>
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      >
                        {isMaster && <option value="MASTER">👑 Admin Master (Total)</option>}
                        <option value="COMPANY_ADMIN">🏢 Admin Empresa (Gestão)</option>
                        <option value="VIEWER">👁️ Visualizador (Somente Leitura)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">CPF</label>
                      <input 
                        type="text"
                        value={editingUser.cpf || ""}
                        onChange={(e) => setEditingUser({ ...editingUser, cpf: formatCPF(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Cargo / Função</label>
                      <input 
                        type="text"
                        value={editingUser.position}
                        onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Engenheiro de Segurança"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Departamento</label>
                      <input 
                        type="text"
                        value={editingUser.department}
                        onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="COI / SESMT"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">E-mail</label>
                      <input 
                        type="email"
                        value={editingUser.email}
                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="usuario@industrial.com"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Telefone</label>
                      <input 
                        type="text"
                        value={editingUser.phone}
                        onChange={(e) => setEditingUser({ ...editingUser, phone: formatPhone(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="(11) 98765-4321"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-wider text-[10px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-wider text-[10px] shadow-lg"
                    >
                      Salvar Usuário
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
