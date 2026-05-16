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


# Try to load the bundled Excel at startup if present
_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Reportes_Banexcoin_Bolivia_Hackaton_2026.xlsx")
if os.path.exists(_DATA_PATH):
    try:
        _process_excel(_DATA_PATH)
        print(f"Auto-loaded data from {_DATA_PATH}")
    except Exception as e:
        print(f"Could not auto-load data: {e}")


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
    # Use mkstemp so we can close the fd before pandas opens the file (Windows file locking)
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)
        _process_excel(tmp_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error procesando el archivo: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass  # Windows may still hold the handle; temp dir will clean it up

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


@app.get("/conciliacion/pagos")
def get_conciliacion_pagos(
    estado: Optional[str] = Query(None, description="CONCILIADO|DISCREPANCIA|SOLO_EN_QR|SOLO_EN_BANCO"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["conciliacion_pagos"]
    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]

    total = len(data)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "data": data[start:end],
    }


@app.get("/conciliacion/cobros")
def get_conciliacion_cobros(
    estado: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["conciliacion_cobros"]
    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]

    total = len(data)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "data": data[start:end],
    }


@app.get("/conciliacion")
def get_conciliacion_all(
    estado: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None, description="pago|cobro"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    if not _store["loaded"]:
        raise HTTPException(status_code=404, detail="No hay datos cargados.")

    data = _store["conciliacion_pagos"] + _store["conciliacion_cobros"]

    if estado:
        data = [r for r in data if r["estado"] == estado.upper()]
    if tipo:
        data = [r for r in data if r["tipo"] == tipo.lower()]

    total = len(data)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "data": data[start:end],
    }


@app.get("/saldos")
def get_saldos(
    estado: Optional[str] = Query(None, description="CONCILIADO|DISCREPANCIA"),
    buscar: Optional[str] = Query(None, description="Buscar por account_id o account_name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
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

    total = len(data)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "data": data[start:end],
    }


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
