import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({ baseURL: BASE })

export const previewExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/preview', form)
}

export const uploadExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload', form)
}

export const uploadExcelSheets = (file, selectedSheets) => {
  const form = new FormData()
  form.append('file', file)
  form.append('sheets', JSON.stringify(selectedSheets))
  return api.post('/upload', form)
}

export const uploadCsv = (files, metadata) => {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  form.append('metadata', JSON.stringify(metadata))
  return api.post('/upload-csv', form)
}

export const getMetricas = () => api.get('/metricas')
export const getConciliacion = (params) => api.get('/conciliacion', { params })
export const getConciliacionPagos = (params) => api.get('/conciliacion/pagos', { params })
export const getConciliacionCobros = (params) => api.get('/conciliacion/cobros', { params })
export const getSaldos = (params) => api.get('/saldos', { params })
export const getSaldosBob = (params) => api.get('/saldos/bob', { params })
export const getExportar = () => api.get('/exportar', { responseType: 'blob' })
export const getExportarDiscrepancias = (tipo) =>
  api.get('/exportar/discrepancias', { params: tipo ? { tipo } : {}, responseType: 'blob' })
