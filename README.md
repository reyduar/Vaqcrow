# Vaqcrow 🐮

**Misión:** Democratizar la inversión en Latam conectando pequeños inversores con PyMEs tradicionales mediante *Revenue Share Crowdfunding*, utilizando tecnología blockchain (Stellar) para garantizar transparencia, eficiencia y custodia descentralizada. 
**Lema:** *"Juntos podemos hacernos grandes"*.

---

## 1. Resumen Ejecutivo y Reglas de Negocio
Vaqcrow es una plataforma Fintech web (desarrollada en Next.js) que permite a comercios de barrio y PyMEs financiarse sin los intereses asfixiantes de los bancos. 

* **Modelo de Inversión (Revenue Share):** Los inversores fondean un proyecto a cambio de un porcentaje de las ventas mensuales de la PyME, mitigando el riesgo de quiebra por cuotas fijas (si venden más, pagan más; si venden menos, pagan menos).
* **Modelo de Confianza Híbrido:** Para asegurar el cumplimiento, se combinan dos capas:
  1. *Capa Tecnológica:* Reporte de ventas mensual (manual en V1, automatizado en el futuro) que calcula automáticamente el monto a pagar.
  2. *Capa Legal/Penalización:* Contrato de financiamiento participativo firmado. En caso de no reportar o quebrar injustificadamente, se activa un bloqueo de reputación (Score) y sanciones sobre garantías prendarias previas.
* **Flujo de Capital:** Inversión en pesos (Fiat) ➔ Conversión vía Anchor a `USDC` ➔ Bloqueo en contrato inteligente (Stellar) ➔ Liberación a PyME ➔ Repago en Fiat ➔ Distribución automática de `USDC` a inversores.
* **Monetización:** 
  * *Success Fee:* Comisión (3% al 5%) cobrada a la PyME sobre el capital total levantado al cumplir la meta.
  * *Spread de Cash-out:* Pequeño margen en la rampa de conversión de cripto a fiat.

---

## 2. Stack Tecnológico
* **Frontend:** Next.js (Web-first, Mobile-responsive), Tailwind CSS, componentes unificados para futura app React Native.
* **Backend & Base de Datos:** Supabase (PostgreSQL, Auth, Storage para documentos).
* **Lógica Serverless:** Supabase Edge Functions (para orquestación y firmas seguras).
* **Infraestructura Blockchain:** Stellar Network SDK (Cuentas multifirma, Assets personalizados, Path Payments).
* **Inteligencia Artificial:** Modelo de recomendación de IA (AI Score) para clasificar el riesgo de cada PyME.

---

## 3. Identidad Visual y UI/UX (Estilo Nubank)
* **Concepto:** Minimalista, tipografías Sans-Serif audaces, uso estratégico de espacios en blanco y bordes redondeados.
* **Colores Core:**
  * **Brand/Accent:** Morado Vibrante (`#8A05BE`) para botones, CTAs y barras de progreso.
  * **Light Mode:** Fondo Blanco Nieve (`#FFFFFF`), Cards Gris Suave (`#F5F5F5`), Texto Principal Negro Mate (`#111111`), Texto Secundario Gris (`#666666`).
  * **Dark Mode:** Fondo Negro (`#111111`), Cards Carbón (`#1F1F1F` / `#272727`), Texto Principal Blanco (`#FFFFFF`), Texto Secundario Gris Claro (`#A0A0A0`).

---

## 4. Módulos y Sub-sistemas (Monorepo)

1. **SignIn y SignUp:** Login unificado permitiendo registro con Google Account o Email/Password. Seguridad obligatoria con 2FA para validación y operaciones.
2. **Hero Page (Landing):** Motor de marketing. Explicación del sistema dual (Inversor/Emprendedor), los beneficios del Revenue Share, la transparencia de Stellar, y el CTA principal para registrarse. 
3. **Onboarding y Tokenización:** Flujo de KYC. El emprendedor carga sus datos, documentos legales y la ficha de su proyecto. Se emite el token representante en la red Stellar.
4. **Marketplace (Explorar):** Buscador principal y grilla de PyMEs. Incluye filtros y ordenamiento basado en el **AI Score** de riesgo. Tarjetas con fotos, meta de recaudación y retorno estimado.
5. **Detalle de PyME:** Pantalla de conversión. Toda la historia, justificación de los fondos, proyecciones y el botón primario de "Invertir".
6. **Billetera de Inversores (Dashboard):** Visualización del portafolio, saldo en Fiat/USDC, tokens adquiridos, gráficos de rendimiento, notificaciones y carga/retiro de saldo.
7. **Panel de Administración (Backoffice):** Pantalla exclusiva para dueños de Vaqcrow. Gestión de KYC manual, auditoría de reportes de ventas, configuración de la Landing Page y visualización de métricas de la plataforma.

---

## 5. Modelo de Datos (Esquema SQL en Supabase)

```sql
-- TABLA USUARIOS (Gestionado en gran parte por auth.users de Supabase)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  rol TEXT CHECK (rol IN ('INVERSOR', 'PYME', 'ADMIN')),
  stellar_wallet_id TEXT,
  es_2fa_activo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA PERFIL PYME
CREATE TABLE perfiles_pyme (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES perfiles(id),
  nombre_comercio TEXT NOT NULL,
  descripcion TEXT,
  estado_kyc TEXT CHECK (estado_kyc IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  ai_score_riesgo INTEGER
);

-- TABLA PROYECTOS
CREATE TABLE proyectos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pyme_id UUID REFERENCES perfiles_pyme(id),
  titulo TEXT NOT NULL,
  meta_recaudacion DECIMAL NOT NULL,
  porcentaje_retorno_ventas DECIMAL NOT NULL,
  stellar_asset_code TEXT UNIQUE,
  estado TEXT CHECK (estado IN ('RECAUDANDO', 'ACTIVO', 'FINALIZADO'))
);

-- TABLA INVERSIONES
CREATE TABLE inversiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES perfiles(id),
  proyecto_id UUID REFERENCES proyectos(id),
  monto_invertido DECIMAL NOT NULL,
  tx_hash_stellar TEXT,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA REPORTES DE VENTA (MVP)
CREATE TABLE reportes_venta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id UUID REFERENCES proyectos(id),
  monto_declarado DECIMAL NOT NULL,
  monto_a_pagar DECIMAL NOT NULL,
  comprobante_url TEXT,
  estado_pago TEXT CHECK (estado_pago IN ('PENDIENTE', 'PAGADO')),
  mes_reportado TIMESTAMP WITH TIME ZONE
);
```

---

## 6. Diagramas UML de Arquitectura

### A. Diagrama de Casos de Uso
```mermaid
flowchart LR
    Inversor([Inversor])
    PyME([Usuario PyME])
    Admin([Administrador Vaqcrow])

    subgraph Plataforma Vaqcrow Web
        auth[Registro / Login 2FA]
        explorar[Explorar Marketplace / AI Score]
        invertir[Invertir en Proyecto]
        billetera[Ver Portafolio y Ganancias]
        
        kyc[Completar KYC y Crear Proyecto]
        reportar[Reportar Ventas Mensuales]
        pagar[Pagar Cuota Fiat]
        
        aprobarKYC[Aprobar KYC y Proyectos]
        gestionar[Gestionar Usuarios y Plataforma]
    end

    Inversor --> auth
    Inversor --> explorar
    Inversor --> invertir
    Inversor --> billetera

    PyME --> auth
    PyME --> kyc
    PyME --> reportar
    PyME --> pagar

    Admin --> aprobarKYC
    Admin --> gestionar
```

### B. Diagrama de Procesos (Flujo de Vida del Proyecto)
```mermaid
stateDiagram-v2
    [*] --> PublicacionProyecto: PyME aprobada por Admin
    PublicacionProyecto --> Recaudacion: Marketplace Activo
    
    Recaudacion --> MetaAlcanzada: 100% Fondeado
    Recaudacion --> MetaNoAlcanzada: Tiempo Expirado
    
    MetaNoAlcanzada --> DevolucionFondos: Reembolso USDC
    DevolucionFondos --> [*]
    
    MetaAlcanzada --> EmisionTokens: Stellar crea Asset (VaqToken)
    EmisionTokens --> TransferenciaPyME: Capital a la PyME
    
    TransferenciaPyME --> OperacionMensual: PyME trabaja
    OperacionMensual --> ReporteVentas: Fin de mes (PyME declara ventas)
    
    ReporteVentas --> DepositoFiat: PyME transfiere a Vaqcrow
    DepositoFiat --> RepartoGanancias: Stellar distribuye USDC a inversores
    
    RepartoGanancias --> OperacionMensual: Repite hasta cancelar deuda
    RepartoGanancias --> [*]: Deuda Cancelada (Exit)
```

### C. Diagrama de Secuencia (Flujo de Inversión)
```mermaid
sequenceDiagram
    actor Inversor
    participant NextJS as Frontend (Next.js)
    participant Supabase as Backend (Auth/DB)
    participant Edge as Edge Functions
    participant Stellar as Blockchain Stellar

    Inversor->>NextJS: Clic en "Invertir $1000" (PyME X)
    NextJS->>Supabase: Valida sesión, 2FA y balance Fiat
    Supabase-->>NextJS: Validación Exitosa
    NextJS->>Edge: Trigger de Inversión
    Edge->>Stellar: Convierte Fiat a USDC vía Anchor
    Stellar-->>Edge: USDC Disponible
    Edge->>Stellar: Ejecuta Smart Contract (Compra Token X)
    Stellar-->>Edge: Tx Hash Confirmado
    Edge->>Supabase: Registra inversión en BD
    Supabase-->>Edge: Registro OK
    Edge-->>NextJS: Retorna Éxito
    NextJS-->>Inversor: Notificación de Éxito / Actualiza Billetera
```

### D. Diagrama de Componentes (Arquitectura General)
```mermaid
flowchart TB
    Inversor[Navegador Inversor]
    PyME[Navegador PyME]
    Admin[Navegador Admin]

    subgraph Vercel [Vercel - Frontend Hosting]
        NextApp[Next.js App Web]
        NextAdmin[Next.js Admin Panel]
    end

    subgraph Supabase [Supabase - BaaS]
        Auth[Auth Service + 2FA]
        DB[(PostgreSQL)]
        Storage[Storage KYC / Imágenes]
        Edge[Edge Functions]
    end

    subgraph Externos [Servicios Externos]
        Stellar[Stellar Network / Soroban]
        FiatRamp[API Anchor / Banco Local]
        AI[API de IA]
    end

    Inversor <--> NextApp
    PyME <--> NextApp
    Admin <--> NextAdmin

    NextApp <--> Auth
    NextApp <--> DB
    NextApp <--> Storage
    NextApp <--> Edge

    NextAdmin <--> DB
    NextAdmin <--> Auth
    NextAdmin <--> Storage

    Edge <--> Stellar
    Edge <--> FiatRamp
    Edge <--> AI
```
