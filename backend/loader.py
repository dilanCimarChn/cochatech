import pandas as pd
import numpy as np
from typing import Dict, Any
import re


SHEET_MAP = {
    "depositos": ["Depositos", "Depósitos", "S-004", "depositos"],
    "retiros": ["Retiros", "S-003", "retiros"],
    "pago_qr": ["Pago QR", "S-001", "pago_qr", "Pagos QR"],
    "cobro_qr": ["Cobro QR", "S-002", "cobro_qr", "Cobros QR"],
    "transfers": ["Transfers", "S-005", "transfers", "Transferencias"],
    "saldos": ["Saldos", "saldos", "Balance"],
    "extracto_pagos": ["EXTRACTO DE PAGOS", "Extracto Pagos", "extracto_pagos"],
    "extracto_cobros": ["EXTRACTO DE COBROS", "Extracto Cobros", "extracto_cobros"],
}


def _clean_str(val: Any) -> str:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return ""
    return str(val).strip()


def _clean_float(val: Any) -> float:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return 0.0
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _clean_date(val: Any) -> str:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return ""
    try:
        ts = pd.to_datetime(val, errors="coerce")
        if pd.isnull(ts):
            return str(val)
        return ts.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(val)


def _normalize_col(col: str) -> str:
    col = col.strip().lower()
    col = re.sub(r"[áàä]", "a", col)
    col = re.sub(r"[éèë]", "e", col)
    col = re.sub(r"[íìï]", "i", col)
    col = re.sub(r"[óòö]", "o", col)
    col = re.sub(r"[úùü]", "u", col)
    col = re.sub(r"[ñ]", "n", col)
    col = re.sub(r"[^a-z0-9]+", "_", col)
    col = col.strip("_")
    return col


def _find_sheet(xl: pd.ExcelFile, candidates: list) -> str | None:
    sheet_names = xl.sheet_names
    for candidate in candidates:
        for name in sheet_names:
            if candidate.lower() == name.lower():
                return name
            if candidate.lower() in name.lower():
                return name
    return None


def _read_sheet(xl: pd.ExcelFile, sheet_name: str) -> pd.DataFrame:
    df = xl.parse(sheet_name, dtype=str)
    df.columns = [_normalize_col(str(c)) for c in df.columns]
    df = df.dropna(how="all")
    return df


def load_excel(file_path: str) -> Dict[str, pd.DataFrame]:
    xl     = pd.ExcelFile(file_path)
    result = {}
    for key, candidates in SHEET_MAP.items():
        sheet_name = _find_sheet(xl, candidates)
        if sheet_name:
            result[key] = _read_sheet(xl, sheet_name)
        else:
            result[key] = pd.DataFrame()
    return result


_COMPLETED_STATUSES = {"completed", "fully_processed", "fully processed"}


def _is_completed(val: Any) -> bool:
    return str(val).strip().lower().replace("_", " ") in _COMPLETED_STATUSES


def normalize_depositos(df: pd.DataFrame) -> list[dict]:
    rows = []
    col_map = {
        "user_id": ["user_id", "userid", "user"],
        "account_id": ["account_id", "accountid", "cuenta_id"],
        "account_name": ["account_name", "accountname", "nombre", "nombre_cuenta"],
        "fecha": ["fecha", "date", "created_at", "fecha_creacion"],
        "crypto_quantity": ["crypto_quantity", "cantidad", "amount", "quantity"],
        "product": ["product", "producto", "symbol"],
        "ticket_number": ["ticket_number", "ticket", "numero_ticket"],
        "ticket_status": ["ticket_status", "status", "estado"],
        "blockchain": ["blockchain", "red", "network"],
    }

    for _, row in df.iterrows():
        status_val = row.get("ticket_status", row.get("status", row.get("estado", "")))
        if not _is_completed(status_val):
            continue

        rec = {}
        for field, candidates in col_map.items():
            for c in candidates:
                if c in df.columns:
                    rec[field] = _clean_str(row.get(c, ""))
                    break
            else:
                rec[field] = ""

        rec["fecha"] = _clean_date(rec.get("fecha", ""))
        rec["crypto_quantity"] = _clean_float(
            next((row.get(c) for c in ["crypto_quantity", "cantidad", "amount"] if c in df.columns), 0)
        )
        rows.append(rec)
    return rows


def normalize_retiros(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        status_val = row.get("ticket_status", row.get("status", row.get("estado", "")))
        if not _is_completed(status_val):
            continue

        rec = {
            "user_id": _clean_str(row.get("user_id", row.get("userid", ""))),
            "account_id": _clean_str(row.get("account_id", row.get("accountid", ""))),
            "account_name": _clean_str(row.get("account_name", row.get("accountname", row.get("nombre", "")))),
            "fecha": _clean_date(row.get("fecha", row.get("date", row.get("created_at", "")))),
            "crypto_quantity": _clean_float(row.get("crypto_quantity", row.get("cantidad", row.get("amount", 0)))),
            "product": _clean_str(row.get("product", row.get("producto", row.get("symbol", "")))),
            "crypto_fee": _clean_float(row.get("crypto_fee", row.get("fee", row.get("comision", 0)))),
            "ticket_number": _clean_str(row.get("ticket_number", row.get("ticket", ""))),
            "ticket_status": _clean_str(row.get("ticket_status", row.get("status", row.get("estado", "")))),
            "monto_antes_comision": _clean_float(
                row.get("monto_antes_comision", row.get("monto_bruto", row.get("gross_amount", 0)))
            ),
        }
        rows.append(rec)
    return rows


def normalize_pago_qr(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        status_val = row.get("estado", row.get("status", row.get("state", "")))
        if not _is_completed(status_val):
            continue

        tid = _clean_str(
            row.get(
                "transaccion_id",
                row.get("transaction_id", row.get("id_transaccion", row.get("transacci_n_id", ""))),
            )
        )
        monto = _clean_float(
            row.get("monto_pagado", row.get("monto", row.get("amount", row.get("importe", 0))))
        )
        rec = {
            "numero_cotizacion": _clean_str(
                row.get("numero_cotizacion", row.get("cotizacion", row.get("n_mero_cotizaci_n", "")))
            ),
            "fecha_creacion": _clean_date(
                row.get("fecha_creacion", row.get("fecha", row.get("created_at", "")))
            ),
            "estado": _clean_str(row.get("estado", row.get("status", row.get("state", "")))),
            "creado_por": _clean_str(row.get("creado_por", row.get("created_by", row.get("usuario", "")))),
            "numero_cuenta": _clean_str(
                row.get("numero_cuenta", row.get("cuenta", row.get("account", row.get("n_mero_de_cuenta", ""))))
            ),
            "monto_intercambio": _clean_float(
                row.get("monto_intercambio", row.get("exchange_amount", 0))
            ),
            "monto_pagado": monto,
            "moneda": _clean_str(row.get("moneda", row.get("currency", "BOB"))),
            "precio": _clean_float(row.get("precio", row.get("price", 0))),
            "comision": _clean_float(row.get("comision", row.get("commission", row.get("fee", 0)))),
            "transaccion_id": tid,
        }
        rows.append(rec)
    return rows


def normalize_cobro_qr(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        status_val = row.get("estado", row.get("status", row.get("state", "")))
        if not _is_completed(status_val):
            continue

        tid = _clean_str(
            row.get(
                "transaccion_id",
                row.get("transaction_id", row.get("id_transaccion", row.get("transacci_n_id", ""))),
            )
        )
        rec = {
            "numero_cotizacion": _clean_str(
                row.get("numero_cotizacion", row.get("cotizacion", row.get("n_mero_cotizaci_n", "")))
            ),
            "fecha_creacion": _clean_date(
                row.get("fecha_creacion", row.get("fecha", row.get("created_at", "")))
            ),
            "estado": _clean_str(row.get("estado", row.get("status", ""))),
            "creado_por": _clean_str(row.get("creado_por", row.get("created_by", ""))),
            "numero_cuenta": _clean_str(
                row.get("numero_cuenta", row.get("cuenta", row.get("n_mero_de_cuenta", "")))
            ),
            "monto_intercambio": _clean_float(row.get("monto_intercambio", 0)),
            "monto_pagado": _clean_float(
                row.get("monto_pagado", row.get("monto", row.get("amount", 0)))
            ),
            "moneda": _clean_str(row.get("moneda", row.get("currency", "BOB"))),
            "comision": _clean_float(row.get("comision", row.get("commission", 0))),
            "transaccion_id": tid,
            "importe_neto": _clean_float(row.get("importe_neto", row.get("net_amount", 0))),
        }
        rows.append(rec)
    return rows


def normalize_transfers(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        rec = {
            "created_at": _clean_date(row.get("created_at", row.get("fecha", ""))),
            "transfer_number": _clean_str(
                row.get("transfer_number", row.get("numero_transferencia", row.get("id", "")))
            ),
            "amount": _clean_float(row.get("amount", row.get("monto", row.get("cantidad", 0)))),
            "sender_account": _clean_str(
                row.get("sender_account", row.get("cuenta_origen", row.get("emisor", "")))
            ),
            "sender_alias": _clean_str(
                row.get("sender_alias", row.get("alias_origen", row.get("nombre_emisor", "")))
            ),
            "product_symbol": _clean_str(
                row.get("product_symbol", row.get("producto", row.get("symbol", "")))
            ),
            "receiver_account": _clean_str(
                row.get("receiver_account", row.get("cuenta_destino", row.get("receptor", "")))
            ),
            "receiver_alias": _clean_str(
                row.get("receiver_alias", row.get("alias_destino", row.get("nombre_receptor", "")))
            ),
        }
        rows.append(rec)
    return rows


def normalize_saldos(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        rec = {
            "account_id": _clean_str(
                row.get("account_id", row.get("accountid", row.get("cuenta_id", row.get("id", ""))))
            ),
            "account_name": _clean_str(
                row.get(
                    "account_name",
                    row.get("accountname", row.get("nombre", row.get("nombre_cuenta", ""))),
                )
            ),
            "debe": _clean_float(row.get("debe", row.get("debit", row.get("debito", 0)))),
            "haber": _clean_float(row.get("haber", row.get("credit", row.get("credito", 0)))),
            "saldo": _clean_float(
                row.get("saldo", row.get("balance", row.get("saldo_neto", row.get("neto", 0))))
            ),
        }
        rows.append(rec)
    return rows


def normalize_extracto_pagos(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        codigo = _clean_str(
            row.get(
                "codigo_de_transaccion",
                row.get(
                    "codigo_transaccion",
                    row.get("transaction_code", row.get("codigo", row.get("id_transaccion", ""))),
                ),
            )
        )
        importe = _clean_float(
            row.get(
                "importe_en_bolivianos",
                row.get(
                    "importe_bolivianos",
                    row.get("importe", row.get("monto", row.get("amount", row.get("bolivianos", 0)))),
                ),
            )
        )
        rec = {
            "fecha": _clean_date(row.get("fecha", row.get("date", ""))),
            "hora": _clean_str(row.get("hora", row.get("time", row.get("hour", "")))),
            "codigo_transaccion": codigo,
            "importe_bolivianos": importe,
        }
        rows.append(rec)
    return rows


def normalize_extracto_cobros(df: pd.DataFrame) -> list[dict]:
    return normalize_extracto_pagos(df)
