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


def _resumen(registros: list) -> dict:
    total    = len(registros)
    conc     = sum(1 for r in registros if r["estado"] == "CONCILIADO")
    disc     = sum(1 for r in registros if r["estado"] == "DISCREPANCIA")
    solo_qr  = sum(1 for r in registros if r["estado"] == "SOLO_EN_QR")
    solo_ban = sum(1 for r in registros if r["estado"] == "SOLO_EN_BANCO")
    monto_conc = round(sum(r["monto_qr"] or 0 for r in registros if r["estado"] == "CONCILIADO"), 2)
    monto_riesgo = round(
        sum(abs(r["monto_qr"] or 0)    for r in registros if r["estado"] == "SOLO_EN_QR") +
        sum(abs(r["monto_banco"] or 0)  for r in registros if r["estado"] == "SOLO_EN_BANCO") +
        sum(abs(r["diferencia"] or 0)   for r in registros if r["estado"] == "DISCREPANCIA"), 2
    )
    return {
        "total":        total,
        "conciliados":  conc,
        "discrepancias": disc,
        "solo_en_qr":   solo_qr,
        "solo_en_banco": solo_ban,
        "monto_conciliado_bob": monto_conc,
        "monto_en_riesgo_bob":  monto_riesgo,
        "tasa_conciliacion": round((conc / total) * 100, 1) if total else 0.0,
    }


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

    todos = _store["conciliacion_pagos"]
    data  = [r for r in todos if r["estado"] == estado.upper()] if estado else todos
    result = _paginar(data, page, page_size)
    result["resumen"] = _resumen(todos)
    return result


@app.get("/conciliacion/cobros")
def get_conciliacion_cobros(
    estado: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    todos = _store["conciliacion_cobros"]
    data  = [r for r in todos if r["estado"] == estado.upper()] if estado else todos
    result = _paginar(data, page, page_size)
    result["resumen"] = _resumen(todos)
    return result


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
