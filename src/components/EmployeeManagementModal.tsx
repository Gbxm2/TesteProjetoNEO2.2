import React, { useState, useEffect } from "react";
import { 
  Users, 
  X, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  HardHat, 
  Phone, 
  Clock, 
  ShieldCheck, 
  AlertTriangle,
  Building,
  CheckCircle,
  FileText
} from "lucide-react";
import { Employee, Helmet, UserRole } from "../types";
import { dataService } from "../services/dataService";
import { formatCPF, formatPhone } from "../utils/formatters";
import { maskCPF } from "../utils/security";
import { motion, AnimatePresence } from "motion/react";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  onRefreshData?: () => void;
}

export default function EmployeeManagementModal({
  isOpen,
  onClose,
  userRole,
  onRefreshData
}: EmployeeModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [helmets, setHelmets] = useState<Helmet[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("ALL");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const isReadOnly = userRole === "VIEWER";

  useEffect(() => {
    if (isOpen) {
      loadData();
      // Sincronização em tempo real: reflete atualizações feitas na raiz do Supabase
      const unsubscribe = dataService.subscribeToRealtime((table) => {
        if (table === "employees" || table === "helmets") {
          loadData();
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  const loadData = async () => {
    const [emps, helms] = await Promise.all([
      dataService.getEmployees(),
      dataService.getHelmets()
    ]);
    setEmployees(emps);
    setHelmets(helms);
  };

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isReadOnly || !editingEmployee) return;

    await dataService.saveEmployee(editingEmployee);
    setSuccessMsg("Operador atualizado com sucesso!");
    setTimeout(() => setSuccessMsg(""), 3000);
    setIsFormOpen(false);
    setEditingEmployee(null);
    await loadData();
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteEmployee = async (id: string) => {
    if (isReadOnly) return;
    if (window.confirm("Confirma a exclusão deste funcionário do sistema?")) {
      await dataService.deleteEmployee(id);
      await loadData();
      if (onRefreshData) onRefreshData();
    }
  };

  const openNewEmployeeForm = () => {
    if (isReadOnly) return;
    const nextNum = employees.length + 1;
    const newEmp: Employee = {
      id: `EMP00${nextNum}`,
      name: "",
      cpf: "",
      matricula: `IND-${1040 + nextNum}`,
      roleFunction: "Operador de Máquinas",
      department: "Usinagem & Montagem",
      shift: "1º Turno (06h - 14h)",
      emergencyContact: "",
      status: "OFFLINE",
      lat: -23.5505,
      lng: -46.6333,
      lastSeen: 0,
      battery: 100,
      assignedHelmetId: null
    };
    setEditingEmployee(newEmp);
    setIsFormOpen(true);
  };

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  const filteredEmployees = employees.filter(emp => {
    const matchesDept = filterDepartment === "ALL" || emp.department === filterDepartment;
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.matricula && emp.matricula.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.cpf && emp.cpf.includes(searchTerm));
    return matchesDept && matchesSearch;
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
              <Users className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Funcionários & Operadores</h2>
                {isReadOnly && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Modo Somente Leitura (Visualizador)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">Cadastro de colaboradores industriais, turnos e atribuição de EPIs inteligentes</p>
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
                placeholder="Buscar por nome, matrícula ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-yellow-500"
            >
              <option value="ALL">Todos os Departamentos</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {!isReadOnly && (
            <button
              onClick={openNewEmployeeForm}
              className="w-full md:w-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              Novo Funcionário
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        {/* Table / List */}
        <div className="p-6 overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Operador / CPF</th>
                <th className="pb-3 px-3">Matrícula & Cargo</th>
                <th className="pb-3 px-3">Setor & Turno</th>
                <th className="pb-3 px-3">Status em Campo</th>
                <th className="pb-3 px-3">Capacete Vinculado</th>
                <th className="pb-3 px-3">Contato de Emergência</th>
                {!isReadOnly && <th className="pb-3 px-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-zinc-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Nenhum colaborador encontrado com os critérios pesquisados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const assignedHelmet = helmets.find(h => h.id === emp.assignedHelmetId || h.assignedEmployeeId === emp.id);
                  return (
                    <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-yellow-500/30 flex items-center justify-center font-bold text-yellow-400 text-xs">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white">{emp.name}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              CPF: {maskCPF(emp.cpf, !isReadOnly)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <div className="font-mono text-zinc-300 font-semibold">{emp.matricula || emp.id}</div>
                        <div className="text-[11px] text-zinc-400">{emp.roleFunction || "Operador"}</div>
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          <Building className="w-3.5 h-3.5 text-yellow-500" />
                          <span>{emp.department || "Geral"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{emp.shift || "Turno Regular"}</span>
                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit ${
                          emp.status === "EMERGENCY" 
                            ? "bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse" 
                            : emp.status === "ONLINE"
                            ? "bg-green-500/10 text-green-400 border border-green-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${emp.status === "ONLINE" ? "bg-green-500 animate-pulse" : emp.status === "EMERGENCY" ? "bg-red-500" : "bg-zinc-500"}`} />
                          {emp.status === "ONLINE" ? "Em Campo (Online)" : emp.status === "EMERGENCY" ? "EMERGÊNCIA" : "Offline"}
                        </span>
                      </td>

                      <td className="py-4 px-3">
                        {assignedHelmet ? (
                          <div className="flex items-center gap-1.5 text-yellow-400 font-mono text-xs font-semibold">
                            <HardHat className="w-3.5 h-3.5" />
                            {assignedHelmet.serialNumber}
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic text-[11px]">Nenhum EPI vinculado</span>
                        )}
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5 text-zinc-300 text-xs">
                          <Phone className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{emp.emergencyContact || "Não informado"}</span>
                        </div>
                      </td>

                      {!isReadOnly && (
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingEmployee({ ...emp });
                                setIsFormOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal de Criação / Edição de Funcionário */}
        <AnimatePresence>
          {isFormOpen && editingEmployee && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xl bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-yellow-500" />
                    {editingEmployee.name ? `Editar Operador: ${editingEmployee.name}` : "Novo Colaborador"}
                  </h3>
                  <button onClick={() => setIsFormOpen(false)} className="text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Nome Completo</label>
                    <input 
                      type="text"
                      required
                      value={editingEmployee.name}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      placeholder="Ex: Gabriel Araújo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">CPF</label>
                      <input 
                        type="text"
                        value={editingEmployee.cpf || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, cpf: formatCPF(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Matrícula / ID</label>
                      <input 
                        type="text"
                        required
                        value={editingEmployee.matricula || editingEmployee.id}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, matricula: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="IND-1044"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Função / Cargo</label>
                      <input 
                        type="text"
                        value={editingEmployee.roleFunction || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, roleFunction: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Operador Industrial"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Departamento</label>
                      <input 
                        type="text"
                        value={editingEmployee.department || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Usinagem & Montagem"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Turno</label>
                      <select
                        value={editingEmployee.shift || "1º Turno (06h - 14h)"}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, shift: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      >
                        <option value="1º Turno (06h - 14h)">1º Turno (06h - 14h)</option>
                        <option value="2º Turno (14h - 22h)">2º Turno (14h - 22h)</option>
                        <option value="3º Turno (22h - 06h)">3º Turno (22h - 06h)</option>
                        <option value="Comercial (08h - 18h)">Comercial (08h - 18h)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Capacete Atribuído (EPI)</label>
                      <select
                        value={editingEmployee.assignedHelmetId || ""}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, assignedHelmetId: e.target.value || null })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      >
                        <option value="">Nenhum Capacete Vinculado</option>
                        {helmets.map(h => (
                          <option key={h.id} value={h.id}>
                            {h.serialNumber} - {h.status === "IN_USE" ? "(Em Uso)" : "(Disponível)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Contato de Emergência</label>
                    <input 
                      type="text"
                      value={editingEmployee.emergencyContact || ""}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, emergencyContact: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      placeholder="Ex: (11) 98888-1111 (Esposa - Mariana)"
                    />
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
                      Salvar Operador
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
