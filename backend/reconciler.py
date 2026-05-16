import pandas as pd
import numpy as np
from typing import Dict, Any

_INVALID_TIDS = {"nan", "none", "null", "", "0", "#n/a", "n/a", "na"}


def _to_df(records: list[dict]) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()
    return pd.DataFrame(records)


def _clean_tid(series: pd.Series) -> pd.Series:
    """Convert to str, strip spaces, mark invalid IDs as empty string."""
    s = series.fillna("").astype(str).str.strip()
    s = s.where(~s.str.lower().isin(_INVALID_TIDS), "")
    return s


def _valid_rows(df: pd.DataFrame, tid_col: str, amount_col: str) -> pd.DataFrame:
    """Keep only rows that have a real transaction ID."""
    df = df.copy()
    df["_tid"] = _clean_tid(df[tid_col])
    return df[df["_tid"] != ""].reset_index(drop=True)


def reconcile_pagos(pago_qr: list[dict], extracto_pagos: list[dict]) -> list[dict]:
    df_qr_raw = _to_df(pago_qr)
    df_banco_raw = _to_df(extracto_pagos)

    # Keep only rows with a real transaction ID
    df_qr = _valid_rows(df_qr_raw, "transaccion_id", "monto_pagado") if not df_qr_raw.empty else pd.DataFrame()
    df_banco = _valid_rows(df_banco_raw, "codigo_transaccion", "importe_bolivianos") if not df_banco_raw.empty else pd.DataFrame()

    results = []

    if df_qr.empty and df_banco.empty:
        return []

    if df_qr.empty:
        for _, row in df_banco.iterrows():
            results.append(_banco_only_row(row, "pago"))
        return results

    if df_banco.empty:
        for _, row in df_qr.iterrows():
            results.append(_qr_only_pago_row(row))
        return results

    merged = pd.merge(
        df_qr[["_tid", "monto_pagado", "fecha_creacion"]].copy(),
        df_banco[["_tid", "importe_bolivianos", "fecha"]].copy(),
        on="_tid",
        how="outer",
        indicator=True,
    )

    for _, row in merged.iterrows():
        indicator = str(row["_merge"])
        tid = str(row["_tid"])
        monto_qr = float(row["monto_pagado"]) if pd.notna(row.get("monto_pagado")) else None
        monto_banco = float(row["importe_bolivianos"]) if pd.notna(row.get("importe_bolivianos")) else None

        # Skip rows that ended up with an empty tid after merge (shouldn't happen, but safeguard)
        if tid.lower() in _INVALID_TIDS:
            continue

        fecha_val = row.get("fecha_creacion")
        if pd.isna(fecha_val) or str(fecha_val) in _INVALID_TIDS:
            fecha_val = row.get("fecha", "")
        fecha = str(fecha_val) if pd.notna(fecha_val) else ""

        if indicator == "both":
            diferencia = round((monto_qr or 0) - (monto_banco or 0), 4)
            estado = "CONCILIADO" if abs(diferencia) < 0.01 else "DISCREPANCIA"
        elif indicator == "left_only":
            diferencia = None
            estado = "SOLO_EN_QR"
        else:
            diferencia = None
            estado = "SOLO_EN_BANCO"

        results.append({
            "transaccion_id": tid,
            "fuente_qr": indicator in ("both", "left_only"),
            "fuente_banco": indicator in ("both", "right_only"),
            "monto_qr": monto_qr,
            "monto_banco": monto_banco,
            "diferencia": diferencia,
            "estado": estado,
            "tipo": "pago",
            "fecha": fecha,
        })

    return results


def reconcile_cobros(cobro_qr: list[dict], extracto_cobros: list[dict]) -> list[dict]:
    df_qr_raw = _to_df(cobro_qr)
    df_banco_raw = _to_df(extracto_cobros)

    df_qr = _valid_rows(df_qr_raw, "transaccion_id", "monto_pagado") if not df_qr_raw.empty else pd.DataFrame()
    df_banco = _valid_rows(df_banco_raw, "codigo_transaccion", "importe_bolivianos") if not df_banco_raw.empty else pd.DataFrame()

    results = []

    if df_qr.empty and df_banco.empty:
        return []

    if df_qr.empty:
        for _, row in df_banco.iterrows():
            results.append(_banco_only_row(row, "cobro"))
        return results

    if df_banco.empty:
        for _, row in df_qr.iterrows():
            results.append(_qr_only_cobro_row(row))
        return results

    monto_col_qr = "monto_pagado" if "monto_pagado" in df_qr.columns else "importe_neto"

    merged = pd.merge(
        df_qr[["_tid", monto_col_qr, "fecha_creacion"]].copy(),
        df_banco[["_tid", "importe_bolivianos", "fecha"]].copy(),
        on="_tid",
        how="outer",
        indicator=True,
    )

    for _, row in merged.iterrows():
        indicator = str(row["_merge"])
        tid = str(row["_tid"])
        monto_qr = float(row[monto_col_qr]) if pd.notna(row.get(monto_col_qr)) else None
        monto_banco = float(row["importe_bolivianos"]) if pd.notna(row.get("importe_bolivianos")) else None

        if tid.lower() in _INVALID_TIDS:
            continue

        fecha_val = row.get("fecha_creacion")
        if pd.isna(fecha_val) or str(fecha_val) in _INVALID_TIDS:
            fecha_val = row.get("fecha", "")
        fecha = str(fecha_val) if pd.notna(fecha_val) else ""

        if indicator == "both":
            diferencia = round((monto_qr or 0) - (monto_banco or 0), 4)
            estado = "CONCILIADO" if abs(diferencia) < 0.01 else "DISCREPANCIA"
        elif indicator == "left_only":
            diferencia = None
            estado = "SOLO_EN_QR"
        else:
            diferencia = None
            estado = "SOLO_EN_BANCO"

        results.append({
            "transaccion_id": tid,
            "fuente_qr": indicator in ("both", "left_only"),
            "fuente_banco": indicator in ("both", "right_only"),
            "monto_qr": monto_qr,
            "monto_banco": monto_banco,
            "diferencia": diferencia,
            "estado": estado,
            "tipo": "cobro",
            "fecha": fecha,
        })

    return results


def _banco_only_row(row, tipo: str) -> dict:
    return {
        "transaccion_id": str(row.get("_tid", row.get("codigo_transaccion", ""))),
        "fuente_qr": False,
        "fuente_banco": True,
        "monto_qr": None,
        "monto_banco": float(row.get("importe_bolivianos", 0) or 0),
        "diferencia": None,
        "estado": "SOLO_EN_BANCO",
        "tipo": tipo,
        "fecha": str(row.get("fecha", "")) if pd.notna(row.get("fecha", "")) else "",
    }


def _qr_only_pago_row(row) -> dict:
    return {
        "transaccion_id": str(row.get("_tid", row.get("transaccion_id", ""))),
        "fuente_qr": True,
        "fuente_banco": False,
        "monto_qr": float(row.get("monto_pagado", 0) or 0),
        "monto_banco": None,
        "diferencia": None,
        "estado": "SOLO_EN_QR",
        "tipo": "pago",
        "fecha": str(row.get("fecha_creacion", "")) if pd.notna(row.get("fecha_creacion", "")) else "",
    }


def _qr_only_cobro_row(row) -> dict:
    monto = row.get("monto_pagado") or row.get("importe_neto") or 0
    return {
        "transaccion_id": str(row.get("_tid", row.get("transaccion_id", ""))),
        "fuente_qr": True,
        "fuente_banco": False,
        "monto_qr": float(monto),
        "monto_banco": None,
        "diferencia": None,
        "estado": "SOLO_EN_QR",
        "tipo": "cobro",
        "fecha": str(row.get("fecha_creacion", "")) if pd.notna(row.get("fecha_creacion", "")) else "",
    }


def reconcile_saldos(
    depositos: list[dict],
    retiros: list[dict],
    pagos_qr: list[dict],
    cobros_qr: list[dict],
    transfers: list[dict],
    saldos: list[dict],
) -> list[dict]:
    totals: Dict[str, Dict[str, float]] = {}
    names: Dict[str, str] = {}

    def _add(account_id: str, name: str, field: str, amount: float):
        if not account_id or account_id.lower() in _INVALID_TIDS:
            return
        if account_id not in totals:
            totals[account_id] = {
                "depositos": 0.0, "retiros": 0.0, "pagos_qr": 0.0,
                "cobros_qr": 0.0, "transfers_enviadas": 0.0, "transfers_recibidas": 0.0,
            }
        totals[account_id][field] += amount
        if name:
            names[account_id] = name

    for d in depositos:
        _add(d.get("account_id", ""), d.get("account_name", ""), "depositos", d.get("crypto_quantity", 0) or 0)

    for r in retiros:
        qty = (r.get("crypto_quantity", 0) or 0) + (r.get("crypto_fee", 0) or 0)
        _add(r.get("account_id", ""), r.get("account_name", ""), "retiros", qty)

    for p in pagos_qr:
        _add(p.get("numero_cuenta", ""), "", "pagos_qr", p.get("monto_pagado", 0) or 0)

    for c in cobros_qr:
        monto = c.get("importe_neto") or c.get("monto_pagado") or 0
        _add(c.get("numero_cuenta", ""), "", "cobros_qr", monto)

    for t in transfers:
        amount = t.get("amount", 0) or 0
        _add(t.get("sender_account", ""), t.get("sender_alias", ""), "transfers_enviadas", amount)
        _add(t.get("receiver_account", ""), t.get("receiver_alias", ""), "transfers_recibidas", amount)

    saldo_real_map: Dict[str, Dict[str, Any]] = {}
    for s in saldos:
        aid = s.get("account_id", "")
        if aid and aid.lower() not in _INVALID_TIDS:
            saldo_real_map[aid] = {
                "saldo": s.get("saldo", 0) or 0,
                "name": s.get("account_name", ""),
            }
            if s.get("account_name"):
                names[aid] = s["account_name"]

    all_accounts = set(totals.keys()) | set(saldo_real_map.keys())
    results = []

    for aid in all_accounts:
        t = totals.get(aid, {})
        saldo_calc = (
            t.get("depositos", 0) + t.get("cobros_qr", 0) + t.get("transfers_recibidas", 0)
            - t.get("retiros", 0) - t.get("pagos_qr", 0) - t.get("transfers_enviadas", 0)
        )
        saldo_real = saldo_real_map.get(aid, {}).get("saldo", 0)
        diferencia = round(saldo_calc - saldo_real, 6)
        estado = "CONCILIADO" if abs(diferencia) < 0.001 else "DISCREPANCIA"

        results.append({
            "account_id": aid,
            "account_name": names.get(aid, ""),
            "saldo_calculado": round(saldo_calc, 6),
            "saldo_real": round(saldo_real, 6),
            "diferencia": diferencia,
            "estado": estado,
        })

    results.sort(key=lambda x: abs(x["diferencia"]), reverse=True)
    return results


def compute_metricas(
    conciliacion_pagos: list[dict],
    conciliacion_cobros: list[dict],
    depositos: list[dict],
    retiros: list[dict],
    pagos_qr: list[dict],
    cobros_qr: list[dict],
) -> dict:
    all_results = conciliacion_pagos + conciliacion_cobros
    total = len(all_results)
    conciliadas = sum(1 for r in all_results if r["estado"] == "CONCILIADO")
    discrepancias = sum(1 for r in all_results if r["estado"] == "DISCREPANCIA")
    solo_qr = sum(1 for r in all_results if r["estado"] == "SOLO_EN_QR")
    solo_banco = sum(1 for r in all_results if r["estado"] == "SOLO_EN_BANCO")

    usdt_dep = sum(d.get("crypto_quantity", 0) or 0 for d in depositos)
    usdt_ret = sum(r.get("crypto_quantity", 0) or 0 for r in retiros)
    bob_pagos = sum(p.get("monto_pagado", 0) or 0 for p in pagos_qr)
    bob_cobros = sum((c.get("monto_pagado") or c.get("importe_neto") or 0) for c in cobros_qr)

    tasa = round((conciliadas / total) * 100, 2) if total > 0 else 0.0

    return {
        "total_transacciones": total,
        "conciliadas": conciliadas,
        "discrepancias": discrepancias,
        "solo_en_qr": solo_qr,
        "solo_en_banco": solo_banco,
        "total_usdt_depositado": round(usdt_dep, 4),
        "total_usdt_retirado": round(usdt_ret, 4),
        "total_bob_pagos": round(bob_pagos, 2),
        "total_bob_cobros": round(bob_cobros, 2),
        "tasa_conciliacion": tasa,
    }
