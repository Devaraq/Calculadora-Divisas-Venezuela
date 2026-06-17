import React, { useState, useEffect } from 'react';
import { Home, History, Copy, Check } from 'lucide-react';

// 1. FUNCIONES AUXILIARES (APIs)
// Estas funciones se declaran fuera del componente para no ser re-creadas en cada renderizado.

/**
 * Obtiene la tasa de cambio oficial del BCV (Banco Central de Venezuela).
 * Utiliza la API pública de dolarapi.com.
 * @returns {Promise<number>} La tasa de cambio en formato numérico.
 */
async function obtenerTasaBCV(): Promise<number> {
  const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
  if (!res.ok) throw new Error('Error en API BCV');
  const data = await res.json();
  return Number(data.promedio || data.venta);
}

/**
 * Obtiene la tasa paralela (USDT) desde Binance.
 * Utiliza un proxy local definido en el servidor para eludir las restricciones de CORS.
 * @returns {Promise<number>} La tasa de cambio en formato numérico.
 */
async function obtenerTasaBinance(): Promise<number> {
  const res = await fetch('/api/rates');
  if (!res.ok) throw new Error('Error en API Binance (Proxy)');
  const data = await res.json();
  if (data.usdt) {
    return Number(data.usdt);
  }
  throw new Error('No se pudo obtener tasa USDT del proxy');
}

// Representación de un dato histórico de monedas
export interface HistoricoDolar {
  fecha: string;
  promedio: number;
  fuente: string;
}

/**
 * Obtiene el historial de los tipos de cambio de los últimos días.
 * Trae datos tanto de la fuente oficial como de las fluctuaciones paralelas.
 * @returns {Promise<HistoricoDolar[]>} Un arreglo con el listado de históricos.
 */
async function obtenerHistoricoDolares(): Promise<HistoricoDolar[]> {
  const res = await fetch('https://ve.dolarapi.com/v1/historicos/dolares');
  if (!res.ok) throw new Error('Error en API Histórico');
  const data = await res.json();
  if (Array.isArray(data)) {
    // Tomamos los últimos 40 registros (aprox. 10 días para oficial y paralelo) y los invertimos
    // para mostrar las fechas más recientes de primero en la interfaz.
    return data.slice(-40).reverse();
  }
  return [];
}

// 2. COMPONENTE PRINCIPAL DE LA APLICACIÓN
export default function CalculadoraDivisas() {
  // --- ESTADO GLOBAL DE LA APP ---
  // Controla qué pestaña está activa ('inicio' para calculadora, 'historico' para el historial)
  const [activeTab, setActiveTab] = useState<'inicio' | 'historico'>('inicio');
  
  // Tasas de cambio obtenidas de la red y estado de carga inicial de tasas
  const [tasaBcv, setTasaBcv] = useState<number | null>(null);
  const [tasaUsdt, setTasaUsdt] = useState<number | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  
  // Variables de selección de referencia de tasa activa
  const [fuenteSeleccionada, setFuenteSeleccionada] = useState<'bcv' | 'usdt'>('bcv');

  // Dos campos de texto independientes para la conversión bidireccional limpia y sin loops
  const [montoUSD, setMontoUSD] = useState<string>('');
  const [montoBS, setMontoBS] = useState<string>('');

  // Variables para la sección de histórico (datos crudos y loader del historial)
  const [historicoDatos, setHistoricoDatos] = useState<HistoricoDolar[]>([]);
  const [cargandoHistorico, setCargandoHistorico] = useState<boolean>(false);

  // Estados independientes para copiar al portapapeles sin mezclar interfaz
  const [copiedUSD, setCopiedUSD] = useState<boolean>(false);
  const [copiedBS, setCopiedBS] = useState<boolean>(false);

  /**
   * Manejador para copiar resultados al portapapeles.
   */
  const handleCopyInput = (val: string, type: 'usd' | 'bs') => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    if (type === 'usd') {
      setCopiedUSD(true);
      setTimeout(() => setCopiedUSD(false), 2000);
    } else {
      setCopiedBS(true);
      setTimeout(() => setCopiedBS(false), 2000);
    }
  };

  // --- EFECTOS DE CICLO DE VIDA (useEffect) ---

  // Efecto 1: Carga de tasas actuales (se inicializa solo 1 vez cuando se monta el componente)
  useEffect(() => {
    async function cargarTasas() {
      // Intentamos cargar la tasa BCV Oficial
      try {
        const bcv = await obtenerTasaBCV();
        setTasaBcv(bcv);
      } catch (error) {
        setTasaBcv(null);
      }

      // Intentamos cargar la tasa Binance Proxy
      try {
        const usdt = await obtenerTasaBinance();
        setTasaUsdt(usdt);
      } catch (error) {
        setTasaUsdt(null);
      }
      
      setCargando(false);
    }
    cargarTasas();
  }, []);

  // Efecto 2: Carga perezosa del histórico
  useEffect(() => {
    async function cargarHist() {
      if (activeTab === 'historico' && historicoDatos.length === 0) {
        setCargandoHistorico(true);
        try {
          const hist = await obtenerHistoricoDolares();
          setHistoricoDatos(hist);
        } catch (error) {
          console.error(error);
        }
        setCargandoHistorico(false);
      }
    }
    cargarHist();
  }, [activeTab, historicoDatos.length]);

  // Efecto 3: Inicializar formulario con un valor de 100 USD representativo una vez cargadas las tasas
  useEffect(() => {
    if (!cargando) {
      const uRate = fuenteSeleccionada === 'usdt' 
        ? (tasaUsdt || 44.50) 
        : (tasaBcv || 40.20);
      
      setMontoUSD("100");
      setMontoBS(Number((100 * uRate).toFixed(2)).toString());
    }
  }, [cargando]);

  // --- MANEJADORES DIRECTOS (SIN LOOP Y ALTAMENTE OPTIMIZADOS) ---

  const handleUSDChange = (val: string) => {
    const cleanVal = val.replace(',', '.');
    setMontoUSD(cleanVal);
    
    if (cleanVal === '') {
      setMontoBS('');
      return;
    }
    
    const num = parseFloat(cleanVal);
    if (!isNaN(num)) {
      const activeRate = fuenteSeleccionada === 'usdt' 
        ? (tasaUsdt || 44.50) 
        : (tasaBcv || 40.20);

      const computed = num * activeRate;
      setMontoBS(Number(computed.toFixed(2)).toString());
    } else {
      setMontoBS('');
    }
  };

  const handleBSChange = (val: string) => {
    const cleanVal = val.replace(',', '.');
    setMontoBS(cleanVal);
    
    if (cleanVal === '') {
      setMontoUSD('');
      return;
    }
    
    const num = parseFloat(cleanVal);
    if (!isNaN(num)) {
      const activeRate = fuenteSeleccionada === 'usdt' 
        ? (tasaUsdt || 44.50) 
        : (tasaBcv || 40.20);

      if (activeRate > 0) {
        const computed = num / activeRate;
        setMontoUSD(Number(computed.toFixed(2)).toString());
      } else {
        setMontoUSD('');
      }
    } else {
      setMontoUSD('');
    }
  };

  const handleFuenteSeleccionadaChange = (nuevaFuente: 'bcv' | 'usdt') => {
    setFuenteSeleccionada(nuevaFuente);
    
    let activeRate = 0;
    if (nuevaFuente === 'bcv') {
      activeRate = tasaBcv || 40.20;
    } else if (nuevaFuente === 'usdt') {
      activeRate = tasaUsdt || 44.50;
    }
    
    // Mantenemos el monto de Divisa (USD) fijo y recalculamos Bolívares instantáneamente
    const numUSD = parseFloat(montoUSD);
    if (!isNaN(numUSD) && activeRate > 0) {
      const computed = numUSD * activeRate;
      setMontoBS(Number(computed.toFixed(2)).toString());
    } else {
      setMontoBS('');
    }
  };

  // Brecha cambiaria: Porcentaje diferencial entre la Tasa USDT (Mercado) y la Tasa BCV (Oficial)
  const brechaCambiaria = (tasaBcv && tasaUsdt) ? ((tasaUsdt / tasaBcv) - 1) * 100 : 0;

  // Letreros visuales del tipo de moneda elegida
  const foreignSymbol = '$';
  const foreignSign = '$';

  return (
    <div className="dark bg-background text-on-surface font-body-md min-h-screen flex flex-col items-center">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-sm shrink-0">
        <div className="flex flex-col justify-center py-2 md:py-0 md:h-16 px-4 md:px-stack-lg w-full max-w-container-max mx-auto relative">
          {/* Fila principal */}
          <div className="flex justify-between items-center w-full">
            <div className="font-headline-md text-title-md md:text-title-lg font-bold text-primary tracking-tighter shrink-0 z-10 w-[120px] md:w-auto">DOLAR-FLOW</div>
            
            {/* Tasas Desktop */}
            <div className="hidden md:flex items-center justify-center gap-4 text-sm font-medium absolute left-0 right-0 pointer-events-none">
               <div className="flex items-center gap-2 bg-surface-container-low px-4 py-1.5 rounded-full border border-white/5 text-white shadow-sm pointer-events-auto">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  <span className="text-on-surface-variant">BCV:</span> 
                  <span className="font-bold">{tasaBcv !== null ? tasaBcv.toFixed(2) : "..."} <span className="text-on-surface-variant font-normal text-xs">BS</span></span>
               </div>
               <div className="flex items-center gap-2 bg-surface-container-low px-4 py-1.5 rounded-full border border-white/5 text-white shadow-sm pointer-events-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-on-surface-variant">USDT:</span> 
                  <span className="font-bold">{tasaUsdt !== null ? tasaUsdt.toFixed(2) : "..."} <span className="text-on-surface-variant font-normal text-xs">BS</span></span>
               </div>
            </div>

            <nav className="flex gap-1 items-center shrink-0 z-10">
              <button 
                onClick={() => setActiveTab('inicio')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-transparent transition-colors ${activeTab === 'inicio' ? 'bg-primary/10 text-primary border-primary/20' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'}`}
              >
                <Home size={16} />
                <span className="font-medium font-body-md text-[11px] md:text-sm">Inicio</span>
              </button>
              <button 
                onClick={() => setActiveTab('historico')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-transparent transition-colors ${activeTab === 'historico' ? 'bg-primary/10 text-primary border-primary/20' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'}`}
              >
                <History size={16} />
                <span className="font-medium font-body-md text-[11px] md:text-sm">Histórico</span>
              </button>
            </nav>
          </div>
          
          {/* Tasas Mobile (se muestran debajo del header principal) */}
          <div className="flex md:hidden items-center justify-between gap-1 w-full mt-2 text-[10px] font-medium border-t border-white/5 pt-2 px-1">
             <div className="flex items-center gap-1 text-white flex-1 justify-start">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                <span className="text-on-surface-variant">BCV:</span> 
                <span className="font-bold">{tasaBcv !== null ? tasaBcv.toFixed(2) : "..."}</span>
             </div>
             <div className="w-[1px] h-3 bg-white/10"></div>
             <div className="flex items-center gap-1 text-white flex-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                <span className="text-on-surface-variant">USDT:</span> 
                <span className="font-bold">{tasaUsdt !== null ? tasaUsdt.toFixed(2) : "..."}</span>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col justify-center items-center w-full max-w-xl px-4 pt-[6.5rem] md:pt-24 pb-6 mx-auto">
        {activeTab === 'inicio' ? (
          <div className="w-full flex flex-col justify-center fade-in">
            {/* Visual Carga */}
            {cargando && (
              <div className="mb-6 py-2 px-6 rounded-full glass-card border-primary/20 text-primary font-bold animate-pulse text-center self-center shrink-0">
                Sincronizando tasas bancarias...
              </div>
            )}

            {/* Calculadora Directa y Comparada */}
            <section className="w-full flex-grow flex flex-col glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 relative overflow-hidden shrink-0">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col justify-center gap-5 sm:gap-6 h-full">
                <div className="text-center shrink-0">
                  <h1 className="text-title-lg sm:text-headline-md font-headline-md text-on-surface mb-1">Calculadora Simultánea</h1>
                  <p className="text-[11px] sm:text-label-sm font-label-sm text-on-surface-variant">
                    Conversión bidireccional en tiempo real libre de loops
                  </p>
                </div>

                {/* MENÚ DE SELECCIÓN DE PRECIO / REFERENCIA */}
                <div className="flex flex-col gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant/80 ml-1">
                    Seleccionar Precio Activo
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => handleFuenteSeleccionadaChange('bcv')}
                      className={`flex flex-col items-center justify-center py-2 px-1 text-center rounded-lg transition-all focus:outline-none ${
                        fuenteSeleccionada === 'bcv'
                          ? 'bg-primary/20 border border-primary/30 text-primary font-bold shadow-md shadow-primary/5'
                          : 'hover:bg-white/5 border border-transparent text-on-surface-variant'
                      }`}
                    >
                      <span className="text-[11px] sm:text-xs">Dólar BCV</span>
                      <span className="text-[12px] sm:text-sm font-semibold tracking-tight">
                        {tasaBcv !== null ? tasaBcv.toFixed(2) : "..."} <span className="text-[8px] font-normal">Bs</span>
                      </span>
                    </button>

                    <button
                      onClick={() => handleFuenteSeleccionadaChange('usdt')}
                      className={`flex flex-col items-center justify-center py-2 px-1 text-center rounded-lg transition-all focus:outline-none ${
                        fuenteSeleccionada === 'usdt'
                          ? 'bg-emerald-400/20 border border-emerald-400/30 text-emerald-400 font-bold shadow-md shadow-emerald-400/5'
                          : 'hover:bg-white/5 border border-transparent text-on-surface-variant'
                      }`}
                    >
                      <span className="text-[11px] sm:text-xs">USDT Binance</span>
                      <span className="text-[12px] sm:text-sm font-semibold tracking-tight">
                        {tasaUsdt !== null ? tasaUsdt.toFixed(2) : "..."} <span className="text-[8px] font-normal">Bs</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* FORMULARIO DE CONVERSIÓN BIDIRECCIONAL */}
                <div className="flex flex-col gap-3 relative shrink-0">
                  
                  {/* Bloque Divisa (USD / EUR) */}
                  <div className="bg-surface-container-low/40 rounded-2xl p-4 sm:p-5 border border-white/5 focus-within:border-primary/40 transition-all flex flex-col gap-1">
                    <div className="flex justify-between items-center text-label-sm text-on-surface-variant font-medium">
                      <span>Monto en Divisa ({foreignSymbol})</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-primary">
                        1 {foreignSymbol} = {(fuenteSeleccionada === 'usdt' ? (tasaUsdt || 44.50) : (tasaBcv || 40.20)).toFixed(2)} Bs
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                        <span className="text-xl sm:text-2xl font-bold text-primary font-mono-data shrink-0">
                          {foreignSign}
                        </span>
                        <input 
                          type="number" 
                          value={montoUSD} 
                          onChange={(e) => handleUSDChange(e.target.value)}
                          placeholder="0.00"
                          className="bg-transparent border-none p-0 text-2xl sm:text-3xl font-display-lg text-white w-full focus:ring-0 placeholder:text-surface-container-highest focus:outline-none min-w-0"
                        />
                      </div>
                      
                      <button 
                        onClick={() => handleCopyInput(montoUSD, 'usd')}
                        className="text-on-surface-variant hover:text-primary transition-colors focus:outline-none bg-white/5 hover:bg-white/10 p-2 rounded-xl shrink-0"
                        title="Copiar cifra de divisa"
                        disabled={!montoUSD}
                      >
                        {copiedUSD ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Bloque Bolívares (VES) */}
                  <div className="bg-surface-container-low/40 rounded-2xl p-4 sm:p-5 border border-white/5 focus-within:border-emerald-400/40 transition-all flex flex-col gap-1">
                    <div className="text-label-sm text-on-surface-variant font-medium block">
                      Monto en Bolívares (VES)
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                        <span className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono-data shrink-0">
                          Bs
                        </span>
                        <input 
                          type="number" 
                          value={montoBS} 
                          onChange={(e) => handleBSChange(e.target.value)}
                          placeholder="0.00"
                          className="bg-transparent border-none p-0 text-2xl sm:text-3xl font-display-lg text-white w-full focus:ring-0 placeholder:text-surface-container-highest focus:outline-none min-w-0"
                        />
                      </div>

                      <button 
                        onClick={() => handleCopyInput(montoBS, 'bs')}
                        className="text-on-surface-variant hover:text-emerald-400 transition-colors focus:outline-none bg-white/5 hover:bg-white/10 p-2 rounded-xl shrink-0"
                        title="Copiar cifra en bolívares"
                        disabled={!montoBS}
                      >
                        {copiedBS ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>

                </div>

                {/* DETALLE ANALÍTICO EXTRA */}
                {tasaBcv !== null && tasaUsdt !== null && (
                  <div className="pt-2 border-t border-white/5 shrink-0 flex justify-between items-center text-[11px] sm:text-label-sm">
                    <span className="text-on-surface-variant">Brecha Cambiaria BCV vs. USDT:</span> 
                    <span className="font-bold text-primary tracking-wide">
                      {brechaCambiaria.toFixed(2)}%
                    </span>
                  </div>
                )}

              </div>
            </section>
          </div>
        ) : (
          <section className="w-full flex flex-col justify-center fade-in">
            <div className="w-full glass-card rounded-2xl md:rounded-3xl p-4 md:p-8 relative overflow-hidden flex flex-col">
               <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[80px] rounded-full pointer-events-none"></div>
               
               <div className="relative z-10 flex flex-col">
                 <div className="text-center mb-3 sm:mb-5 shrink-0">
                    <h1 className="text-title-lg sm:text-headline-md font-headline-md text-on-surface mb-1">Histórico Dólares</h1>
                    <p className="text-[11px] sm:text-label-sm font-label-sm text-on-surface-variant">
                      Últimas tasas publicadas de BCV y USDT
                    </p>
                 </div>

                 {cargandoHistorico ? (
                   <div className="py-12 flex justify-center shrink-0">
                     <div className="animate-pulse text-primary font-bold">Cargando datos históricos...</div>
                   </div>
                 ) : (
                   <div className="flex flex-col gap-2 flex-grow">
                     {historicoDatos.map((dato, i) => {
                       const fecha = new Date(dato.fecha);
                       const dia = String(fecha.getDate()).padStart(2, '0');
                       const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                       const anio = fecha.getFullYear();
                       const fechaStr = `${dia}/${mes}/${anio}`;
                       
                       const isBcv = dato.fuente === 'oficial';
                       
                       return (
                         <div key={i} className="flex justify-between items-center bg-surface-container-low/40 p-3 sm:p-4 rounded-xl border border-white/5 hover:border-primary/20 transition-colors shrink-0">
                           <div className="flex items-center gap-2 sm:gap-3">
                             <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${isBcv ? 'bg-primary/20 text-primary' : 'bg-emerald-400/20 text-emerald-400'}`}>
                               <History size={16} className="sm:w-[18px] sm:h-[18px]" />
                             </div>
                             <div className="flex flex-col">
                               <span className="text-[12px] sm:text-body-md font-medium text-white">{fechaStr}</span>
                               <span className="text-[10px] sm:text-label-sm text-on-surface-variant uppercase">{isBcv ? 'Dólar BCV' : 'Dólar USDT'}</span>
                             </div>
                           </div>
                           <div className="text-right flex items-center gap-2">
                             <div className="flex flex-col items-end">
                               <span className={`text-title-md sm:text-title-lg font-bold ${isBcv ? 'text-primary' : 'text-emerald-400'}`}>{dato.promedio.toFixed(2)}</span>
                               <span className="text-[10px] sm:text-label-sm text-on-surface-variant font-medium">BS</span>
                             </div>
                           </div>
                         </div>
                       );
                     })}
                     
                     {historicoDatos.length === 0 && (
                       <div className="text-center py-8 text-on-surface-variant shrink-0">No se encontraron datos históricos.</div>
                     )}
                   </div>
                 )}
               </div>
            </div>
          </section>
        )}
      </main>

      <footer className="w-full py-4 mt-auto border-t border-white/5 bg-background shrink-0">
        <div className="flex justify-center items-center px-4 w-full">
          <p className="font-label-sm text-[10px] sm:text-xs text-on-surface-variant text-center">© 2026 DOLAR-FLOW. Aplicación estricta y sin librerías externas de diseño, utilizando Fetch APIs nativas.</p>
        </div>
      </footer>
    </div>
  );
}
