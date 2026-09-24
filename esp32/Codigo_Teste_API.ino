#include <WiFi.h>
#include <WebServer.h>
#include <Update.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>

// ============================================================
// CONFIGURAÇÕES WI-FI
// ============================================================

const char* ssid = "Carlos Ara_EXT";
const char* password = "OLI24130";

// ============================================================
// LOGIN DO PAINEL WEB EMBARCADO
// ============================================================

const char* webUsername = "Gbxm";
const char* webPassword = "Gbxm#1853";

// ============================================================
// SENHA OTA
// ============================================================

const char* updatePassword = "Gbxm#1853";

// ============================================================
// HOSTNAME
// ============================================================

const char* hostname = "ESP32-SENSORES";

// ============================================================
// SERVIDOR WEB
// ============================================================

WebServer server(80);

// ============================================================
// API EXTERNA (SERVIDOR LOCAL / TUNEL VERCEL)
// ============================================================

// Endereço do endpoint do servidor local (porta 3000)
const char* apiURL = "http://192.168.0.109:3000/api/dados";

const unsigned long INTERVALO_API = 1000;
unsigned long ultimoEnvioAPI = 0;

// ============================================================
// PINOS DOS SENSORES DIGITAIS
// ============================================================

// Sensor de vibração SW-420 (GPIO 5)
const int sensorPin = 5;

// Sensor de som FC-04 (GPIO 23)
const int soundSensorPin = 23;
const int SOM_ATIVO = LOW; // Na maioria dos módulos FC-04, LOW indica som detectado

// ============================================================
// MPU6050 & BARRAMENTO I2C (AUTO-DETECÇÃO DE PINOS)
// ============================================================

Adafruit_MPU6050 mpu;

// Pinos padrão do ESP32 (SDA=21, SCL=22) e alternativos (18, 19)
#define I2C_SDA_PADRAO 21
#define I2C_SCL_PADRAO 22
#define I2C_SDA_ALT    18
#define I2C_SCL_ALT    19

bool mpuConectado = false;
uint8_t mpuEndereco = 0x68;
int pinoSDA_Ativo = I2C_SDA_PADRAO;
int pinoSCL_Ativo = I2C_SCL_PADRAO;

// ============================================================
// GPS NEO-6M
// ============================================================

TinyGPSPlus gps;
HardwareSerial GPS_Serial(2);

#define GPS_RX 16
#define GPS_TX 17

const unsigned long INTERVALO_GPS = 30000;
unsigned long ultimaLeituraGPS = 0;

// ============================================================
// CONTROLE GERAL & VARIÁVEIS DE TELEMETRIA
// ============================================================

bool detectar = true;

// MPU6050 - Aceleração Linear
float aceleracaoTotal = 9.81;
float aceleracaoG = 1.00;
float picoAceleracaoG = 1.00; // Pico vitalício desde o boot

// MPU6050 - Giroscópio (Velocidade Angular em Graus/s)
float giroscopioGraus = 0.0;
float picoGiroscopio = 0.0;

// Sensores Digitais
bool vibracaoDetectada = false;
bool somDetectado = false;
bool impactoDetectado = false;

// ============================================================
// SISTEMA AVANÇADO DE DETECÇÃO & PONTUAÇÃO DE IMPACTO
// ============================================================

int pontuacaoImpacto = 0;
int pontosMPU = 0;
int pontosGiro = 0;
int pontosVibracao = 0;
int pontosSom = 0;

// Limites clínicos e operacionais
const float LIMITE_INICIO_DELTA_G = 1.5;     // Delta G acima da gravidade (Total > 2.5G)
const float LIMITE_INICIO_GIRO = 180.0;     // Graus/s de rotação brusca
const float LIMITE_IMPACTO_FORTE_G = 12.0;  // 12G: Impacto crítico imediato
const float LIMITE_GIRO_FORTE = 600.0;      // 600°/s: Rotação crítica imediata (Risco de concussão)
const int   LIMITE_PONTUACAO_EMERGENCIA = 60; // 60/100 dispara alarme de impacto

const unsigned long JANELA_IMPACTO = 200;       // Janela de integração multisensorial (200 ms)
const unsigned long TEMPO_EXIBICAO_IMPACTO = 3000;// Duração do alerta ativo (3 segundos)
const unsigned long COOLDOWN_IMPACTO = 1500;    // Tempo entre eventos para evitar repiques

// Controle do evento em avaliação
bool avaliandoImpacto = false;
unsigned long inicioAvaliacao = 0;
unsigned long ultimoImpacto = 0;
unsigned long impactoExibirAte = 0;

float picoEventoG = 0.0;
float picoEventoGiro = 0.0;
int   contagemPulsosVibracao = 0;
bool  somConfirmadoNoEvento = false;

// Frequência de amostragem do MPU6050 (aproximadamente 200 Hz)
const unsigned long INTERVALO_MPU = 5;
unsigned long ultimaLeituraMPU = 0;

// ============================================================
// BUFFER DE LOGS
// ============================================================

#define MAX_LOGS 50
String logs[MAX_LOGS];
int logCount = 0;

// ============================================================
// PROTEÇÃO CONTRA FORÇA BRUTA NO LOGIN WEB
// ============================================================

#define MAX_TENTATIVAS 5
#define TEMPO_BLOQUEIO 300000UL // 5 minutos

struct TentativaLogin {
  IPAddress ip;
  int tentativas;
  unsigned long bloqueadoAte;
  bool usado;
};

#define MAX_IPS_BLOQUEADOS 8
TentativaLogin tentativas[MAX_IPS_BLOQUEADOS];

// Headers OTA
const char* headerKeys[] = { "X-OTA-Password" };
const size_t headerKeysCount = 1;

// ============================================================
// FUNÇÕES AUXILIARES DE LOG E SEGURANÇA
// ============================================================

void adicionarLog(String mensagem) {
  Serial.println(mensagem);
  if (logCount < MAX_LOGS) {
    logs[logCount] = mensagem;
    logCount++;
  } else {
    for (int i = 0; i < MAX_LOGS - 1; i++) {
      logs[i] = logs[i + 1];
    }
    logs[MAX_LOGS - 1] = mensagem;
  }
}

int encontrarIP(IPAddress ip) {
  for (int i = 0; i < MAX_IPS_BLOQUEADOS; i++) {
    if (tentativas[i].usado && tentativas[i].ip == ip) return i;
  }
  return -1;
}

int criarRegistroIP(IPAddress ip) {
  for (int i = 0; i < MAX_IPS_BLOQUEADOS; i++) {
    if (!tentativas[i].usado) {
      tentativas[i].ip = ip;
      tentativas[i].tentativas = 0;
      tentativas[i].bloqueadoAte = 0;
      tentativas[i].usado = true;
      return i;
    }
  }
  return -1;
}

bool ipBloqueado(IPAddress ip) {
  int indice = encontrarIP(ip);
  if (indice == -1) return false;
  if (tentativas[indice].bloqueadoAte == 0) return false;
  if (millis() >= tentativas[indice].bloqueadoAte) {
    tentativas[indice].bloqueadoAte = 0;
    tentativas[indice].tentativas = 0;
    return false;
  }
  return true;
}

void registrarFalhaLogin(IPAddress ip) {
  int indice = encontrarIP(ip);
  if (indice == -1) indice = criarRegistroIP(ip);
  if (indice == -1) return;
  tentativas[indice].tentativas++;
  Serial.print("Falha de login - IP: ");
  Serial.println(ip);
  if (tentativas[indice].tentativas >= MAX_TENTATIVAS) {
    tentativas[indice].bloqueadoAte = millis() + TEMPO_BLOQUEIO;
    Serial.print("IP bloqueado por 5 minutos: ");
    Serial.println(ip);
  }
}

void loginSucesso(IPAddress ip) {
  int indice = encontrarIP(ip);
  if (indice == -1) return;
  tentativas[indice].tentativas = 0;
  tentativas[indice].bloqueadoAte = 0;
}

bool autenticar() {
  IPAddress ip = server.client().remoteIP();
  if (ipBloqueado(ip)) {
    server.send(429, "text/plain", "IP temporariamente bloqueado por excesso de tentativas.");
    return false;
  }
  if (!server.hasHeader("Authorization")) {
    server.requestAuthentication();
    return false;
  }
  if (!server.authenticate(webUsername, webPassword)) {
    registrarFalhaLogin(ip);
    server.requestAuthentication();
    return false;
  }
  loginSucesso(ip);
  return true;
}

// ============================================================
// INICIALIZAÇÃO ROBUSTA COM AUTO-SCAN DO MPU6050
// ============================================================

bool testarI2CEndereco(int sda, int scl, uint8_t endereco) {
  Wire.end();
  delay(20);
  Wire.setPins(sda, scl);
  Wire.begin(sda, scl);
  Wire.setClock(100000);
  Wire.setTimeOut(50);

  Wire.beginTransmission(endereco);
  return (Wire.endTransmission() == 0);
}

bool inicializarMPU6050() {
  Serial.println("[MPU6050] Iniciando escaneamento do barramento I2C...");

  // 1. Tentar pinos padrão ESP32 (SDA=21, SCL=22)
  if (testarI2CEndereco(I2C_SDA_PADRAO, I2C_SCL_PADRAO, 0x68)) {
    if (mpu.begin(0x68, &Wire)) {
      pinoSDA_Ativo = I2C_SDA_PADRAO;
      pinoSCL_Ativo = I2C_SCL_PADRAO;
      mpuEndereco = 0x68;
      mpuConectado = true;
      return true;
    }
  }
  if (testarI2CEndereco(I2C_SDA_PADRAO, I2C_SCL_PADRAO, 0x69)) {
    if (mpu.begin(0x69, &Wire)) {
      pinoSDA_Ativo = I2C_SDA_PADRAO;
      pinoSCL_Ativo = I2C_SCL_PADRAO;
      mpuEndereco = 0x69;
      mpuConectado = true;
      return true;
    }
  }

  // 2. Tentar pinos alternativos (SDA=18, SCL=19)
  if (testarI2CEndereco(I2C_SDA_ALT, I2C_SCL_ALT, 0x68)) {
    if (mpu.begin(0x68, &Wire)) {
      pinoSDA_Ativo = I2C_SDA_ALT;
      pinoSCL_Ativo = I2C_SCL_ALT;
      mpuEndereco = 0x68;
      mpuConectado = true;
      return true;
    }
  }
  if (testarI2CEndereco(I2C_SDA_ALT, I2C_SCL_ALT, 0x69)) {
    if (mpu.begin(0x69, &Wire)) {
      pinoSDA_Ativo = I2C_SDA_ALT;
      pinoSCL_Ativo = I2C_SCL_ALT;
      mpuEndereco = 0x69;
      mpuConectado = true;
      return true;
    }
  }

  mpuConectado = false;
  return false;
}

// ============================================================
// MÁQUINA DE ESTADOS: AVALIAÇÃO DE IMPACTO MULTISSENSORIAL
// ============================================================

void iniciarAvaliacaoImpacto() {
  if (avaliandoImpacto) return;
  if (millis() - ultimoImpacto < COOLDOWN_IMPACTO) return;

  avaliandoImpacto = true;
  inicioAvaliacao = millis();

  picoEventoG = aceleracaoG;
  picoEventoGiro = giroscopioGraus;
  contagemPulsosVibracao = vibracaoDetectada ? 1 : 0;
  somConfirmadoNoEvento = false;

  Serial.println();
  Serial.println(">>> [IMPACT ENGINE] INÍCIO DA AVALIAÇÃO MULTISSENSORIAL <<<");
}

void finalizarAvaliacaoImpacto() {
  avaliandoImpacto = false;

  // 1. Pontuação Linear (MPU6050) - Choque físico direto (Até 45 pontos)
  // Subtrai gravidade estática de 1.0G para avaliar apenas a componente dinâmica
  float deltaG = (picoEventoG > 1.0f) ? (picoEventoG - 1.0f) : 0.0f;
  if (deltaG < 1.0f) {
    pontosMPU = 0;
  } else if (deltaG >= 11.0f) {
    pontosMPU = 45; // Máximo para choques >= 12G totais
  } else {
    pontosMPU = (int)map((long)(deltaG * 10), 10, 110, 10, 45);
  }

  // 2. Pontuação Rotacional (Giroscópio MPU6050) - Concussão / Torção angular (Até 25 pontos)
  if (picoEventoGiro < 150.0f) {
    pontosGiro = 0;
  } else if (picoEventoGiro >= 600.0f) {
    pontosGiro = 25;
  } else {
    pontosGiro = (int)map((long)picoEventoGiro, 150, 600, 5, 25);
  }

  // 3. Pontuação de Vibração Estrutural (SW-420) - Impacto mecânico no casco (Até 20 pontos)
  if (contagemPulsosVibracao <= 0) {
    pontosVibracao = 0;
  } else if (contagemPulsosVibracao >= 10) {
    pontosVibracao = 20;
  } else {
    pontosVibracao = (int)map(contagemPulsosVibracao, 1, 10, 10, 20);
  }

  // 4. Pontuação Acústica (FC-04) - Validação por onda de som (Até 10 pontos)
  // IMPORTANTE: Só pontua se houver impacto mecânico (vibração ou aceleração alta) para filtrar ruídos fabris
  if (somConfirmadoNoEvento && (contagemPulsosVibracao > 0 || deltaG >= 1.5f)) {
    pontosSom = 10;
  } else {
    pontosSom = 0;
  }

  // Pontuação Total Combinada (0 a 100)
  pontuacaoImpacto = constrain(pontosMPU + pontosGiro + pontosVibracao + pontosSom, 0, 100);

  // Critério de impacto relevante (Emergência)
  bool impactoRelevante = (pontuacaoImpacto >= LIMITE_PONTUACAO_EMERGENCIA) ||
                          (picoEventoG >= LIMITE_IMPACTO_FORTE_G) ||
                          (picoEventoGiro >= LIMITE_GIRO_FORTE);

  impactoDetectado = impactoRelevante;

  if (impactoRelevante) {
    impactoExibirAte = millis() + TEMPO_EXIBICAO_IMPACTO;
    ultimoImpacto = millis();

    adicionarLog("========================================");
    adicionarLog("ALERTA: IMPACTO RELEVANTE DETECTADO!");
    adicionarLog("Pontuacao Final: " + String(pontuacaoImpacto) + "/100");
    adicionarLog("Pico Aceleracao: " + String(picoEventoG, 2) + " G (Pontos: " + String(pontosMPU) + ")");
    adicionarLog("Pico Giroscopio: " + String(picoEventoGiro, 1) + " deg/s (Pontos: " + String(pontosGiro) + ")");
    adicionarLog("Vibracao SW-420: " + String(contagemPulsosVibracao) + " pulsos (Pontos: " + String(pontosVibracao) + ")");
    adicionarLog("Som FC-04 Validado: " + String(pontosSom > 0 ? "SIM" : "NAO") + " (Pontos: " + String(pontosSom) + ")");
    adicionarLog("========================================");
  } else {
    adicionarLog("Evento descartado (ruido/batida leve). Pontuacao: " + String(pontuacaoImpacto) + "/100");
  }

  // Reset para a próxima avaliação
  contagemPulsosVibracao = 0;
  somConfirmadoNoEvento = false;
}

// ============================================================
// PROCESSAMENTO CONTÍNUO DOS SENSORES
// ============================================================

void processarSensores() {
  if (!detectar) return;

  unsigned long agora = millis();

  // Leitura do sensor de vibração SW-420
  int estadoVibracao = digitalRead(sensorPin);
  vibracaoDetectada = (estadoVibracao == HIGH);

  // Leitura do sensor de som FC-04
  int estadoSom = digitalRead(soundSensorPin);
  somDetectado = (estadoSom == SOM_ATIVO);

  // Leitura e amostragem do MPU6050 (Aceleração e Giroscópio)
  if (agora - ultimaLeituraMPU >= INTERVALO_MPU) {
    ultimaLeituraMPU = agora;

    if (mpuConectado) {
      sensors_event_t a, g, temp;
      if (mpu.getEvent(&a, &g, &temp)) {
        // Validação contra leituras corrompidas do I2C
        if (a.acceleration.x != 0.0f || a.acceleration.y != 0.0f || a.acceleration.z != 0.0f) {
          // Aceleração total vetorial em m/s²
          aceleracaoTotal = sqrt(
            a.acceleration.x * a.acceleration.x +
            a.acceleration.y * a.acceleration.y +
            a.acceleration.z * a.acceleration.z
          );

          // Conversão para Força G (1G = 9.80665 m/s²)
          aceleracaoG = aceleracaoTotal / 9.80665f;

          // Velocidade angular total do giroscópio em graus por segundo (°/s)
          giroscopioGraus = sqrt(
            g.gyro.x * g.gyro.x +
            g.gyro.y * g.gyro.y +
            g.gyro.z * g.gyro.z
          ) * 57.2957795f;

          // Atualização do pico vitalício desde a inicialização
          if (aceleracaoG > picoAceleracaoG) {
            picoAceleracaoG = aceleracaoG;
          }
          if (giroscopioGraus > picoGiroscopio) {
            picoGiroscopio = giroscopioGraus;
          }
        }
      }
    }

    // Se já está na janela de avaliação de impacto (200 ms)
    if (avaliandoImpacto) {
      if (aceleracaoG > picoEventoG) {
        picoEventoG = aceleracaoG;
      }
      if (giroscopioGraus > picoEventoGiro) {
        picoEventoGiro = giroscopioGraus;
      }
      if (vibracaoDetectada) {
        contagemPulsosVibracao++;
      }
      if (somDetectado) {
        somConfirmadoNoEvento = true;
      }

      // Se atingir impacto severo imediatamente, finaliza sem esperar
      if (picoEventoG >= LIMITE_IMPACTO_FORTE_G || picoEventoGiro >= LIMITE_GIRO_FORTE) {
        finalizarAvaliacaoImpacto();
        return;
      }

      // Finaliza a janela de 200 ms
      if (agora - inicioAvaliacao >= JANELA_IMPACTO) {
        finalizarAvaliacaoImpacto();
        return;
      }
    } else {
      // Gatilho de início de novo evento
      float deltaG = fabs(aceleracaoG - 1.0f);
      if (deltaG >= LIMITE_INICIO_DELTA_G ||
          giroscopioGraus >= LIMITE_INICIO_GIRO ||
          vibracaoDetectada) {
        iniciarAvaliacaoImpacto();
      }
    }
  }

  // Mantém estado de alerta visível durante o período configurado
  if (impactoDetectado && millis() > impactoExibirAte) {
    impactoDetectado = false;
  }
}

// ============================================================
// GERAÇÃO DO PAYLOAD JSON DE TELEMETRIA
// ============================================================

String gerarJSONDados() {
  String json = "{";
  json += ""wifi":"" + String(WiFi.status() == WL_CONNECTED ? "CONECTADO" : "DESCONECTADO") + "",";
  json += ""ip":"" + WiFi.localIP().toString() + "",";
  json += ""detectar":" + String(detectar ? "true" : "false") + ",";
  json += ""aceleracao":" + String(aceleracaoTotal, 2) + ",";
  json += ""aceleracaoG":" + String(aceleracaoG, 2) + ",";
  json += ""picoAceleracaoG":" + String(picoAceleracaoG, 2) + ",";
  json += ""picoG":" + String(picoEventoG, 2) + ",";
  json += ""giroscopioGraus":" + String(giroscopioGraus, 1) + ",";
  json += ""picoGiroscopio":" + String(picoGiroscopio, 1) + ",";
  json += ""pontuacao":" + String(pontuacaoImpacto) + ",";
  json += ""pontosMPU":" + String(pontosMPU) + ",";
  json += ""pontosGiro":" + String(pontosGiro) + ",";
  json += ""pontosVibracao":" + String(pontosVibracao) + ",";
  json += ""pontosSom":" + String(pontosSom) + ",";
  json += ""avaliando":" + String(avaliandoImpacto ? "true" : "false") + ",";
  json += ""impacto":" + String(impactoDetectado ? "true" : "false") + ",";
  json += ""vibracao":" + String(vibracaoDetectada ? "true" : "false") + ",";
  json += ""som":" + String(somDetectado ? "true" : "false") + ",";
  json += ""gpsValido":" + String(gps.location.isValid() ? "true" : "false") + ",";

  if (gps.location.isValid()) {
    json += ""latitude":" + String(gps.location.lat(), 6) + ",";
    json += ""longitude":" + String(gps.location.lng(), 6) + ",";
    json += ""altitude":" + String(gps.altitude.meters(), 2) + ",";
    json += ""satelites":" + String(gps.satellites.value()) + ",";
    json += ""hdop":" + String(gps.hdop.hdop(), 2) + ",";
    json += ""mapsUrl":"https://www.google.com/maps?q=" + String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6) + "",";
  } else {
    json += ""latitude":0,";
    json += ""longitude":0,";
    json += ""altitude":0,";
    json += ""satelites":0,";
    json += ""hdop":0,";
    json += ""mapsUrl":"",";
  }

  json += ""log":"";
  for (int i = 0; i < logCount; i++) {
    String linha = logs[i];
    linha.replace("\\", "\\\\");
    linha.replace(""", "\\"");
    linha.replace("\n", "\\n");
    linha.replace("\r", "");
    json += linha;
    if (i < logCount - 1) json += "\\n";
  }
  json += """;
  json += "}";

  return json;
}

// ============================================================
// TRANSMISSÃO PARA A API (KEEP-ALIVE NÃO BLOQUEANTE)
// ============================================================

void enviarDadosAPI() {
  if (WiFi.status() != WL_CONNECTED) return;

  unsigned long agora = millis();
  if (agora - ultimoEnvioAPI < INTERVALO_API) return;
  ultimoEnvioAPI = agora;

  String json = gerarJSONDados();

  HTTPClient http;
  http.begin(apiURL);
  http.setReuse(true); // Otimização Keep-Alive para evitar handshake repetido
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(800); // Timeout rápido para nunca travar a leitura dos sensores

  int codigoHTTP = http.POST(json);
  if (codigoHTTP > 0) {
    if (codigoHTTP == 200 || codigoHTTP == 201) {
      // Pacote entregue com sucesso
    } else {
      Serial.print("API HTTP retorno: ");
      Serial.println(codigoHTTP);
    }
  } else {
    // Falha silenciosa ou log
  }
  http.end();
}

// ============================================================
// PÁGINA HTML DO PAINEL WEB EMBARCADO
// ============================================================

String paginaHTML() {
  String html = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Industrial Safety Monitor - ESP32</title>
<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0c; color: #fff; }
.container { max-width: 1000px; margin: auto; padding: 20px; }
h1 { text-align: center; color: #eab308; margin-bottom: 25px; }
.card { background: #16161a; border: 1px solid #27272a; border-radius: 14px; padding: 20px; margin-bottom: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
.status { font-size: 15px; margin: 8px 0; color: #a1a1aa; }
.status strong { color: #f4f4f5; }
.score { font-size: 42px; font-weight: 800; text-align: center; margin: 15px 0; font-family: monospace; }
.relevante { color: #ef4444; }
.normal { color: #22c55e; }
.alerta { color: #eab308; }
button { padding: 10px 18px; margin: 5px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.2s; }
.start { background: #22c55e; color: #000; }
.stop { background: #ef4444; color: #fff; }
.statusBtn { background: #3b82f6; color: #fff; }
.clear { background: #3f3f46; color: #fff; }
.update { background: #a855f7; color: #fff; }
.log { background: #000; padding: 15px; border-radius: 8px; height: 220px; overflow-y: auto; font-family: monospace; font-size: 13px; color: #4ade80; border: 1px solid #27272a; white-space: pre-wrap; }
.gps-valid { color: #22c55e; font-weight: bold; }
.gps-invalid { color: #ef4444; font-weight: bold; }
.maps { display: inline-block; padding: 10px 18px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px; }
.progress { width: 100%; background: #27272a; border-radius: 8px; overflow: hidden; margin-top: 10px; }
.progress-bar { width: 0%; height: 16px; background: #a855f7; transition: 0.2s; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
@media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="container">
<h1>ESP32 Industrial Safety Monitor</h1>

<div class="card">
  <h2>Status da Conexão</h2>
  <div class="status">Wi-Fi: <strong id="wifi">---</strong> | IP Local: <strong id="ip">---</strong></div>
  <div class="status">Barramento I2C: <strong id="i2cInfo">---</strong></div>
</div>

<div class="card">
  <h2>Controle de Aquisição</h2>
  <div class="status">Detecção Ativa: <strong id="detectar">---</strong></div>
  <button class="start" onclick="comando('INICIAR')">INICIAR</button>
  <button class="stop" onclick="comando('PARAR')">PARAR</button>
  <button class="statusBtn" onclick="comando('STATUS')">STATUS</button>
</div>

<div class="card">
  <h2>Resultado da Análise de Impacto</h2>
  <div id="score" class="score normal">0 / 100</div>
  <div class="status">Status Geral: <strong id="statusImpacto">NORMAL</strong></div>
  <div class="status">Pico do Evento: <strong id="picoG">0.00</strong> G</div>
</div>

<div class="grid-2">
  <div class="card">
    <h2>Acelerômetro MPU6050</h2>
    <div class="status">Aceleração Atual: <strong id="aceleracaoG">0.00</strong> G (<span id="aceleracao">0.00</span> m/s²)</div>
    <div class="status">Pico Máximo Registrado: <strong id="picoAceleracaoG" style="color: #eab308;">0.00</strong> G</div>
    <div class="status">Pontuação Aceleração: <strong id="pontosMPU">0</strong> / 45</div>
  </div>

  <div class="card">
    <h2>Giroscópio MPU6050</h2>
    <div class="status">Velocidade Angular: <strong id="giroscopioGraus">0.0</strong> °/s</div>
    <div class="status">Pico Angular: <strong id="picoGiroscopio" style="color: #38bdf8;">0.0</strong> °/s</div>
    <div class="status">Pontuação Giroscópio: <strong id="pontosGiro">0</strong> / 25</div>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <h2>Vibração Estrutural (SW-420)</h2>
    <div class="status">Vibração: <strong id="vibracao">NORMAL</strong></div>
    <div class="status">Pontos: <strong id="pontosVibracao">0</strong> / 20</div>
  </div>

  <div class="card">
    <h2>Sensor de Som (FC-04)</h2>
    <div class="status">Som: <strong id="som">NORMAL</strong></div>
    <div class="status">Pontos: <strong id="pontosSom">0</strong> / 10</div>
  </div>
</div>

<div class="card">
  <h2>GPS NEO-6M</h2>
  <div class="status">Estado: <span id="gpsEstado">---</span></div>
  <div class="status">Latitude: <strong id="latitude">---</strong> | Longitude: <strong id="longitude">---</strong></div>
  <div class="status">Satélites: <strong id="satelites">---</strong> | Altitude: <strong id="altitude">---</strong> m</div>
  <a id="maps" class="maps" href="#" target="_blank">Abrir no Google Maps</a>
</div>

<div class="card">
  <h2>Terminal de Logs</h2>
  <div id="log" class="log">Carregando...</div>
  <br>
  <button class="clear" onclick="limparLog()">LIMPAR LOG</button>
</div>

<div class="card">
  <h2>Atualização Remota (OTA)</h2>
  <input type="file" id="firmware" accept=".bin"><br>
  <button class="update" onclick="atualizarFirmware()">ATUALIZAR FIRMWARE</button>
  <div class="progress"><div id="progressBar" class="progress-bar"></div></div>
</div>

</div>

<script>
function atualizarDados() {
  fetch('/dados')
  .then(response => response.json())
  .then(data => {
    document.getElementById('wifi').innerText = data.wifi;
    document.getElementById('ip').innerText = data.ip;
    document.getElementById('detectar').innerText = data.detectar ? 'ATIVA' : 'PARADA';
    
    document.getElementById('aceleracao').innerText = (data.aceleracao || 0).toFixed(2);
    document.getElementById('aceleracaoG').innerText = (data.aceleracaoG || 0).toFixed(2);
    document.getElementById('picoAceleracaoG').innerText = (data.picoAceleracaoG || 0).toFixed(2);
    document.getElementById('picoG').innerText = (data.picoG || 0).toFixed(2);
    
    if (document.getElementById('giroscopioGraus')) {
      document.getElementById('giroscopioGraus').innerText = (data.giroscopioGraus || 0).toFixed(1);
    }
    if (document.getElementById('picoGiroscopio')) {
      document.getElementById('picoGiroscopio').innerText = (data.picoGiroscopio || 0).toFixed(1);
    }
    if (document.getElementById('pontosGiro')) {
      document.getElementById('pontosGiro').innerText = data.pontosGiro || 0;
    }

    document.getElementById('pontosMPU').innerText = data.pontosMPU;
    document.getElementById('pontosVibracao').innerText = data.pontosVibracao;
    document.getElementById('pontosSom').innerText = data.pontosSom;

    document.getElementById('vibracao').innerText = data.vibracao ? 'DETECTADA' : 'ESTÁVEL';
    document.getElementById('som').innerText = data.som ? 'DETECTADO' : 'NORMAL';

    const score = document.getElementById('score');
    const status = document.getElementById('statusImpacto');
    score.innerText = data.pontuacao + ' / 100';

    if (data.impacto) {
      score.className = 'score relevante';
      status.innerText = 'IMPACTO RELEVANTE / EMERGÊNCIA';
      status.className = 'relevante';
    } else if (data.pontuacao >= 35) {
      score.className = 'score alerta';
      status.innerText = 'ATENÇÃO / SOLAVANCO LEVE';
      status.className = 'alerta';
    } else {
      score.className = 'score normal';
      status.innerText = data.avaliando ? 'ANALISANDO EVENTO...' : 'NORMAL';
      status.className = 'normal';
    }

    document.getElementById('latitude').innerText = data.latitude;
    document.getElementById('longitude').innerText = data.longitude;
    document.getElementById('altitude').innerText = data.altitude;
    document.getElementById('satelites').innerText = data.satelites;

    const gpsEstado = document.getElementById('gpsEstado');
    if (data.gpsValido) {
      gpsEstado.innerText = 'LOCALIZAÇÃO VÁLIDA';
      gpsEstado.className = 'gps-valid';
      document.getElementById('maps').href = data.mapsUrl;
      document.getElementById('maps').style.display = 'inline-block';
    } else {
      gpsEstado.innerText = 'AGUARDANDO SINAL GPS';
      gpsEstado.className = 'gps-invalid';
      document.getElementById('maps').style.display = 'none';
    }

    document.getElementById('log').innerText = data.log;
  })
  .catch(error => console.log('Erro ao atualizar telemetria:', error));
}

function comando(cmd) {
  fetch('/comando?acao=' + cmd).then(() => atualizarDados());
}

function limparLog() {
  fetch('/limparlog').then(() => atualizarDados());
}

function atualizarFirmware() {
  const arquivo = document.getElementById('firmware').files[0];
  if (!arquivo) { alert('Selecione um arquivo .bin'); return; }
  const senha = prompt('Digite a senha de atualização OTA:');
  if (!senha) return;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/update', true);
  xhr.setRequestHeader('X-OTA-Password', senha);
  xhr.upload.addEventListener('progress', function(e) {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total) * 100;
      document.getElementById('progressBar').style.width = pct + '%';
    }
  });
  xhr.onload = function() {
    if (xhr.status === 200) alert('Atualização concluída. Reiniciando o ESP32...');
    else alert('Erro na atualização: ' + xhr.responseText);
  };
  xhr.send(arquivo);
}

setInterval(atualizarDados, 500);
atualizarDados();
</script>
</body>
</html>
)rawliteral";
  return html;
}

// ============================================================
// HANDLERS DO SERVIDOR WEB EMBARCADO
// ============================================================

void handleRoot() {
  if (!autenticar()) return;
  server.send(200, "text/html", paginaHTML());
}

void handleDados() {
  if (!autenticar()) return;
  server.send(200, "application/json", gerarJSONDados());
}

void handleComando() {
  if (!autenticar()) return;
  if (!server.hasArg("acao")) {
    server.send(400, "text/plain", "Comando não informado.");
    return;
  }
  String acao = server.arg("acao");
  if (acao == "INICIAR") {
    detectar = true;
    adicionarLog("Sistema de detecção INICIADO.");
    server.send(200, "text/plain", "Deteccao iniciada.");
  } else if (acao == "PARAR") {
    detectar = false;
    vibracaoDetectada = false;
    somDetectado = false;
    impactoDetectado = false;
    avaliandoImpacto = false;
    pontuacaoImpacto = 0;
    picoEventoG = 0;
    adicionarLog("Sistema de detecção PARADO.");
    server.send(200, "text/plain", "Deteccao parada.");
  } else if (acao == "STATUS") {
    String status = "Detecção: " + String(detectar ? "ATIVA" : "PARADA") +
                    "\nIP: " + WiFi.localIP().toString() +
                    "\nAceleração: " + String(aceleracaoG, 2) + " G" +
                    "\nPontuação: " + String(pontuacaoImpacto) + "/100";
    server.send(200, "text/plain", status);
  } else {
    server.send(400, "text/plain", "Comando desconhecido.");
  }
}

void handleLimparLog() {
  if (!autenticar()) return;
  logCount = 0;
  server.send(200, "text/plain", "Log limpo.");
}

void handleUpdate() {
  HTTPUpload& upload = server.upload();
  if (server.header("X-OTA-Password") != updatePassword) {
    if (upload.status == UPLOAD_FILE_START) {
      Serial.println("OTA: senha incorreta.");
    }
    return;
  }
  if (upload.status == UPLOAD_FILE_START) {
    Serial.printf("OTA iniciando: %s\n", upload.filename.c_str());
    if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) Update.printError(Serial);
  } else if (upload.status == UPLOAD_FILE_END) {
    if (Update.end(true)) Serial.printf("OTA concluída: %u bytes\n", upload.totalSize);
    else Update.printError(Serial);
  }
}

void handleUpdateResult() {
  if (server.header("X-OTA-Password") != updatePassword) {
    server.send(401, "text/plain", "Senha OTA incorreta.");
    return;
  }
  if (Update.hasError()) {
    server.send(500, "text/plain", "Falha na atualização OTA.");
  } else {
    server.send(200, "text/plain", "Atualização concluída. Reiniciando...");
    delay(1000);
    ESP.restart();
  }
}

// ============================================================
// ATUALIZAÇÃO DO GPS NEO-6M
// ============================================================

void atualizarGPS() {
  while (GPS_Serial.available() > 0) {
    gps.encode(GPS_Serial.read());
  }

  if (millis() - ultimaLeituraGPS >= INTERVALO_GPS) {
    ultimaLeituraGPS = millis();
    Serial.println();
    Serial.println("========== LOCALIZACAO GPS ==========");
    if (gps.location.isValid()) {
      Serial.printf("Latitude: %.6f | Longitude: %.6f\n", gps.location.lat(), gps.location.lng());
      Serial.printf("Satélites: %d | HDOP: %.2f | Altitude: %.2f m\n",
                    gps.satellites.value(), gps.hdop.hdop(), gps.altitude.meters());
    } else {
      Serial.println("Aguardando satélites / localização válida...");
    }
    Serial.println("=====================================");
  }
}

// ============================================================
// SETUP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=================================");
  Serial.println("   INDUSTRIAL SAFETY MONITOR");
  Serial.println("  ESP32 SENSOR SYSTEM FIRMWARE   ");
  Serial.println("=================================");

  // Inicializa proteção de tentativas de login
  for (int i = 0; i < MAX_IPS_BLOQUEADOS; i++) {
    tentativas[i].usado = false;
    tentativas[i].tentativas = 0;
    tentativas[i].bloqueadoAte = 0;
  }

  // Configura pinos dos sensores digitais
  pinMode(sensorPin, INPUT);
  pinMode(soundSensorPin, INPUT);

  // Inicialização com auto-detecção do MPU6050
  if (inicializarMPU6050()) {
    mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_260_HZ);

    Serial.printf("[MPU6050] Conectado no endereço 0x%02X (SDA: GPIO %d | SCL: GPIO %d)\n",
                  mpuEndereco, pinoSDA_Ativo, pinoSCL_Ativo);
    adicionarLog("MPU6050 Ativo em 0x" + String(mpuEndereco, HEX) + " (SDA=" + String(pinoSDA_Ativo) + ", SCL=" + String(pinoSCL_Ativo) + ")");
  } else {
    Serial.println("[MPU6050] AVISO: Sensor não encontrado nos pinos 21/22 nem 18/19.");
    Serial.println("[MPU6050] Verifique conexões VCC (3.3V), GND, SDA e SCL.");
    adicionarLog("ERRO: MPU6050 nao encontrado no barramento I2C.");
  }

  // Inicializa GPS NEO-6M na porta Serial 2
  GPS_Serial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.printf("[GPS] NEO-6M iniciado (RX: GPIO %d, TX: GPIO %d)\n", GPS_RX, GPS_TX);

  // Conexão Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostname);
  Serial.println();
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("=================================");
  Serial.println("        WIFI CONECTADO");
  Serial.println("=================================");
  Serial.print("IP DO ESP32: ");
  Serial.println(WiFi.localIP());
  Serial.print("PAINEL WEB:  http://");
  Serial.println(WiFi.localIP());
  Serial.println("=================================");

  // Configura rotas do servidor web embarcado
  server.collectHeaders(headerKeys, headerKeysCount);
  server.on("/", HTTP_GET, handleRoot);
  server.on("/dados", HTTP_GET, handleDados);
  server.on("/comando", HTTP_GET, handleComando);
  server.on("/limparlog", HTTP_GET, handleLimparLog);
  server.on("/update", HTTP_POST, handleUpdateResult, handleUpdate);

  server.begin();
  Serial.println("Servidor Web Embarcado iniciado na porta 80.");

  adicionarLog("Firmware v3.1 carregado com sucesso.");
  adicionarLog("IP Local: " + WiFi.localIP().toString());
  adicionarLog("Algoritmo de Impacto Multissensorial ATIVO.");
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================

void loop() {
  // 1. Processa requisições HTTP do painel web embarcado
  server.handleClient();

  // 2. Transmite telemetria ao vivo para a API do monitor (1 Hz)
  enviarDadosAPI();

  // 3. Atualiza coordenadas do GPS
  atualizarGPS();

  // 4. Processa leituras de alta frequência dos sensores (MPU6050, SW-420, FC-04)
  processarSensores();
}
