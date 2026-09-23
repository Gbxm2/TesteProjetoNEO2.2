import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Inicialização do Supabase para persistência dos dados do ESP32
const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || "").trim();
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes("seu-projeto")) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[Supabase Server] Conexão com banco Supabase configurada com sucesso.");
  } catch (err) {
    console.warn("[Supabase Server] Erro ao conectar ao Supabase:", err);
  }
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses: { name: string; address: string }[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push({ name, address: net.address });
      }
    }
  }
  return addresses;
}

import { Employee, EmployeeTelemetry, SystemStats, RecentActivity } from "./src/types";

// EMP001 ├® o ESP32 real conectado. Os demais representam capacetes cadastrados no sistema atualmente desligados (OFFLINE)
let employees: Employee[] = [
  { id: "EMP001", name: "Gabriel Ara├║jo", lat: -23.5505, lng: -46.6333, status: "ONLINE", lastSeen: Date.now(), battery: 95 },
  { id: "EMP002", name: "Gustavo Felix", lat: -23.5515, lng: -46.6343, status: "OFFLINE", lastSeen: 0, battery: 0 },
  { id: "EMP003", name: "Fabio Akira", lat: -23.5525, lng: -46.6353, status: "OFFLINE", lastSeen: 0, battery: 0 },
  { id: "EMP004", name: "Fabio Pelissari", lat: -23.5535, lng: -46.6363, status: "OFFLINE", lastSeen: 0, battery: 0 },
];

let latestESP32Data: any = null;
let ultimaAtualizacao: string | null = null;
let signalsReceivedToday = 0;
let emergenciesCountToday = 0;
let esp32HasConnected = false;
let recentActivities: RecentActivity[] = [
  {
    id: "init-1",
    title: "Sistema Inicializado",
    description: "Servidor de monitoramento industrial ativo na porta 3000",
    timestamp: Date.now() - 30000,
    type: "INFO"
  }
];

function getSystemStats(): SystemStats {
  const activeCount = employees.filter(e => e.status !== "OFFLINE").length;
  const disconnectedCount = employees.filter(e => e.status === "OFFLINE").length;
  const hasEmergency = employees.some(e => e.status === "EMERGENCY");
  return {
    signalsToday: signalsReceivedToday,
    emergenciesToday: emergenciesCountToday,
    activeHelmets: activeCount,
    disconnectedHelmets: disconnectedCount,
    systemStatus: hasEmergency ? "EMERGENCY" : "NOMINAL"
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ------------------------------------------------------------
  // CIBERSEGURANÇA: CABEÇALHOS DE PROTEÇÃO HTTP (OWASP)
  // ------------------------------------------------------------
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Permite acesso seguro e controlado
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning");
    if (_req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Mitigação simples de Força Bruta / DoS por IP
  const requestRates = new Map<string, { count: number; resetAt: number }>();
  const rateLimit = (maxRequests: number, windowMs: number) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = req.ip || "127.0.0.1";
      const now = Date.now();
      const current = requestRates.get(ip);
      if (!current || now > current.resetAt) {
        requestRates.set(ip, { count: 1, resetAt: now + windowMs });
        return next();
      }
      if (current.count >= maxRequests) {
        return res.status(429).json({ sucesso: false, mensagem: "Taxa limite excedida. Aguarde alguns instantes." });
      }
      current.count++;
      next();
    };
  };
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  interface UserData {
    firstName: string;
    lastName: string;
    username: string;
    cpf: string;
    position: string;
    department: string;
    email: string;
    phone: string;
    password: string;
  }

  const users: UserData[] = [
    { 
      firstName: "Admin", 
      lastName: "User", 
      username: "Gbxm", 
      cpf: "123.456.789-00", 
      position: "Engenheiro de Seguran├ºa / Admin", 
      department: "Centro de Opera├º├Áes Industriais (COI)", 
      email: "gbxm.seguranca@industrial.com", 
      phone: "(11) 98765-4321", 
      password: "123456" 
    }
  ];

  app.post("/api/login", rateLimit(15, 60000), (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      const { password: _, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } else {
      res.status(401).json({ success: false, message: "Usu├írio ou senha incorretos." });
    }
  });

  app.post("/api/user/update", (req, res) => {
    const updated = req.body;
    const userIndex = users.findIndex(u => u.username === updated.username);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updated };
      const { password: _, ...safeUser } = users[userIndex];
      res.json({ success: true, user: safeUser });
    } else {
      res.status(404).json({ success: false, message: "Usu├írio n├úo encontrado." });
    }
  });

  app.post("/api/register", (req, res) => {
    const userData: UserData = req.body;
    if (users.find(u => u.username === userData.username)) {
      return res.status(400).json({ success: false, message: "Nome de usu├írio j├í existe." });
    }
    users.push(userData);
    res.json({ success: true, message: "Usu├írio cadastrado com sucesso." });
  });

  app.get("/api/stats", (_req, res) => {
    res.json(getSystemStats());
  });

  // ============================================================
  // PROCESSAMENTO DE TELEMETRIA DO ESP32
  // ============================================================
  function applyESP32Data(dados: any, clientIp?: string) {
    if (!dados || typeof dados !== "object") return;
    latestESP32Data = dados;
    ultimaAtualizacao = new Date().toISOString();
    signalsReceivedToday++;

    if (!esp32HasConnected) {
      esp32HasConnected = true;
      recentActivities.unshift({
        id: `conn-${Date.now()}`,
        title: "ESP32 Conectado",
        description: `Capacete EMP001 online na rede Wi-Fi (${dados.ip || clientIp || "192.168.0.122"})`,
        timestamp: Date.now(),
        type: "CONNECT",
        employeeId: "EMP001",
        employeeName: "Gabriel Ara├║jo"
      });
      if (recentActivities.length > 20) recentActivities.pop();
    }

    console.log(`\n[ESP32] Pacote #${signalsReceivedToday} recebido em ${ultimaAtualizacao}:`);
    console.log(`  Wifi: ${dados.wifi} | IP: ${dados.ip || clientIp || "N/A"}`);
    console.log(`  Acelera├º├úo: ${dados.aceleracaoG}g | Pico: ${dados.picoG}g | Pontua├º├úo: ${dados.pontuacao}`);
    console.log(`  Impacto: ${dados.impacto} | GPS V├ílido: ${dados.gpsValido} (${dados.latitude}, ${dados.longitude})`);

    // Atualiza os dados do funcion├írio EMP001 (Gabriel Ara├║jo / Gbxm)
    const empIndex = employees.findIndex(e => e.id === "EMP001");
    if (empIndex !== -1) {
      const currentEmp = employees[empIndex];
      const now = Date.now();

      // GPS
      let newLat = currentEmp.lat;
      let newLng = currentEmp.lng;
      const latVal = typeof dados.latitude === "number" ? dados.latitude : parseFloat(dados.latitude);
      const lngVal = typeof dados.longitude === "number" ? dados.longitude : parseFloat(dados.longitude);

      if ((dados.gpsValido === true || dados.gpsValido === "true") && !isNaN(latVal) && !isNaN(lngVal) && (latVal !== 0 || lngVal !== 0)) {
        newLat = latVal;
        newLng = lngVal;
      }

      // Detec├º├úo de impacto real pelo firmware
      const isImpact = dados.impacto === true || dados.impacto === "true" || (Number(dados.pontuacao) >= 60);

      let newStatus = currentEmp.status;
      if (isImpact) {
        newStatus = "EMERGENCY";
        if (currentEmp.status !== "EMERGENCY") {
          emergenciesCountToday++;
          const impactAccId = `ACC-${Date.now()}`;
          recentActivities.unshift({
            id: `imp-${Date.now()}`,
            title: "Alerta de Impacto",
            description: `Impacto detectado: ${parseFloat(dados.aceleracaoG) || 0}g | Pontuação: ${dados.pontuacao}/100`,
            timestamp: Date.now(),
            type: "EMERGENCY",
            employeeId: currentEmp.id,
            employeeName: currentEmp.name
          });
          if (recentActivities.length > 20) recentActivities.pop();

          // Sincroniza evento crítico de acidente no Supabase
          if (supabase) {
            supabase.from("accident_events").insert({
              id: impactAccId,
              timestamp: now,
              employee_id: currentEmp.id,
              employee_name: currentEmp.name,
              aceleracao_g: parseFloat(dados.aceleracaoG) || 0,
              pico_g: parseFloat(dados.picoG) || 0,
              pontuacao: Number(dados.pontuacao) || 0,
              lat: newLat,
              lng: newLng,
              vibracao: dados.vibracao === true || dados.vibracao === "true",
              som: dados.som === true || dados.som === "true",
              acknowledged: false
            }).then(({ error }) => {
              if (error) console.error("[Supabase] Falha ao registrar acidente:", error.message);
              else console.log("[Supabase] Incidente registrado com sucesso no banco de dados!");
            });
          }
        }
      } else if (currentEmp.status !== "EMERGENCY") {
        newStatus = "ONLINE";
      }

      const telemetryData: EmployeeTelemetry = {
        aceleracao: parseFloat(dados.aceleracao) || 0,
        aceleracaoG: parseFloat(dados.aceleracaoG) || 0,
        picoAceleracaoG: parseFloat(dados.picoAceleracaoG) || 0,
        picoG: parseFloat(dados.picoG) || 0,
        pontuacao: Number(dados.pontuacao) || 0,
        pontosMPU: Number(dados.pontosMPU) || 0,
        pontosVibracao: Number(dados.pontosVibracao) || 0,
        pontosSom: Number(dados.pontosSom) || 0,
        vibracao: dados.vibracao === true || dados.vibracao === "true",
        som: dados.som === true || dados.som === "true",
        satelites: Number(dados.satelites) || 0,
        altitude: parseFloat(dados.altitude) || 0,
        hdop: parseFloat(dados.hdop) || 0,
        gpsValido: dados.gpsValido === true || dados.gpsValido === "true",
        mapsUrl: dados.mapsUrl || "",
        wifi: dados.wifi || "CONECTADO",
        ip: dados.ip || clientIp || ""
      };

      employees[empIndex] = {
        ...currentEmp,
        lat: newLat,
        lng: newLng,
        status: newStatus,
        lastSeen: now,
        telemetry: telemetryData
      };

      // Sincroniza posição e status no Supabase a cada 10 pacotes ou em emergência
      if (supabase && (signalsReceivedToday % 10 === 0 || isImpact)) {
        supabase.from("employees").update({
          lat: newLat,
          lng: newLng,
          status: newStatus,
          last_seen: now,
          battery: currentEmp.battery
        }).eq("id", currentEmp.id).then(({ error }) => {
          if (error) console.error("[Supabase] Erro ao atualizar operador:", error.message);
        });
      }

      // Notifica todos os clientes conectados instantaneamente via WebSocket
      broadcastUpdate();
    }
  }

  // ============================================================
  // ROTAS DA API ESP32 (DADOS REAIS DOS SENSORES)
  // ============================================================
  app.post("/api/dados", (req, res) => {
    applyESP32Data(req.body, req.ip);
    res.status(200).json({
      sucesso: true,
      mensagem: "Dados recebidos com sucesso pelo monitor."
    });
  });

  app.get("/api/dados", (_req, res) => {
    if (!latestESP32Data) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Ainda n├úo existem dados do ESP32."
      });
    }
    res.json(latestESP32Data);
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      api: "online",
      esp32Conectado: latestESP32Data !== null,
      ultimaAtualizacao
    });
  });

  app.get("/api/interfaces", (_req, res) => {
    res.json({
      interfaces: getLocalIpAddresses(),
      port: PORT,
      endpoint: "/api/dados"
    });
  });

  // ============================================================
  // SUPORTE A POLLING ESP32 (MODO BUSCA ATIVA)
  // ============================================================
  let pollingEsp32Ip = process.env.ESP32_IP || "";
  let pollingInterval: NodeJS.Timeout | null = null;

  function startEsp32Polling(targetIp: string) {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingEsp32Ip = targetIp.trim();
    if (!pollingEsp32Ip) return;

    const authUser = process.env.ESP32_AUTH_USER || "Gbxm";
    const authPass = process.env.ESP32_AUTH_PASS || "Gbxm#1853";
    const authHeader = "Basic " + Buffer.from(`${authUser}:${authPass}`).toString("base64");
    console.log(`[ESP32 Polling] Iniciando busca periódica segura em http://${pollingEsp32Ip}/dados...`);

    pollingInterval = setInterval(async () => {
      try {
        const url = `http://${pollingEsp32Ip}/dados`;
        const resp = await fetch(url, {
          headers: { Authorization: authHeader },
          signal: AbortSignal.timeout(2000)
        });
        if (resp.ok) {
          const data = await resp.json();
          applyESP32Data(data, pollingEsp32Ip);
        }
      } catch {
        // Silencioso se o ESP32 estiver offline/desconectado momentaneamente
      }
    }, 2000);
  }

  if (pollingEsp32Ip) {
    startEsp32Polling(pollingEsp32Ip);
  }

  app.post("/api/esp32/polling", (req, res) => {
    const { ip } = req.body;
    if (ip) {
      startEsp32Polling(ip);
      res.json({ sucesso: true, mensagem: `Polling configurado para ${ip}` });
    } else {
      if (pollingInterval) clearInterval(pollingInterval);
      pollingEsp32Ip = "";
      res.json({ sucesso: true, mensagem: "Polling desativado." });
    }
  });

  app.get("/api/esp32/polling", (_req, res) => {
    res.json({
      ativo: Boolean(pollingEsp32Ip),
      ip: pollingEsp32Ip
    });
  });

  // Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // WebSocket logic
  wss.on("connection", (ws) => {
    console.log("Client connected");
    
    // Send initial state with real-time stats and recent activities
    ws.send(JSON.stringify({ 
      type: "INITIAL_STATE", 
      data: employees,
      stats: getSystemStats(),
      activities: recentActivities
    }));

    ws.on("message", (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        if (parsed.type === "IGNORE_EMERGENCY") {
          const empId = parsed.employeeId;
          employees = employees.map(emp => 
            emp.id === empId && emp.status === "EMERGENCY" 
              ? { ...emp, status: "ONLINE", lastSeen: Date.now() } 
              : emp
          );
          recentActivities.unshift({
            id: `ign-${Date.now()}`,
            title: "Emerg├¬ncia Reconhecida",
            description: `Alerta do operador ${empId} desativado manualmente pelo usu├írio`,
            timestamp: Date.now(),
            type: "INFO",
            employeeId: empId
          });
          if (recentActivities.length > 20) recentActivities.pop();
          broadcastUpdate();
        } else if (parsed.type === "SET_BASE_LOCATION") {
          const { lat, lng } = parsed;
          // Set base location around user if GPS hasn't updated EMP001 yet
          employees = employees.map((emp) => {
            if (emp.id === "EMP001" && emp.telemetry?.gpsValido) {
              return emp; // Manter GPS real
            }
            return {
              ...emp,
              lat: lat + (Math.random() - 0.5) * 0.005,
              lng: lng + (Math.random() - 0.5) * 0.005,
            };
          });
          broadcastUpdate();
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    });

    ws.on("close", () => console.log("Client disconnected"));
  });

  function broadcastUpdate() {
    const updateMsg = JSON.stringify({ 
      type: "UPDATE", 
      data: employees,
      stats: getSystemStats(),
      activities: recentActivities
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(updateMsg);
      }
    });
  }

  // Heartbeat loop: apenas monitora perda de sinal (sem movimenta├º├úo ou emerg├¬ncia aleat├│ria)
  setInterval(() => {
    let changed = false;
    const now = Date.now();

    employees = employees.map((emp) => {
      const timeSinceLastSeen = now - emp.lastSeen;
      let newStatus = emp.status;

      // Se n├úo estiver em emerg├¬ncia ativa, atualiza status por perda de conex├úo
      if (emp.status !== "EMERGENCY") {
        if (timeSinceLastSeen > 30000 && emp.status !== "OFFLINE") {
          newStatus = "OFFLINE";
          changed = true;
        } else if (timeSinceLastSeen > 15000 && emp.status !== "UNSTABLE" && emp.status !== "OFFLINE") {
          newStatus = "UNSTABLE";
          changed = true;
        }
      }

      return {
        ...emp,
        status: newStatus
      };
    });

    if (changed) {
      broadcastUpdate();
    }
  }, 3000);

  httpServer.listen(PORT, "0.0.0.0", () => {
    const ips = getLocalIpAddresses();
    console.log("\n============================================================");
    console.log("       INDUSTRIAL SAFETY MONITOR - SERVIDOR ATIVO");
    console.log("============================================================");
    console.log(`Porta: ${PORT}`);
    console.log(`Painel Web Local:       http://localhost:${PORT}`);
    if (ips.length > 0) {
      console.log("\nAcesso pelo Navegador na Rede:");
      ips.forEach(ip => {
        console.log(`  - [${ip.name}] http://${ip.address}:${PORT}`);
      });
      console.log("\n-> Configure no ESP32 (Codigo_Teste_API.ino):");
      ips.forEach(ip => {
        console.log(`   const char* apiURL = "http://${ip.address}:${PORT}/api/dados";`);
      });
    }
    console.log(`\nStatus da API:          http://localhost:${PORT}/api/status`);
    console.log("============================================================\n");
  });
}

startServer();
