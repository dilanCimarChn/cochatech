from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Deposito(BaseModel):
    user_id: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    fecha: Optional[str] = None
    crypto_quantity: Optional[float] = None
    product: Optional[str] = None
    ticket_number: Optional[str] = None
    ticket_status: Optional[str] = None
    blockchain: Optional[str] = None


class Retiro(BaseModel):
    user_id: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    fecha: Optional[str] = None
    crypto_quantity: Optional[float] = None
    product: Optional[str] = None
    crypto_fee: Optional[float] = None
    ticket_number: Optional[str] = None
    ticket_status: Optional[str] = None
    monto_antes_comision: Optional[float] = None


class PagoQR(BaseModel):
    numero_cotizacion: Optional[str] = None
    fecha_creacion: Optional[str] = None
    estado: Optional[str] = None
    creado_por: Optional[str] = None
    numero_cuenta: Optional[str] = None
    monto_intercambio: Optional[float] = None
    monto_pagado: Optional[float] = None
    moneda: Optional[str] = None
    precio: Optional[float] = None
    comision: Optional[float] = None
    transaccion_id: Optional[str] = None


class CobroQR(BaseModel):
    numero_cotizacion: Optional[str] = None
    fecha_creacion: Optional[str] = None
    estado: Optional[str] = None
    creado_por: Optional[str] = None
    numero_cuenta: Optional[str] = None
    monto_intercambio: Optional[float] = None
    monto_pagado: Optional[float] = None
    moneda: Optional[str] = None
    comision: Optional[float] = None
    transaccion_id: Optional[str] = None
    importe_neto: Optional[float] = None


class Transfer(BaseModel):
    created_at: Optional[str] = None
    transfer_number: Optional[str] = None
    amount: Optional[float] = None
    sender_account: Optional[str] = None
    sender_alias: Optional[str] = None
    product_symbol: Optional[str] = None
    receiver_account: Optional[str] = None
    receiver_alias: Optional[str] = None


class ExtractoPago(BaseModel):
    fecha: Optional[str] = None
    hora: Optional[str] = None
    codigo_transaccion: Optional[str] = None
    importe_bolivianos: Optional[float] = None


class ExtractoCobro(BaseModel):
    fecha: Optional[str] = None
    hora: Optional[str] = None
    codigo_transaccion: Optional[str] = None
    importe_bolivianos: Optional[float] = None


class ConciliacionResultado(BaseModel):
    transaccion_id: str
    fuente_qr: bool
    fuente_banco: bool
    monto_qr: Optional[float] = None
    monto_banco: Optional[float] = None
    diferencia: Optional[float] = None
    estado: str
    tipo: str
    fecha: Optional[str] = None


class SaldoCliente(BaseModel):
    account_id: str
    account_name: Optional[str] = None
    saldo_calculado: float
    saldo_real: float
    diferencia: float
    estado: str


class Metricas(BaseModel):
    total_transacciones: int
    conciliadas: int
    discrepancias: int
    solo_en_qr: int
    solo_en_banco: int
    total_usdt_depositado: float
    total_usdt_retirado: float
    total_bob_pagos: float
    total_bob_cobros: float
    tasa_conciliacion: float
