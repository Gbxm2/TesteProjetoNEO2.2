import React, { useState, useEffect } from "react";
import { 
  HardHat, 
  X, 
  Plus, 
  Battery, 
  Calendar, 
  Cpu, 
  Radio, 
  User, 
  CheckCircle, 
  AlertTriangle, 
  Wrench, 
  Trash2, 
  Edit3,
  Search,
  ShieldAlert
} from "lucide-react";
import { Helmet, Employee, UserRole } from "../types";
import { dataService } from "../services/dataService";
import { motion, AnimatePresence } from "motion/react";

interface HelmetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  employees: Employee[];
  onRefreshData?: () => void;
}

export default function HelmetManagementModal({
  isOpen,
  onClose,
  userRole,
  employees,
  onRefreshData
}: HelmetModalProps) {
  const [helmets, setHelmets] = useState<Helmet[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingHelmet, setEditingHelmet] = useState<Helmet | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  const isReadOnly = userRole === "VIEWER";

  useEffect(() => {
    if (isOpen) {
      loadHelmets();
      // Sincronização em tempo real com o Supabase
      const unsubscribe = dataService.subscribeToRealtime((table) => {
        if (table === "helmets" || table === "employees") {
          loadHelmets();
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  const loadHelmets = async () => {
    const data = await dataService.getHelmets();
    setHelmets(data);
  };

  const handleSaveHelmet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isReadOnly || !editingHelmet) return;

    await dataService.saveHelmet(editingHelmet);
    setSaveSuccessMsg("Capacete salvo com sucesso!");
    setTimeout(() => setSaveSuccessMsg(""), 3000);
    setIsFormOpen(false);
    setEditingHelmet(null);
    await loadHelmets();
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteHelmet = async (id: string) => {
    if (isReadOnly) return;
    if (window.confirm("Deseja realmente remover este capacete do almoxarifado?")) {
      await dataService.deleteHelmet(id);
      await loadHelmets();
      if (onRefreshData) onRefreshData();
    }
  };

  const openNewHelmetForm = () => {
    if (isReadOnly) return;
    const nextNum = helmets.length + 1;
    const newHelmet: Helmet = {
      id: `HELM-00${nextNum}`,
      serialNumber: `CAP-2026-ESP0${nextNum}`,
      macAddress: `24:6F:28:B4:7E:${(10 + nextNum).toString(16).toUpperCase()}`,
      firmwareVersion: "v1.0.4",
      battery: 100,
      status: "AVAILABLE",
      lastCalibration: new Date().toISOString().split("T")[0],
      nextInspection: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      assignedEmployeeId: null
    };
    setEditingHelmet(newHelmet);
    setIsFormOpen(true);
  };

  const filteredHelmets = helmets.filter(h => {
    const matchesFilter = filterStatus === "ALL" || h.status === filterStatus;
    const matchesSearch = 
      h.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.assignedEmployeeName && h.assignedEmployeeName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
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
              <HardHat className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Capacetes Inteligentes (EPIs)</h2>
                {isReadOnly && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                    Modo Somente Leitura (Visualizador)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">Controle de hardware, firmware ESP32, calibração periódica e vinculação</p>
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
                placeholder="Buscar por número de série ou operador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-yellow-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="AVAILABLE">Disponível no Almoxarifado</option>
              <option value="IN_USE">Em Operação / Vinculado</option>
              <option value="MAINTENANCE">Em Calibração / Manutenção</option>
            </select>
          </div>

          {!isReadOnly && (
            <button
              onClick={openNewHelmetForm}
              className="w-full md:w-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Novo Capacete
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        {saveSuccessMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {saveSuccessMsg}
          </div>
        )}

        {/* Table / List */}
        <div className="p-6 overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <th className="pb-3 px-3">Código / Serial</th>
                <th className="pb-3 px-3">Hardware ESP32</th>
                <th className="pb-3 px-3">Bateria</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Operador Vinculado</th>
                <th className="pb-3 px-3">Próx. Inspeção</th>
                {!isReadOnly && <th className="pb-3 px-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-zinc-200">
              {filteredHelmets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    Nenhum capacete inteligente encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredHelmets.map((h) => {
                  const assignedEmp = employees.find(e => e.id === h.assignedEmployeeId);
                  return (
                    <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-3">
                        <div className="font-bold text-white font-mono">{h.serialNumber}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{h.id}</div>
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px]">
                          <Cpu className="w-3.5 h-3.5 text-yellow-500" />
                          {h.macAddress || "24:6F:28:XX:XX"}
                        </div>
                        <div className="text-[10px] text-zinc-500">Firmware: {h.firmwareVersion || "v1.0.4"}</div>
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <Battery className={`w-4 h-4 ${h.battery > 50 ? "text-green-400" : h.battery > 20 ? "text-yellow-400" : "text-red-500"}`} />
                          <span className="font-mono font-bold">{h.battery}%</span>
                        </div>
                        <div className="w-16 bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full ${h.battery > 50 ? "bg-green-500" : h.battery > 20 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${h.battery}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          h.status === "IN_USE" 
                            ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                            : h.status === "AVAILABLE"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        }`}>
                          {h.status === "IN_USE" ? "Em Uso" : h.status === "AVAILABLE" ? "Disponível" : "Manutenção"}
                        </span>
                      </td>

                      <td className="py-4 px-3">
                        {assignedEmp ? (
                          <div className="flex items-center gap-1.5 font-medium text-yellow-400">
                            <User className="w-3.5 h-3.5" />
                            {assignedEmp.name}
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic text-[11px]">Nenhum operador vinculado</span>
                        )}
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5" />
                          {h.nextInspection || "2026-12-31"}
                        </div>
                      </td>

                      {!isReadOnly && (
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingHelmet({ ...h });
                                setIsFormOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              title="Editar Capacete"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteHelmet(h.id)}
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

        {/* Modal de Criação / Edição de Capacete */}
        <AnimatePresence>
          {isFormOpen && editingHelmet && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <HardHat className="w-5 h-5 text-yellow-500" />
                    {editingHelmet.id ? "Editar Capacete Inteligente" : "Novo Capacete"}
                  </h3>
                  <button onClick={() => setIsFormOpen(false)} className="text-zinc-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveHelmet} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Número de Série</label>
                      <input 
                        type="text"
                        required
                        value={editingHelmet.serialNumber}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="CAP-2026-ESP01"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Versão de Firmware</label>
                      <input 
                        type="text"
                        value={editingHelmet.firmwareVersion || "v1.0.4"}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, firmwareVersion: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="v1.0.4"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Endereço MAC (ESP32)</label>
                      <input 
                        type="text"
                        value={editingHelmet.macAddress || ""}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, macAddress: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                        placeholder="24:6F:28:B4:7E:10"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Bateria Inicial (%)</label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={editingHelmet.battery}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, battery: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Status Operacional</label>
                      <select
                        value={editingHelmet.status}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      >
                        <option value="AVAILABLE">Disponível no Almoxarifado</option>
                        <option value="IN_USE">Em Uso (Operação)</option>
                        <option value="MAINTENANCE">Manutenção / Calibração</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Vincular a Funcionário</label>
                      <select
                        value={editingHelmet.assignedEmployeeId || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          const emp = employees.find(emp => emp.id === val);
                          setEditingHelmet({ 
                            ...editingHelmet, 
                            assignedEmployeeId: val,
                            assignedEmployeeName: emp ? emp.name : null,
                            status: val ? "IN_USE" : editingHelmet.status
                          });
                        }}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      >
                        <option value="">Sem vínculo (Almoxarifado)</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Data Última Calibração</label>
                      <input 
                        type="date"
                        value={editingHelmet.lastCalibration || ""}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, lastCalibration: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">Próxima Inspeção NR-06</label>
                      <input 
                        type="date"
                        value={editingHelmet.nextInspection || ""}
                        onChange={(e) => setEditingHelmet({ ...editingHelmet, nextInspection: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-500"
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
                      Salvar Capacete
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
