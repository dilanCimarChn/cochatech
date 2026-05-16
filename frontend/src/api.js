import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({ baseURL: BASE })

export const uploadExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload', form)
}

export const getMetricas = () => api.get('/metricas')
export const getConciliacion = (params) => api.get('/conciliacion', { params })
export const getConciliacionPagos = (params) => api.get('/conciliacion/pagos', { params })
export const getConciliacionCobros = (params) => api.get('/conciliacion/cobros', { params })
export const getSaldos = (params) => api.get('/saldos', { params })
export const getExportar = () => api.get('/exportar', { responseType: 'blob' })
