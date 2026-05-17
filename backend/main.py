import io
import json
import os
import tempfile
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
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



def _process_excel(file_path: str, selected_sheets: Optional[List[str]] = None):
    sheets = loader.load_excel(file_path, selected_sheets=selected_sheets)

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
async def upload(
    file: UploadFile = File(...),
    sheets: Optional[str] = Form(None),  # JSON list of sheet names from onboarding
):
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos Excel (.xlsx, .xls) o CSV")

    content = await file.read()
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)
        selected = json.loads(sheets) if sheets else None
        _process_excel(tmp_path, selected_sheets=selected)
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


@app.post("/upload-csv")
async def upload_csv(
    files: List[UploadFile] = File(...),
    metadata: str = Form(...),  # JSON: [{filename, sheet_type, column_map: {orig_col: target_col}}]
):
    """
    Recibe múltiples archivos CSV, cada uno mapeado a un tipo de hoja del sistema.
    El campo `metadata` es un JSON array con:
      - filename:   nombre del archivo tal como viene
      - sheet_type: clave interna (depositos, retiros, pago_qr, cobro_qr, transfers,
                    saldos, extracto_pagos, extracto_cobros)
      - column_map: dict {columna_original: columna_destino} para renombrar columnas
    """
    try:
        meta_list = json.loads(metadata)
    except Exception:
        raise HTTPException(status_code=400, detail="El campo metadata no es un JSON válido.")

    meta_by_name = {m["filename"]: m for m in meta_list}

    # Leer cada CSV y construir DataFrames con las columnas renombradas
    dfs: dict = {k: pd.DataFrame() for k in _store if k not in ("loaded", "metricas",
                  "conciliacion_pagos", "conciliacion_cobros", "saldos_resultado", "saldos_bob")}

    for upload in files:
        content = await upload.read()
        meta = meta_by_name.get(upload.filename, {})
        sheet_type = meta.get("sheet_type", "")
        col_map = meta.get("column_map", {})

        if not sheet_type:
            continue

        try:
            df = pd.read_csv(io.BytesIO(content), dtype=str, encoding="utf-8-sig")
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(content), dtype=str, encoding="latin-1")
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"Error leyendo {upload.filename}: {str(e)}")

        # Normalizar nombres de columnas
        from loader import _normalize_col
        df.columns = [_normalize_col(str(c)) for c in df.columns]

        # Aplicar mapeo de columnas del usuario
        if col_map:
            norm_map = {_normalize_col(k): _normalize_col(v) for k, v in col_map.items()}
            df = df.rename(columns=norm_map)

        df = df.dropna(how="all")

        if sheet_type in dfs:
            if dfs[sheet_type].empty:
                dfs[sheet_type] = df
            else:
                dfs[sheet_type] = pd.concat([dfs[sheet_type], df], ignore_index=True)

    # Procesar con las funciones de normalización existentes
    _store["depositos"]      = loader.normalize_depositos(dfs.get("depositos", pd.DataFrame()))
    _store["retiros"]        = loader.normalize_retiros(dfs.get("retiros", pd.DataFrame()))
    _store["pago_qr"]        = loader.normalize_pago_qr(dfs.get("pago_qr", pd.DataFrame()))
    _store["cobro_qr"]       = loader.normalize_cobro_qr(dfs.get("cobro_qr", pd.DataFrame()))
    _store["transfers"]      = loader.normalize_transfers(dfs.get("transfers", pd.DataFrame()))
    _store["saldos"]         = loader.normalize_saldos(dfs.get("saldos", pd.DataFrame()))
    _store["extracto_pagos"] = loader.normalize_extracto_pagos(dfs.get("extracto_pagos", pd.DataFrame()))
    _store["extracto_cobros"]= loader.normalize_extracto_cobros(dfs.get("extracto_cobros", pd.DataFrame()))

    # Correr motor de conciliación igual que en /upload
    _store["saldos_bob"] = reconciler.reconcile_saldos_bob(_store["pago_qr"], _store["cobro_qr"])
    _store["conciliacion_pagos"] = reconciler.reconcile_pagos(_store["pago_qr"], _store["extracto_pagos"])
    _store["conciliacion_cobros"] = reconciler.reconcile_cobros(_store["cobro_qr"], _store["extracto_cobros"])
    _store["saldos_resultado"] = reconciler.reconcile_saldos(
        _store["depositos"], _store["retiros"], _store["pago_qr"],
        _store["cobro_qr"], _store["transfers"], _store["saldos"],
    )
    _store["metricas"] = reconciler.compute_metricas(
        _store["conciliacion_pagos"], _store["conciliacion_cobros"],
        _store["depositos"], _store["retiros"], _store["pago_qr"], _store["cobro_qr"],
    )
    _store["loaded"] = True

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


@app.post("/preview")
async def preview(file: UploadFile = File(...)):
    """
    Recibe un Excel y devuelve sus hojas con columnas y muestra de filas.
    El frontend lo usa para el onboarding de selección de tablas/columnas.
    No modifica el store — solo lectura.
    """
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos Excel (.xlsx, .xls) o CSV")

    content = await file.read()
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            tmp.write(content)

        xl = pd.ExcelFile(tmp_path)
        sheets_info = []
        for sheet_name in xl.sheet_names:
            try:
                df = xl.parse(sheet_name, dtype=str, nrows=5)
                # Limpia nombres de columnas
                cols = [str(c).strip() for c in df.columns if str(c).strip() and not str(c).startswith("Unnamed")]
                # Muestra las primeras 3 filas como lista de dicts
                sample = df.head(3).fillna("").to_dict(orient="records")
                # Limpia las keys de sample para que coincidan con cols limpios
                clean_sample = []
                for row in sample:
                    clean_row = {str(k).strip(): str(v) for k, v in row.items() if str(k).strip() and not str(k).startswith("Unnamed")}
                    clean_sample.append(clean_row)
                sheets_info.append({
                    "name": sheet_name,
                    "columns": cols,
                    "sample": clean_sample,
                    "total_rows": len(xl.parse(sheet_name, dtype=str)),
                })
            except Exception as e:
                sheets_info.append({
                    "name": sheet_name,
                    "columns": [],
                    "sample": [],
                    "total_rows": 0,
                    "error": str(e),
                })
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return {"sheets": sheets_info, "filename": file.filename}


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
    if estado:
        e = estado.upper()
        data = [r for r in todos if r["estado"] != "CONCILIADO"] if e == "DISCREPANCIA" else [r for r in todos if r["estado"] == e]
    else:
        data = todos
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
    if estado:
        e = estado.upper()
        data = [r for r in todos if r["estado"] != "CONCILIADO"] if e == "DISCREPANCIA" else [r for r in todos if r["estado"] == e]
    else:
        data = todos
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
