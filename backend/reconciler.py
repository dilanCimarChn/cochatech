"""
Motor de conciliación CryptoOps Engine — Banexcoin Bolivia

Reglas según hoja "Servicios" del Excel:
  S-001 Pago QR    → CONCILIA contra EXTRACTO DE PAGOS  (por Nro. Transacción)
  S-002 Cobro QR   → CONCILIA contra EXTRACTO DE COBROS (por Nro. Transacción)
  S-003 Retiros    → Solo alimenta saldo USDT del cliente (crypto_quantity)
  S-004 Depósitos  → Solo alimenta saldo USDT del cliente (crypto_quantity)
  S-005 Transfer   → Solo alimenta saldo USDT del cliente (sender – / receiver +)

Monedas:
  S-001/S-002 operan en BOB   → conciliación bancaria en BOB
  S-003/S-004/S-005 en USDT  → saldo cripto del cliente
"""

import pandas as pd
from typing import Dict, Any

_INVALID = {"nan", "none", "null", "", "0", "#n/a", "n/a", "na", "nat"}


def _clean_tid(series: pd.Series) -> pd.Series:
    s = series.fillna("").astype(str).str.strip()
    return s.where(~s.str.lower().isin(_INVALID), "")


def _valid(df: pd.DataFrame, tid_col: str) -> pd.DataFrame:
    df = df.copy()
    df["_tid"] = _clean_tid(df[tid_col])
    return df[df["_tid"] != ""].reset_index(drop=True)


# ──────────────────────────────────────────────
# 1. Conciliación S-001 Pago QR vs Extracto Pagos
# ──────────────────────────────────────────────
def reconcile_pagos(pago_qr: list[dict], extracto_pagos: list[dict]) -> list[dict]:
    df_qr = pd.DataFrame(pago_qr) if pago_qr else pd.DataFrame()
    df_banco = pd.DataFrame(extracto_pagos) if extracto_pagos else pd.DataFrame()

    print(f"\n[reconcile_pagos] pago_qr={len(df_qr)} filas  |  extracto_pagos={len(df_banco)} filas")

    if df_qr.empty and df_banco.empty:
        return []

    df_qr = _valid(df_qr, "transaccion_id") if not df_qr.empty else df_qr
    df_banco = _valid(df_banco, "codigo_transaccion") if not df_banco.empty else df_banco

    print(f"[reconcile_pagos] con TID válido → qr={len(df_qr)}  banco={len(df_banco)}")
    if not df_qr.empty:
        print(f"  TIDs qr    (primeros 5): {df_qr['_tid'].head().tolist()}")
    if not df_banco.empty:
        print(f"  TIDs banco (primeros 5): {df_banco['_tid'].head().tolist()}")

    # Si solo hay un lado
    if df_qr.empty:
        return [_make(row, "pago", "SOLO_EN_BANCO", monto_banco=_f(row, "importe_bolivianos")) for _, row in df_banco.iterrows()]
    if df_banco.empty:
        return [_make(row, "pago", "SOLO_EN_QR", monto_qr=_f(row, "monto_pagado"), fecha=_s(row, "fecha_creacion")) for _, row in df_qr.iterrows()]

    merged = pd.merge(
        df_qr[["_tid", "monto_pagado", "fecha_creacion"]],
        df_banco[["_tid", "importe_bolivianos", "fecha"]],
        on="_tid", how="outer", indicator=True,
    )

    counts = merged["_merge"].value_counts().to_dict()
    print(f"[reconcile_pagos] merge → {counts}")

    ambos = merged[merged["_merge"] == "both"].head(5)
    if not ambos.empty:
        print("[reconcile_pagos] Muestra de registros en AMBOS lados:")
        for _, r in ambos.iterrows():
            print(f"  TID={r['_tid']}  monto_qr={r.get('monto_pagado')}  monto_banco={r.get('importe_bolivianos')}")

    results = []
    for _, row in merged.iterrows():
        ind = str(row["_merge"])
        tid = str(row["_tid"])
        if tid.lower() in _INVALID:
            continue

        mq = float(row["monto_pagado"]) if pd.notna(row.get("monto_pagado")) else None
        mb = float(row["importe_bolivianos"]) if pd.notna(row.get("importe_bolivianos")) else None
        fecha = _s(row, "fecha_creacion") or _s(row, "fecha")

        if ind == "both":
            diff = round((mq or 0) - (mb or 0), 4)
            estado = "CONCILIADO" if abs(diff) < 0.01 else "DISCREPANCIA"
        elif ind == "left_only":
            diff, estado = None, "SOLO_EN_QR"
        else:
            diff, estado = None, "SOLO_EN_BANCO"

        results.append({
            "transaccion_id": tid, "tipo": "pago", "estado": estado,
            "fuente_qr": ind in ("both", "left_only"),
            "fuente_banco": ind in ("both", "right_only"),
            "monto_qr": mq, "monto_banco": mb, "diferencia": diff, "fecha": fecha,
        })

    conciliados = [r for r in results if r["estado"] == "CONCILIADO"]
    print(f"[reconcile_pagos] CONCILIADOS: {len(conciliados)}")
    for r in conciliados[:5]:
        print(f"  {r}")
    return results


# ──────────────────────────────────────────────
# 2. Conciliación S-002 Cobro QR vs Extracto Cobros
# ──────────────────────────────────────────────
def reconcile_cobros(cobro_qr: list[dict], extracto_cobros: list[dict]) -> list[dict]:
    df_qr = pd.DataFrame(cobro_qr) if cobro_qr else pd.DataFrame()
    df_banco = pd.DataFrame(extracto_cobros) if extracto_cobros else pd.DataFrame()

    print(f"\n[reconcile_cobros] cobro_qr={len(df_qr)} filas  |  extracto_cobros={len(df_banco)} filas")

    if df_qr.empty and df_banco.empty:
        return []

    df_qr = _valid(df_qr, "transaccion_id") if not df_qr.empty else df_qr
    df_banco = _valid(df_banco, "codigo_transaccion") if not df_banco.empty else df_banco

    print(f"[reconcile_cobros] con TID válido → qr={len(df_qr)}  banco={len(df_banco)}")
    if not df_qr.empty:
        print(f"  TIDs qr    (primeros 5): {df_qr['_tid'].head().tolist()}")
    if not df_banco.empty:
        print(f"  TIDs banco (primeros 5): {df_banco['_tid'].head().tolist()}")

    if df_qr.empty:
        return [_make(row, "cobro", "SOLO_EN_BANCO", monto_banco=_f(row, "importe_bolivianos")) for _, row in df_banco.iterrows()]
    if df_banco.empty:
        monto_col = "monto_pagado" if "monto_pagado" in df_qr.columns else "importe_neto"
        return [_make(row, "cobro", "SOLO_EN_QR", monto_qr=_f(row, monto_col), fecha=_s(row, "fecha_creacion")) for _, row in df_qr.iterrows()]

    monto_col = "monto_pagado" if "monto_pagado" in df_qr.columns else "importe_neto"

    merged = pd.merge(
        df_qr[["_tid", monto_col, "fecha_creacion"]],
        df_banco[["_tid", "importe_bolivianos", "fecha"]],
        on="_tid", how="outer", indicator=True,
    )

    counts = merged["_merge"].value_counts().to_dict()
    print(f"[reconcile_cobros] merge → {counts}")

    results = []
    for _, row in merged.iterrows():
        ind = str(row["_merge"])
        tid = str(row["_tid"])
        if tid.lower() in _INVALID:
            continue

        mq = float(row[monto_col]) if pd.notna(row.get(monto_col)) else None
        mb = float(row["importe_bolivianos"]) if pd.notna(row.get("importe_bolivianos")) else None
        fecha = _s(row, "fecha_creacion") or _s(row, "fecha")

        if ind == "both":
            diff = round((mq or 0) - (mb or 0), 4)
            estado = "CONCILIADO" if abs(diff) < 0.01 else "DISCREPANCIA"
        elif ind == "left_only":
            diff, estado = None, "SOLO_EN_QR"
        else:
            diff, estado = None, "SOLO_EN_BANCO"

        results.append({
            "transaccion_id": tid, "tipo": "cobro", "estado": estado,
            "fuente_qr": ind in ("both", "left_only"),
            "fuente_banco": ind in ("both", "right_only"),
            "monto_qr": mq, "monto_banco": mb, "diferencia": diff, "fecha": fecha,
        })

    conciliados = [r for r in results if r["estado"] == "CONCILIADO"]
    print(f"[reconcile_cobros] CONCILIADOS: {len(conciliados)}")
    for r in conciliados[:5]:
        print(f"  {r}")
    return results


# ──────────────────────────────────────────────
# 3. Saldo USDT por cliente (S-003, S-004, S-005)
#    BOB no entra aquí — son monedas distintas
# ──────────────────────────────────────────────
def reconcile_saldos(
    depositos: list[dict],    # S-004 — USDT
    retiros: list[dict],      # S-003 — USDT
    pagos_qr: list[dict],     # S-001 — BOB (no afecta saldo USDT)
    cobros_qr: list[dict],    # S-002 — BOB (no afecta saldo USDT)
    transfers: list[dict],    # S-005 — USDT
    saldos: list[dict],       # Hoja Saldos — saldo real USDT por cliente
) -> list[dict]:
    totals: Dict[str, float] = {}
    names: Dict[str, str] = {}

    def _add(account_id: str, name: str, amount: float):
        aid = str(account_id).strip()
        if not aid or aid.lower() in _INVALID:
            return
        totals[aid] = totals.get(aid, 0.0) + amount
        if name:
            names[aid] = str(name).strip()

    # S-004 Depósitos → suma crypto_quantity al cliente
    for d in depositos:
        _add(d.get("account_id", ""), d.get("account_name", ""),
             +(d.get("crypto_quantity", 0) or 0))

    # S-003 Retiros → resta crypto_quantity + fee al cliente
    for r in retiros:
        qty = (r.get("crypto_quantity", 0) or 0) + (r.get("crypto_fee", 0) or 0)
        _add(r.get("account_id", ""), r.get("account_name", ""), -qty)

    # S-005 Banextransfer → sender pierde, receiver gana (en USDT)
    for t in transfers:
        amount = t.get("amount", 0) or 0
        _add(t.get("sender_account", ""),   t.get("sender_alias", ""),   -amount)
        _add(t.get("receiver_account", ""), t.get("receiver_alias", ""), +amount)

    # Saldo real de la hoja Saldos
    saldo_real_map: Dict[str, Dict] = {}
    for s in saldos:
        aid = str(s.get("account_id", "")).strip()
        if aid and aid.lower() not in _INVALID:
            saldo_real_map[aid] = {
                "saldo": s.get("saldo", 0) or 0,
                "debe":  s.get("debe", 0) or 0,
                "haber": s.get("haber", 0) or 0,
                "name":  s.get("account_name", ""),
            }
            if s.get("account_name"):
                names[aid] = str(s["account_name"]).strip()

    all_accounts = set(totals.keys()) | set(saldo_real_map.keys())
    results = []

    for aid in all_accounts:
        saldo_calc = round(totals.get(aid, 0.0), 6)
        real = saldo_real_map.get(aid, {})
        saldo_real = real.get("saldo", 0)
        diferencia = round(saldo_calc - saldo_real, 6)
        estado = "CONCILIADO" if abs(diferencia) < 0.0001 else "DISCREPANCIA"

        results.append({
            "account_id": aid,
            "account_name": names.get(aid, ""),
            "depositos_usdt":   round(sum((d.get("crypto_quantity", 0) or 0) for d in depositos if str(d.get("account_id", "")).strip() == aid), 4),
            "retiros_usdt":     round(sum((r.get("crypto_quantity", 0) or 0) + (r.get("crypto_fee", 0) or 0) for r in retiros if str(r.get("account_id", "")).strip() == aid), 4),
            "transfers_neto":   round(totals.get(aid, 0) - sum((d.get("crypto_quantity", 0) or 0) for d in depositos if str(d.get("account_id", "")).strip() == aid) + sum((r.get("crypto_quantity", 0) or 0) + (r.get("crypto_fee", 0) or 0) for r in retiros if str(r.get("account_id", "")).strip() == aid), 4),
            "saldo_calculado":  saldo_calc,
            "saldo_real":       round(saldo_real, 6),
            "diferencia":       diferencia,
            "estado":           estado,
        })

    results.sort(key=lambda x: abs(x["diferencia"]), reverse=True)
    return results


# ──────────────────────────────────────────────
# 4. Saldo BOB por cliente (S-001 y S-002)
#    Pagos QR → DEBE (el cliente pagó, sale BOB)
#    Cobros QR → HABER (el cliente cobró, entra BOB)
# ──────────────────────────────────────────────
def reconcile_saldos_bob(
    pagos_qr: list[dict],
    cobros_qr: list[dict],
) -> list[dict]:
    debe: Dict[str, float] = {}
    haber: Dict[str, float] = {}
    names: Dict[str, str] = {}

    def _add_bob(store: Dict[str, float], row: dict, monto_keys: list):
        cuenta = str(row.get("numero_cuenta", row.get("cuenta", ""))).strip()
        if not cuenta or cuenta.lower() in _INVALID:
            return
        nombre = str(row.get("creado_por", row.get("nombre", ""))).strip()
        monto = next((row.get(k, 0) or 0 for k in monto_keys if row.get(k) is not None), 0)
        store[cuenta] = store.get(cuenta, 0.0) + float(monto)
        if nombre:
            names[cuenta] = nombre

    for p in pagos_qr:
        _add_bob(debe, p, ["monto_pagado", "monto_intercambio"])

    for c in cobros_qr:
        _add_bob(haber, c, ["monto_pagado", "importe_neto", "monto_intercambio"])

    all_cuentas = set(debe.keys()) | set(haber.keys())
    results = []
    for cuenta in all_cuentas:
        d = round(debe.get(cuenta, 0.0), 2)
        h = round(haber.get(cuenta, 0.0), 2)
        saldo = round(h - d, 2)
        results.append({
            "numero_cuenta": cuenta,
            "cliente": names.get(cuenta, ""),
            "debe_bob": d,
            "haber_bob": h,
            "saldo_bob": saldo,
        })

    results.sort(key=lambda x: abs(x["saldo_bob"]), reverse=True)
    return results


# ──────────────────────────────────────────────
# 5. Métricas generales
# ──────────────────────────────────────────────
def compute_metricas(
    conciliacion_pagos: list[dict],
    conciliacion_cobros: list[dict],
    depositos: list[dict],
    retiros: list[dict],
    pagos_qr: list[dict],
    cobros_qr: list[dict],
) -> dict:
    all_r = conciliacion_pagos + conciliacion_cobros
    total = len(all_r)
    conciliadas   = sum(1 for r in all_r if r["estado"] == "CONCILIADO")
    discrepancias = sum(1 for r in all_r if r["estado"] == "DISCREPANCIA")
    solo_qr       = sum(1 for r in all_r if r["estado"] == "SOLO_EN_QR")
    solo_banco    = sum(1 for r in all_r if r["estado"] == "SOLO_EN_BANCO")

    # Monto total en riesgo por categoría
    monto_solo_qr    = round(sum(abs(r["monto_qr"]    or 0) for r in all_r if r["estado"] == "SOLO_EN_QR"),    2)
    monto_solo_banco = round(sum(abs(r["monto_banco"] or 0) for r in all_r if r["estado"] == "SOLO_EN_BANCO"), 2)
    monto_discrepancia = round(sum(abs(r["diferencia"] or 0) for r in all_r if r["estado"] == "DISCREPANCIA"),  2)
    monto_en_riesgo  = round(monto_solo_qr + monto_solo_banco + monto_discrepancia, 2)

    return {
        "total_transacciones":    total,
        "conciliadas":            conciliadas,
        "discrepancias":          discrepancias,
        "solo_en_qr":             solo_qr,
        "solo_en_banco":          solo_banco,
        "tasa_conciliacion":      round((conciliadas / total) * 100, 2) if total > 0 else 0.0,
        "monto_solo_qr_bob":      monto_solo_qr,
        "monto_solo_banco_bob":   monto_solo_banco,
        "monto_discrepancia_bob": monto_discrepancia,
        "monto_en_riesgo_bob":    monto_en_riesgo,
        "total_usdt_depositado":  round(sum(d.get("crypto_quantity", 0) or 0 for d in depositos), 4),
        "total_usdt_retirado":    round(sum(r.get("crypto_quantity", 0) or 0 for r in retiros), 4),
        "total_bob_pagos":        round(sum(p.get("monto_pagado", 0) or 0 for p in pagos_qr), 2),
        "total_bob_cobros":       round(sum((c.get("monto_pagado") or c.get("importe_neto") or 0) for c in cobros_qr), 2),
    }


# ── Helpers ──
def _f(row, col: str) -> float:
    v = row.get(col)
    return float(v) if pd.notna(v) and v is not None else 0.0

def _s(row, col: str) -> str:
    v = row.get(col)
    s = str(v) if pd.notna(v) and v is not None else ""
    return "" if s.lower() in _INVALID else s

def _make(row, tipo: str, estado: str, monto_qr=None, monto_banco=None, fecha="") -> dict:
    tid = str(row.get("_tid", ""))
    return {
        "transaccion_id": tid, "tipo": tipo, "estado": estado,
        "fuente_qr":    estado in ("SOLO_EN_QR",),
        "fuente_banco": estado in ("SOLO_EN_BANCO",),
        "monto_qr":    monto_qr,
        "monto_banco": monto_banco,
        "diferencia":  None,
        "fecha":       fecha or _s(row, "fecha"),
    }
