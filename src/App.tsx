import { useEffect, useState, useRef } from "react";
import { Employee, WebSocketMessage, SystemStats, RecentActivity, UserProfile, UserRole } from "./types";
import Sidebar from "./components/Sidebar";
import Map from "./components/Map";
import VideoPlayer from "./components/VideoPlayer";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import HelmetManagementModal from "./components/HelmetManagementModal";
import EmployeeManagementModal from "./components/EmployeeManagementModal";
import UserManagementModal from "./components/UserManagementModal";
import SafetyAnalyticsModal from "./components/SafetyAnalyticsModal";
import CookieConsentBanner from "./components/CookieConsentBanner";
import PrivacyPolicyModal from "./components/PrivacyPolicyModal";
import { dataService } from "./services/dataService";
import { AlertCircle, Bell, X, ArrowLeft, Users as UsersIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>("EMP001");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState<UserRole>("COMPANY_ADMIN");
  const [view, setView] = useState<"HOME" | "MAP">("HOME");
  const [loginError, setLoginError] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Estados dos Modais do Sistema & LGPD
  const [showHelmetModal, setShowHelmetModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [stats, setStats] = useState<SystemStats>({
    signalsToday: 0,
    emergenciesToday: 0,
    activeHelmets: 1,
    disconnectedHelmets: 3,
    systemStatus: "NOMINAL"
  });

  const [activities, setActivities] = useState<RecentActivity[]>([]);

  const [currentUser, setCurrentUser] = useState<UserProfile>({
    firstName: "Admin",
    lastName: "Empresa",
    username: "Gbxm",
    role: "COMPANY_ADMIN",
    cpf: "123.456.789-00",
    position: "Engenheiro de Segurança / Admin",
    department: "Centro de Operações Industriais (COI)",
    email: "gbxm.seguranca@industrial.com",
    phone: "(11) 98765-4321"
  });

  const ws = useRef<WebSocket | null>(null);

  // Carrega lista inicial de funcionários do dataService (Supabase ou Local)
  useEffect(() => {
    const initData = async () => {
      const initialEmps = await dataService.getEmployees();
      if (initialEmps && initialEmps.length > 0) {
        setEmployees(initialEmps);
        const activeCount = initialEmps.filter(e => e.status !== "OFFLINE").length;
        const disconnectedCount = initialEmps.filter(e => e.status === "OFFLINE").length;
        setStats(prev => ({
          ...prev,
          activeHelmets: activeCount,
          disconnectedHelmets: disconnectedCount
        }));
      }
    };
    initData();
  }, []);

  // Sincronização Bidirecional em Tempo Real com Supabase
  // (Atualizações feitas na raiz do Supabase refletem instantaneamente no Safety Monitor)
  useEffect(() => {
    const unsubscribe = dataService.subscribeToRealtime((table, event, record) => {
      console.log(`[Supabase Realtime Sync] Tabela: ${table}, Evento: ${event}`, record);

      if (table === "employees") {
        setEmployees((prev) => {
          if (event === "INSERT") {
            return prev.some(e => e.id === record.id) ? prev : [...prev, record];
          } else if (event === "UPDATE") {
            return prev.map(e => e.id === record.id ? { ...e, ...record } : e);
          } else if (event === "DELETE") {
            return prev.filter(e => e.id !== record.id);
          }
          return prev;
        });
      } else if (table === "users") {
        // Se for atualização do usuário atual, sincronizar permissões RBAC ao vivo
        if (record && record.username === username) {
          if (record.role && record.role !== userRole) {
            setUserRole(record.role);
            setCurrentUser(prev => ({ ...prev, role: record.role }));
          }
        }
      } else if (table === "accident_events" && event === "INSERT") {
        setStats(prev => ({
          ...prev,
          emergenciesToday: prev.emergenciesToday + 1,
          systemStatus: "EMERGENCY"
        }));
        setActivities(prev => [
          {
            id: `realtime-acc-${Date.now()}`,
            title: "Alerta de Impacto (Supabase Cloud)",
            description: `Impacto detectado em ${record.employeeName || "Operador"} (${record.aceleracaoG}g)`,
            timestamp: Date.now(),
            type: "EMERGENCY",
            employeeName: record.employeeName,
            employeeId: record.employeeId
          },
          ...prev.slice(0, 19)
        ]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [username, userRole]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Obter localização do usuário
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "SET_BASE_LOCATION", lat: latitude, lng: longitude }));
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }

    // Suporte a VITE_API_URL para deploy no Vercel.
    const apiBaseUrl = import.meta.env.VITE_API_URL || "";
    let wsUrl: string;
    if (apiBaseUrl) {
      wsUrl = apiBaseUrl.replace(/^http/, "ws").replace(/^https/, "wss");
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      wsUrl = `${protocol}//${host}`;
    }

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        if (userLocation) {
          ws.current?.send(JSON.stringify({ type: "SET_BASE_LOCATION", lat: userLocation[0], lng: userLocation[1] }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.type === "INITIAL_STATE" || message.type === "UPDATE") {
            setEmployees(message.data);
            if (message.stats) {
              setStats(message.stats);
            }
            if (message.activities) {
              setActivities(message.activities);
            }
          }
        } catch (err) {
          console.error("Erro ao processar mensagem do WebSocket", err);
        }
      };
    } catch (e) {
      console.info("WebSocket local não disponível no momento. Operando com dados em cache.");
    }

    return () => {
      ws.current?.close();
    };
  }, [isAuthenticated]);

  const handleLogin = async (user: string, pass: string) => {
    // 1. Tentar autenticação no serviço unificado (Supabase ou LocalStorage)
    const authRes = await dataService.authenticate(user, pass);
    if (authRes.success && authRes.user) {
      setIsAuthenticated(true);
      setUsername(authRes.user.username);
      setUserRole(authRes.role || "COMPANY_ADMIN");
      setCurrentUser(authRes.user);
      setLoginError("");
      return;
    }

    // 2. Fallback para API do servidor backend se estiver rodando
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await response.json();
      if (data.success) {
        setIsAuthenticated(true);
        setUsername(data.user.username);
        setUserRole(data.user.role || "COMPANY_ADMIN");
        if (data.user) {
          setCurrentUser({
            firstName: data.user.firstName || "Admin",
            lastName: data.user.lastName || "User",
            username: data.user.username || user,
            role: data.user.role || "COMPANY_ADMIN",
            cpf: data.user.cpf || "123.456.789-00",
            position: data.user.position || "Engenheiro de Segurança / Admin",
            department: data.user.department || "Centro de Operações Industriais (COI)",
            email: data.user.email || "gbxm.seguranca@industrial.com",
            phone: data.user.phone || "(11) 98765-4321"
          });
        }
        setLoginError("");
        return;
      }
    } catch {}

    setLoginError(authRes.message || "Usuário ou senha incorretos.");
  };

  const handleUpdateUser = async (updated: UserProfile): Promise<boolean> => {
    try {
      await dataService.saveUser(updated);
      setCurrentUser(updated);
      setUsername(updated.username);
      return true;
    } catch {
      return false;
    }
  };

  const handleRegister = async (userData: any) => {
    try {
      await dataService.saveUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        password: userData.password,
        role: "VIEWER",
        cpf: userData.cpf,
        position: userData.position,
        department: userData.department,
        email: userData.email,
        phone: userData.phone,
        active: true
      });
      setAuthView("LOGIN");
      setLoginError("");
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setUserRole("VIEWER");
    setView("HOME");
    setSelectedEmployeeId(null);
  };

  const ignoreEmergency = (employeeId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "IGNORE_EMERGENCY", employeeId }));
    }
  };

  const reloadEmployees = async () => {
    const emps = await dataService.getEmployees();
    setEmployees(emps);
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || null;

  if (!isAuthenticated) {
    if (authView === "REGISTER") {
      return (
        <Register 
          onRegister={handleRegister} 
          onGoBack={() => setAuthView("LOGIN")} 
        />
      );
    }
    return (
      <Login 
        onLogin={handleLogin} 
        onGoToRegister={() => setAuthView("REGISTER")}
        error={loginError} 
      />
    );
  }

  return (
    <>
      {view === "HOME" ? (
        <Dashboard 
          username={username}
          userRole={userRole}
          employees={employees}
          stats={stats}
          activities={activities}
          currentUser={currentUser}
          onNavigateToMap={() => setView("MAP")} 
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          onOpenHelmetModal={() => setShowHelmetModal(true)}
          onOpenEmployeeModal={() => setShowEmployeeModal(true)}
          onOpenUserModal={() => setShowUserModal(true)}
          onOpenAnalyticsModal={() => setShowAnalyticsModal(true)}
          onOpenPrivacyPolicy={() => setShowPrivacyPolicyModal(true)}
        />
      ) : (
        <div className="min-h-screen w-full bg-zinc-950 flex flex-col md:flex-row overflow-x-hidden font-sans">
          {/* Barra Lateral / Sidebar Responsiva */}
          <div className="flex flex-col md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 bg-zinc-900">
            <div className="p-3 bg-zinc-900 flex items-center justify-between border-b border-zinc-800">
              <button 
                onClick={() => setView("HOME")}
                className="text-zinc-400 hover:text-white flex items-center gap-2 transition-colors cursor-pointer text-xs font-bold uppercase tracking-widest p-2 rounded-xl hover:bg-zinc-800"
                aria-label="Voltar para o Painel Principal"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Painel Principal</span>
              </button>

              <button
                onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                className="md:hidden flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800 text-yellow-500 text-xs font-bold"
                aria-label="Alternar lista de operadores"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>Operadores</span>
              </button>
            </div>

            <div className={`md:block ${showMobileSidebar ? "block" : "hidden md:block"}`}>
              <Sidebar 
                employees={employees} 
                selectedEmployeeId={selectedEmployeeId} 
                onSelectEmployee={(id) => {
                  setSelectedEmployeeId(id);
                  setShowMobileSidebar(false);
                }} 
                onIgnoreEmergency={ignoreEmergency}
              />
            </div>
          </div>

          {/* Área Principal de Monitoramento (Mapa + Vídeo + Atividades) com Rolagem Natural */}
          <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
            {/* Mapa ao Vivo */}
            <div className="h-[50vh] min-h-[380px] lg:h-[60vh] relative border-b border-zinc-800 w-full">
              <Map 
                employees={employees} 
                selectedEmployeeId={selectedEmployeeId} 
                onSelectEmployee={setSelectedEmployeeId} 
                userLocation={userLocation}
              />
              
              {/* Map Overlay Controls */}
              <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
                 <div className="bg-zinc-900/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-zinc-800 shadow-2xl">
                    <div className="flex items-center gap-2.5 mb-2">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                         {stats.systemStatus === "EMERGENCY" ? "Alerta de Emergência Ativo" : "Sistema Nominal"}
                       </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                       <div>
                          <div className="text-[9px] text-zinc-500 uppercase font-bold">Capacetes Ativos</div>
                          <div className="text-base font-bold text-zinc-100">{employees.filter(e => e.status !== "OFFLINE").length}</div>
                       </div>
                       <div>
                          <div className="text-[9px] text-zinc-500 uppercase font-bold">Emergências</div>
                          <div className="text-base font-bold text-red-500">{employees.filter(e => e.status === "EMERGENCY").length}</div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Painel Inferior Responsivo: Câmera/Vídeo & Atividades Críticas */}
            <div className="flex-1 flex flex-col lg:flex-row w-full bg-zinc-950">
              <div className="flex-1 p-4 bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-800">
                <VideoPlayer employee={selectedEmployee} />
              </div>
              
              <div className="w-full lg:w-96 bg-zinc-900 p-5 md:p-6 overflow-y-auto max-h-96 lg:max-h-none">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-yellow-500" />
                    Atividades Críticas em Tempo Real
                  </h3>
                </div>
                <div className="space-y-3">
                  {employees.filter(e => e.status === "EMERGENCY" || e.status === "OFFLINE").length === 0 ? (
                    <div className="text-center py-6 text-zinc-600 text-xs italic">
                      Nenhuma atividade crítica registrada no momento.
                    </div>
                  ) : (
                    employees.filter(e => e.status === "EMERGENCY" || e.status === "OFFLINE").map(emp => (
                      <div key={emp.id} className="flex gap-3 items-start border-l-2 border-zinc-800 pl-3 py-1 group">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          emp.status === "EMERGENCY" ? "bg-red-500 animate-pulse" : "bg-zinc-600"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-1">
                            <p className="text-xs font-bold text-zinc-200 truncate">
                              {emp.status === "EMERGENCY" ? "Alerta de Impacto (ESP32)" : "Capacete Desconectado"}
                            </p>
                            {emp.status === "EMERGENCY" && (
                              <button 
                                onClick={() => ignoreEmergency(emp.id)}
                                className="text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700 transition-colors"
                              >
                                Reconhecer
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {emp.name} ({emp.id}) • {new Date().toLocaleTimeString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Modais do Sistema */}
      <HelmetManagementModal
        isOpen={showHelmetModal}
        onClose={() => setShowHelmetModal(false)}
        userRole={userRole}
        employees={employees}
        onRefreshData={reloadEmployees}
      />

      <EmployeeManagementModal
        isOpen={showEmployeeModal}
        onClose={() => setShowEmployeeModal(false)}
        userRole={userRole}
        onRefreshData={reloadEmployees}
      />

      <UserManagementModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        currentUserRole={userRole}
        currentUsername={username}
      />

      <SafetyAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        employees={employees}
      />

      {/* Modal de Política de Privacidade e Diretrizes LGPD */}
      <PrivacyPolicyModal
        isOpen={showPrivacyPolicyModal}
        onClose={() => setShowPrivacyPolicyModal(false)}
      />

      {/* Banner de Gestão de Cookies e Consentimento LGPD */}
      <CookieConsentBanner 
        onOpenPrivacyPolicy={() => setShowPrivacyPolicyModal(true)} 
      />
    </>
  );
}
