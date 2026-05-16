# CryptoOps Engine
**Banexcoin Bolivia · Hackathon 2026 · Desafío 1**

> Sistema de conciliación automática de operaciones cripto y fiat.
> Sube el Excel → el sistema detecta las discrepancias en segundos.

---

## ¿Qué hace este sistema?

El área contable de Banexcoin recibe cada periodo un Excel con miles de transacciones. Hoy las revisan manualmente, fila por fila, para verificar que lo que dice el sistema coincida con lo que registró el banco. Con casi 7,000 transacciones por periodo, eso toma días.

**CryptoOps Engine automatiza ese proceso:**

```
Subes el Excel  →  El sistema cruza los datos  →  Ves exactamente qué no coincide
```

---

## Los 5 tipos de operación (hoja "Servicios" del Excel)

Estos son los servicios que Banexcoin registra y lo que hace cada uno con el saldo del cliente:

| Código | Servicio | Efecto en el saldo |
|--------|----------|--------------------|
| **S-001** | **Pago QR** | Disminuye el saldo del cliente |
| **S-002** | **Cobro QR** | Aumenta el saldo del cliente |
| **S-003** | **Retiros** | Disminuye el saldo del cliente |
| **S-004** | **Depósitos** | Aumenta el saldo del cliente |
| **S-005** | **Banextransfer** | Transferencias entre clientes dentro de Banexcoin |

> **Nota importante:** Los datos contenidos en el archivo Excel son ficticios y fueron generados únicamente para fines demostrativos en el marco del Hackathon 2026. No corresponden a operaciones reales, clientes reales ni transacciones efectivamente realizadas.

---

## ¿Dónde están las alertas y cómo leerlas?

El sistema genera alertas automáticas para **S-001 (Pago QR)** y **S-002 (Cobro QR)**, porque esas hojas contienen un número de transacción que debe coincidir con el extracto bancario. Cuando no coincide, aparece la alerta.

### Qué significa cada color en la pantalla de Conciliación

| Color | Estado | Qué pasó |
|-------|--------|----------|
| 🟢 Verde | `CONCILIADO` | El número de transacción aparece en el sistema QR **y** en el banco, y el monto es igual |
| 🔴 Rojo | `DISCREPANCIA` | El número aparece en ambos lados pero el **monto es diferente** |
| 🟡 Amarillo | `SOLO EN QR` | El número existe en el sistema Banexcoin pero **no aparece en el extracto bancario** |
| 🔵 Azul | `SOLO EN BANCO` | El número aparece en el extracto bancario pero **no existe en el sistema Banexcoin** |

---

## Las 3 comparaciones que hace el sistema

### 1. Pagos QR vs Extracto bancario (S-001)

Cada pago registrado en Banexcoin tiene un número de transacción. Ese mismo número debería aparecer en el extracto bancario. El sistema los cruza y alerta cuando no coinciden.

```
Sistema Banexcoin (S-001)          Extracto del banco
─────────────────────────          ──────────────────
Nro. Transacción  →  cruza con →  Código de transacción
Monto pagado      →  compara  →   Importe en BOB
```

**Resultado en los datos de demostración:**
- 5,325 pagos QR registrados
- 4,063 coinciden con el banco ✔
- **1,262 sin coincidencia → ALERTA** ⚠

**Dónde verlo:** Página **Conciliación** → filtrar por Tipo: `Pago`

---

### 2. Cobros QR vs Extracto bancario (S-002)

Mismo proceso para los cobros. Cada cobro registrado en Banexcoin debe tener su correspondiente registro en el extracto bancario.

```
Sistema Banexcoin (S-002)          Extracto del banco
─────────────────────────          ──────────────────
Nro. Transacción  →  cruza con →  Código de transacción
Importe neto      →  compara  →   Importe en BOB
```

**Resultado en los datos de demostración:**
- 552 cobros QR registrados
- 46 coinciden con el banco ✔
- **506 sin coincidencia → ALERTA** ⚠

**Dónde verlo:** Página **Conciliación** → filtrar por Tipo: `Cobro`

---

### 3. Saldo calculado vs Saldo real por cliente

Para cada cliente, el sistema calcula cuánto debería tener en su cuenta sumando y restando todas sus operaciones, y lo compara contra el saldo que reporta el Excel.

```
Lo que el sistema calcula:
  + Depósitos recibidos     (S-004)
  + Cobros QR recibidos     (S-002)
  + Transfers recibidas     (S-005)
  - Retiros realizados      (S-003)
  - Pagos QR realizados     (S-001)
  - Transfers enviadas      (S-005)
  ═══════════════════════
  = Saldo esperado

Si Saldo esperado ≠ Saldo real → ALERTA ⚠
```

**Dónde verlo:** Página **Saldos** — lista todos los clientes ordenados de mayor a menor discrepancia

---

## Cómo usar el sistema paso a paso

```
1. Abre el sistema en el navegador
         ↓
2. Carga el Excel desde el botón "Cargar Excel" en el Dashboard
         ↓
3. El sistema procesa las 9 hojas automáticamente (tarda unos segundos)
         ↓
4. Dashboard → revisa cuántas discrepancias hay en total
         ↓
5. Conciliación → filtra por "DISCREPANCIA" o "SOLO EN QR" para ver los problemas
         ↓
6. Saldos → revisa qué clientes tienen el saldo sin cuadrar
         ↓
7. Reporte → descarga Excel o PDF para el equipo contable
```

---

## Las 9 hojas del Excel

| Hoja | Código | Qué contiene | Registros |
|------|--------|--------------|-----------|
| Depósitos | S-004 | Entradas de USDT por cliente vía blockchain Tron | 787 |
| Retiros | S-003 | Salidas de USDT, incluye comisión de red | 113 |
| Pago QR | S-001 | Pagos en BOB — tiene Nro. de Transacción para cruzar con banco | 5,325 |
| Cobro QR | S-002 | Cobros en BOB — tiene Nro. de Transacción para cruzar con banco | 552 |
| Transfers | S-005 | Transferencias entre clientes dentro de Banexcoin | 141 |
| Saldos | — | Saldo final real por cliente (DEBE, HABER, neto) | ~1,000 |
| Servicios | — | Catálogo de los 5 tipos de servicio con sus descripciones | 5 |
| EXTRACTO DE PAGOS | Banco | Extracto bancario de pagos en BOB | 5,326 |
| EXTRACTO DE COBROS | Banco | Extracto bancario de cobros en BOB | 497 |

---

## Resultados con los datos de demostración

| Métrica | Valor |
|---------|-------|
| Total transacciones analizadas | 6,918 |
| Conciliadas correctamente | ~5,150 |
| **Alertas generadas** | **1,768** |
| USDT depositados | 187,924 |
| USDT retirados | 28,271 |
| BOB en pagos QR | 1,023,899 |
| BOB en cobros QR | 632,173 |

---

## Instalación y arranque local

### Requisitos
- Python 3.10 o superior
- Node.js 18 o superior

### Pasos

```powershell
# 1. Clonar el repositorio
git clone <url-del-repo>
cd cryptoops-engine

# 2. Instalar dependencias del backend
cd backend
pip install -r requirements.txt

# 3. Instalar dependencias del frontend
cd ../frontend
npm install

# 4. Copiar el Excel a la carpeta data/
# (el backend lo carga automáticamente al arrancar)

# 5. Arrancar todo con un solo comando (Windows)
cd ..
.\start.ps1
```

| Servicio | URL |
|----------|-----|
| Frontend (app) | http://localhost:5173 |
| Backend (API) | http://localhost:8000 |
| Documentación API | http://localhost:8000/docs |

---

## Despliegue en producción (gratis)

| Componente | Plataforma | Costo |
|------------|------------|-------|
| Frontend | Vercel | Gratis |
| Backend | Render | Gratis |
| Base de datos | Supabase | Gratis |

### Backend en Render
1. Crear cuenta en [render.com](https://render.com)
2. New Web Service → conectar el repositorio
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Agregar variables de entorno: `SUPABASE_URL` y `SUPABASE_KEY`

### Frontend en Vercel
1. Crear cuenta en [vercel.com](https://vercel.com)
2. Importar el repositorio → Root directory: `frontend`
3. Framework: Vite
4. Variable de entorno: `VITE_API_URL` = URL del backend en Render

> El sistema funciona sin Supabase configurado. Los datos se guardan en memoria durante la sesión y se pierden al reiniciar el servidor. Para persistencia permanente, configurar Supabase.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + Recharts + React Router |
| Backend | FastAPI (Python) |
| Procesamiento de datos | Pandas + OpenPyXL |
| Base de datos | Supabase (PostgreSQL) — opcional |
| Exportación | XlsxWriter (Excel) + impresión HTML (PDF) |

---

## Notas técnicas

### Fix aplicado: error de bloqueo de archivos en Windows

Al subir un Excel en Windows, el sistema usaba `NamedTemporaryFile` que deja el archivo bloqueado mientras está abierto. Cuando pandas intentaba leerlo y luego el sistema intentaba borrarlo, Windows lanzaba:

```
PermissionError: [WinError 32] El proceso no tiene acceso al archivo
porque está siendo utilizado por otro proceso
```

**Solución en `main.py`:** se reemplazó por `mkstemp` + `os.fdopen`, que cierra el archivo completamente antes de que pandas lo abra, y el `os.unlink` final está protegido con `try/except` por si Windows aún retiene el handle brevemente.

---

*Hackathon Banexcoin Bolivia 2026 · CryptoOps Engine · Desafío 1*
*Datos ficticios generados únicamente para fines demostrativos.*
