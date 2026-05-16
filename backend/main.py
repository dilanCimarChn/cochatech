import io
import os
import tempfile
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import pandas as pd

import database
import loader
import reconciler

app = FastAPI(
    title="CryptoOps Engine",
    description="Motor de conciliación automática de operaciones cripto y fiat — Banexcoin Bolivia",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store (populated on upload, persisted to Supabase when configured)
_store: dict = {
    "depositos": [],
    "retiros": [],
    "pago_qr": [],
    "cobro_qr": [],
    "transfers": [],
    "saldos": [],
    "extracto_pagos": [],
    "extracto_cobros": [],
    "conciliacion_pagos": [],
    "conciliacion_cobros": [],
    "saldos_resultado": [],
    "saldos_bob": [],
    "metricas": {},
    "loaded": False,
}


def _print_normalized(key: str, rows: list, n: int = 3):
    print(f"\n--- {key} ({len(rows)} registros) ---")
    if not rows:
        print("  (vacío)")
        return
    for i, row in enumerate(rows[:n]):
        print(f"  [{i}] {row}")


def _process_excel(file_path: str):
    sheets = loader.load_excel(file_path)

    _store["depositos"] = loader.normalize_depositos(sheets.get("depositos", pd.DataFrame()))
    _store["retiros"] = loader.normalize_retiros(sheets.get("retiros", pd.DataFrame()))
    _store["pago_qr"] = loader.normalize_pago_qr(sheets.get("pago_qr", pd.DataFrame()))
    _store["cobro_qr"] = loader.normalize_cobro_qr(sheets.get("cobro_qr", pd.DataFrame()))
    _store["transfers"] = loader.normalize_transfers(sheets.get("transfers", pd.DataFrame()))
    _store["saldos"] = loader.normalize_saldos(sheets.get("saldos", pd.DataFrame()))
    _store["extracto_pagos"] = loader.normalize_extracto_pagos(sheets.get("extracto_pagos", pd.DataFrame()))
    _store["extracto_cobros"] = loader.normalize_extracto_cobros(sheets.get("extracto_cobros", pd.DataFrame()))

    print("\n========== DATOS NORMALIZADOS ==========")
    for key in ["depositos", "retiros", "pago_qr", "cobro_qr", "transfers", "saldos", "extracto_pagos", "extracto_cobros"]:
        _print_normalized(key, _store[key])
    print("========================================\n")

    _store["saldos_bob"] = reconciler.reconcile_saldos_bob(
        _store["pago_qr"], _store["cobro_qr"]
    )
    _store["conciliacion_pagos"] = reconciler.reconcile_pagos(
        _store["pago_qr"], _store["extracto_pagos"]
    )
    _store["conciliacion_cobros"] = reconciler.reconcile_cobros(
        _store["cobro_qr"], _store["extracto_cobros"]
    )
    _store["saldos_resultado"] = reconciler.reconcile_saldos(
        _store["depositos"],
        _store["retiros"],
        _store["pago_qr"],
        _store["cobro_qr"],
        _store["transfers"],
        _store["saldos"],
    )
    _store["metricas"] = reconciler.compute_metricas(
        _store["conciliacion_pagos"],
        _store["conciliacion_cobros"],
        _store["depositos"],
        _store["retiros"],
        _store["pago_qr"],
        _store["cobro_qr"],
    )
    _store["loaded"] = True

    def _print_conciliacion(nombre, registros):
        solo_qr  = [r for r in registros if r["estado"] == "SOLO_EN_QR"]
        solo_ban = [r for r in registros if r["estado"] == "SOLO_EN_BANCO"]
        disc     = [r for r in registros if r["estado"] == "DISCREPANCIA"]
        conc     = [r for r in registros if r["estado"] == "CONCILIADO"]
        print(f"\n{'='*50}")
        print(f"  CONCILIACION: {nombre}")
        print(f"{'='*50}")
        print(f"  Conciliados              : {len(conc)}")
        print(f"  Alertas en Sistema NO Banco : {len(solo_qr)}")
        print(f"  Alertas en Banco NO Sistema : {len(solo_ban)}")
        print(f"  Discrepancias de monto   : {len(disc)}")

        errores = solo_qr + solo_ban + disc
        if not errores:
            print("  Conciliacion perfecta. No hay discrepancias.")
        else:
            print(f"\n  {'Transaccion Id':<20} {'Monto Sistema':>14} {'Monto Banco':>12} {'Estado'}")
            print(f"  {'-'*20} {'-'*14} {'-'*12} {'-'*14}")
            for r in errores[:10]:
                mq = f"{r['monto_qr']:,.2f}"  if r["monto_qr"]  is not None else "—"
                mb = f"{r['monto_banco']:,.2f}" if r["monto_banco"] is not None else "—"
                print(f"  {str(r['transaccion_id']):<20} {mq:>14} {mb:>12}  {r['estado']}")
            if len(errores) > 10:
                print(f"  ... y {len(errores)-10} registros más")

    _print_conciliacion("PAGO QR vs EXTRACTO BANCARIO",  _store["conciliacion_pagos"])
    _print_conciliacion("COBRO QR vs EXTRACTO BANCARIO", _store["conciliacion_cobros"])

    # Saldo por cliente (DEBE / HABER / SALDO) — igual que el notebook Colab
    debe_map:  dict = {}
    haber_map: dict = {}
    name_map:  dict = {}

    for r in _store["pago_qr"]:
        k = str(r.get("numero_cuenta", ""))
        if k:
            debe_map[k]  = debe_map.get(k, 0) + (r.get("monto_pagado") or 0)
            name_map[k]  = r.get("creado_por", "")
    for r in _store["retiros"]:
        k = str(r.get("account_id", ""))
        if k:
            debe_map[k]  = debe_map.get(k, 0) + (r.get("crypto_quantity") or 0)
            name_map[k]  = r.get("account_name", "")
    for r in _store["cobro_qr"]:
        k = str(r.get("numero_cuenta", ""))
        if k:
            haber_map[k] = haber_map.get(k, 0) + (r.get("monto_pagado") or 0)
            name_map[k]  = r.get("creado_por", "")
    for r in _store["depositos"]:
        k = str(r.get("account_id", ""))
        if k:
            haber_map[k] = haber_map.get(k, 0) + (r.get("crypto_quantity") or 0)
            name_map[k]  = r.get("account_name", "")

    todas = sorted(set(debe_map) | set(haber_map))
    saldos_tabla = [
        {
            "Cuenta": k,
            "Cliente": name_map.get(k, ""),
            "DEBE":  round(debe_map.get(k, 0), 2),
            "HABER": round(haber_map.get(k, 0), 2),
            "SALDO FINAL": round(haber_map.get(k, 0) - debe_map.get(k, 0), 2),
        }
        for k in todas
    ]
    saldos_tabla.sort(key=lambda x: x["Cliente"])

    print(f"\n{'='*50}")
    print(f"  ESTADO DE CUENTA (DEBE, HABER, SALDO)")
    print(f"{'='*50}")
    print(f"  {'Cuenta':<12} {'Cliente':<22} {'DEBE':>12} {'HABER':>12} {'SALDO FINAL':>12}")
    print(f"  {'-'*12} {'-'*22} {'-'*12} {'-'*12} {'-'*12}")
    for row in saldos_tabla[:15]:
        print(f"  {row['Cuenta']:<12} {row['Cliente'][:22]:<22} {row['DEBE']:>12,.2f} {row['HABER']:>12,.2f} {row['SALDO FINAL']:>12,.2f}")
    if len(saldos_tabla) > 15:
        print(f"  ... y {len(saldos_tabla)-15} clientes más")
    print(f"\n  Total clientes  : {len(saldos_tabla)}")
    print(f"  Total DEBE      : {sum(r['DEBE']  for r in saldos_tabla):>12,.2f}")
    print(f"  Total HABER     : {sum(r['HABER'] for r in saldos_tabla):>12,.2f}")
    print(f"  Saldo neto      : {sum(r['SALDO FINAL'] for r in saldos_tabla):>12,.2f}")
    print(f"{'='*50}\n")

    # Persist to Supabase if configured
    for table, key in [
        ("depositos", "depositos"),
        ("retiros", "retiros"),
        ("pago_qr", "pago_qr"),
        ("cobro_qr", "cobro_qr"),
        ("transfers", "transfers"),
        ("extracto_pagos", "extracto_pagos"),
        ("extracto_cobros", "extracto_cobros"),
    ]:
        database.upsert_batch(table, _store[key])


_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
_LAST_UPLOAD = os.path.join(_DATA_DIR, "last_upload.xlsx")
_BANEXCOIN   = os.path.join(_DATA_DIR, "Reportes_Banexcoin_Bolivia_Hackaton_2026.xlsx")

def _autoload():
    """On startup, reload the last uploaded file so data survives server restarts."""
    for path in [_LAST_UPLOAD, _BANEXCOIN]:
        if os.path.exists(path):
            try:
                _process_excel(path)
                print(f"[CryptoOps] Auto-cargado: {os.path.basename(path)}")
                return
            except Exception as e:
                print(f"[CryptoOps] No se pudo cargar {os.path.basename(path)}: {e}")

_autoload()


@app.get("/")
def root():
    return {"message": "CryptoOps Engine API", "loaded": _store["loaded"]}


@app.get("/debug/columnas")
def debug_columnas():
    """Muestra las columnas detectadas en cada hoja — útil para diagnosticar el Excel."""
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")
    info = {}
    for key in ["pago_qr", "cobro_qr", "extracto_pagos", "extracto_cobros", "depositos", "retiros", "saldos"]:
        sample = _store.get(key, [])
        if sample:
            info[key] = {
                "columnas": list(sample[0].keys()),
                "filas_total": len(sample),
                "ejemplo_tid": sample[0].get("transaccion_id", sample[0].get("codigo_transaccion", "N/A")),
            }
        else:
            info[key] = {"columnas": [], "filas_total": 0}
    return info


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos Excel (.xlsx, .xls) o CSV")

    content = await file.read()
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)
        _process_excel(tmp_path)
        # Persist so the server can reload after restart without re-uploading
        os.makedirs(_DATA_DIR, exist_ok=True)
        with open(_LAST_UPLOAD, "wb") as f:
            f.write(content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error procesando el archivo: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    metricas = _store["metricas"]
    return {
        "ok": True,
        "resumen": {
            "depositos": len(_store["depositos"]),
            "retiros": len(_store["retiros"]),
            "pago_qr": len(_store["pago_qr"]),
            "cobro_qr": len(_store["cobro_qr"]),
            "transfers": len(_store["transfers"]),
            "extracto_pagos": len(_store["extracto_pagos"]),
            "extracto_cobros": len(_store["extracto_cobros"]),
            "discrepancias": metricas.get("discrepancias", 0) + metricas.get("solo_en_qr", 0) + metricas.get("solo_en_banco", 0),
        },
    }


@app.get("/metricas")
def get_metricas():
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados. Use POST /upload primero.")
    return _store["metricas"]


def _paginar(data: list, page: int, page_size: int) -> dict:
    total = len(data)
    start = (page - 1) * page_size
    end = start + page_size
    slice_ = data[start:end]
    numerados = [{"nro": start + i + 1, **r} for i, r in enumerate(slice_)]
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "data": numerados,
    }


@app.get("/conciliacion/pagos")
def get_conciliacion_pagos(
    estado: Optional[str] = Query(None, description="CONCILIADO|DISCREPANCIA|SOLO_EN_QR|SOLO_EN_BANCO"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["conciliacion_pagos"]
    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]

    return _paginar(data, page, page_size)


@app.get("/conciliacion/cobros")
def get_conciliacion_cobros(
    estado: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["conciliacion_cobros"]
    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]

    return _paginar(data, page, page_size)


@app.get("/conciliacion")
def get_conciliacion_all(
    estado: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None, description="pago|cobro"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["conciliacion_pagos"] + _store["conciliacion_cobros"]

    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]
    if tipo:
        data = [r for r in data if r["tipo"] == tipo.lower()]

    return _paginar(data, page, page_size)


@app.get("/saldos")
def get_saldos(
    estado: Optional[str] = Query(None, description="CONCILIADO|DISCREPANCIA"),
    buscar: Optional[str] = Query(None, description="Buscar por account_id o account_name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["saldos_resultado"]

    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]
    if buscar:
        q = buscar.lower()
        data = [
            r for r in data
            if q in str(r.get("account_id", "")).lower() or q in str(r.get("account_name", "")).lower()
        ]

    return _paginar(data, page, page_size)


@app.get("/saldos/bob")
def get_saldos_bob(
    buscar: Optional[str] = Query(None, description="Buscar por numero_cuenta o cliente"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["saldos_bob"]

    if buscar:
        q = buscar.lower()
        data = [
            r for r in data
            if q in str(r.get("numero_cuenta", "")).lower() or q in str(r.get("cliente", "")).lower()
        ]

    paginado = _paginar(data, page, page_size)
    paginado["totales"] = {
        "debe_bob":  round(sum(r["debe_bob"]  for r in _store["saldos_bob"]), 2),
        "haber_bob": round(sum(r["haber_bob"] for r in _store["saldos_bob"]), 2),
        "saldo_bob": round(sum(r["saldo_bob"] for r in _store["saldos_bob"]), 2),
    }
    return paginado


@app.get("/exportar")
def exportar():
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    output = io.BytesIO()

    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        workbook = writer.book

        fmt_header = workbook.add_format({"bold": True, "bg_color": "#1e3a5f", "font_color": "white", "border": 1})
        fmt_conciliado = workbook.add_format({"bg_color": "#d4edda", "border": 1})
        fmt_discrepancia = workbook.add_format({"bg_color": "#f8d7da", "border": 1})
        fmt_solo_qr = workbook.add_format({"bg_color": "#fff3cd", "border": 1})
        fmt_solo_banco = workbook.add_format({"bg_color": "#d1ecf1", "border": 1})

        def _write_sheet(sheet_name: str, records: list, columns: list):
            df = pd.DataFrame(records, columns=columns) if records else pd.DataFrame(columns=columns)
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            ws = writer.sheets[sheet_name]
            for col_num, col_name in enumerate(df.columns):
                ws.write(0, col_num, col_name, fmt_header)
                ws.set_column(col_num, col_num, max(len(str(col_name)) + 4, 14))

        # Conciliación pagos
        pago_cols = ["transaccion_id", "tipo", "estado", "monto_qr", "monto_banco", "diferencia", "fecha"]
        _write_sheet("Conciliacion Pagos", _store["conciliacion_pagos"], pago_cols)

        # Conciliación cobros
        _write_sheet("Conciliacion Cobros", _store["conciliacion_cobros"], pago_cols)

        # Saldos
        saldo_cols = ["account_id", "account_name", "saldo_calculado", "saldo_real", "diferencia", "estado"]
        _write_sheet("Saldos por Cliente", _store["saldos_resultado"], saldo_cols)

        # Métricas
        metrics_df = pd.DataFrame([_store["metricas"]])
        metrics_df.to_excel(writer, sheet_name="Métricas", index=False)

    output.seek(0)
    headers = {"Content-Disposition": "attachment; filename=cryptoops_resultado.xlsx"}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@app.get("/health")
def health():
    return {"status": "ok", "loaded": _store["loaded"]}
