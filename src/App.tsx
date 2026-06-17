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
  
  // Variables del formulario de conversión
  const [monto, setMonto] = useState<string>('');
  const [monedaOrigen, setMonedaOrigen] = useState<'USD' | 'BS'>('USD');
  
  // Resultados convertidos re-calculados instantáneamente
  const [resultadoBcv, setResultadoBcv] = useState<number>(0);
  const [resultadoUsdt, setResultadoUsdt] = useState<number>(0);

  // Variables para la sección de histórico (datos crudos y loader del historial)
  const [historicoDatos, setHistoricoDatos] = useState<HistoricoDolar[]>([]);
  const [cargandoHistorico, setCargandoHistorico] = useState<boolean>(false);

  // Estados visuales para los botones de "copiar al portapapeles"
  const [copiedBcv, setCopiedBcv] = useState<boolean>(false);
  const [copiedUsdt, setCopiedUsdt] = useState<boolean>(false);

  /**
   * Manejador para copiar resultados al portapapeles.
   * Modifica el botón a un ícono de check durante 2 segundos.
   */
  const handleCopy = (value: number, type: 'bcv' | 'usdt') => {
    const formattedValue = value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2});
    navigator.clipboard.writeText(formattedValue);
    
    if (type === 'bcv') {
      setCopiedBcv(true);
      setTimeout(() => setCopiedBcv(false), 2000);
    } else {
      setCopiedUsdt(true);
      setTimeout(() => setCopiedUsdt(false), 2000);
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
        setTasaBcv(null); // Indicador de fallback o error en la interfaz
      }

      // Intentamos cargar la tasa Binance Proxy
      try {
        const usdt = await obtenerTasaBinance();
        setTasaUsdt(usdt);
      } catch (error) {
        setTasaUsdt(null); // Indicador de fallback o error en la interfaz
      }
      
      // Una vez ambas promesas finalizan (o fallan), apagamos el 'loader' global.
      setCargando(false);
    }
    cargarTasas();
  }, []);

  // Efecto 2: Carga perezosa del histórico
  // Solo se carga el histórico si el usuario navega a la pestaña activa 'historico'
  // y si los datos aún no han sido cargados.
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

  // Efecto 3: Motor Reactivo de Cálculos
  // Se gatilla siempre que cambia el monto, la moneda seleccionada o si las tasas se actualizan en la red.
  useEffect(() => {
    const valorMonto = Number(monto) || 0;
    
    // 1er Bloque: Motor del Dólar BCV
    if (tasaBcv !== null) {
      if (monedaOrigen === 'USD') {
         // Si estoy calculando divisas -> bs, multiplico el valor por la tasa respectiva
         setResultadoBcv(valorMonto * tasaBcv);
      } else {
         // Si el usuario introduce bs e invirtió el sistema, calculo la división proporcional
         setResultadoBcv(valorMonto / tasaBcv);
      }
    } else {
      setResultadoBcv(0);
    }

    // 2do Bloque: Motor del Dólar Binance USDT
    if (tasaUsdt !== null) {
      if (monedaOrigen === 'USD') {
         setResultadoUsdt(valorMonto * tasaUsdt);
      } else {
         setResultadoUsdt(valorMonto / tasaUsdt);
      }
    } else {
      setResultadoUsdt(0);
    }
  }, [monto, tasaBcv, tasaUsdt, monedaOrigen]);

  // Funciones y Derivaciones
  const swapCurrencies = () => {
    setMonedaOrigen(prev => prev === 'BS' ? 'USD' : 'BS');
  };

  // Variable de utilidad para saber qué sufijo vamos a proyectar ('BS' o 'USD' / 'USDT')
  const isConvertingToBs = monedaOrigen === 'USD';
  
  // Brecha cambiaria: Porcentaje diferencial entra la Tasa USDT(Mayor) y la Tasa BCV(Menor)
  const brechaCambiaria = (tasaBcv && tasaUsdt) ? ((tasaUsdt / tasaBcv) - 1) * 100 : 0;

  return (
    <div className="dark bg-background text-on-surface font-body-md min-h-screen flex flex-col items-center">
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-sm shrink-0">
        <div className="flex flex-col justify-center py-2 md:py-0 md:h-16 px-4 md:px-stack-lg w-full max-w-container-max mx-auto relative">
          {/* Fila principal */}
          <div className="flex justify-between items-center w-full">
            <div className="font-headline-md text-title-md md:text-title-lg font-bold text-primary tracking-tighter shrink-0 z-10 w-[120px] md:w-auto">BOLIVAR FLOW</div>
            
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
          <div className="flex md:hidden items-center justify-between gap-2 w-full mt-2 text-[11px] font-medium border-t border-white/5 pt-2 px-1">
             <div className="flex items-center gap-1.5 text-white flex-1 justify-start">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                <span className="text-on-surface-variant">BCV:</span> 
                <span className="font-bold">{tasaBcv !== null ? tasaBcv.toFixed(2) : "..."}</span>
             </div>
             <div className="w-[1px] h-3 bg-white/10"></div>
             <div className="flex items-center gap-1.5 text-white flex-1 justify-end">
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
                Cargando tasas...
              </div>
            )}

            {/* Calculadora Directa y Comparada */}
            <section className="w-full flex-grow flex flex-col glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 relative overflow-hidden shrink-0">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col justify-center gap-4 sm:gap-6 h-full">
                <div className="text-center shrink-0">
                  <h1 className="text-title-lg sm:text-headline-md font-headline-md text-on-surface mb-1">Calculadora Simultánea</h1>
                  <p className="text-[11px] sm:text-label-sm font-label-sm text-on-surface-variant">
                    Comparativa automática en tiempo real
                  </p>
                </div>

                {/* Sección de Entrada */}
                <div className="flex flex-col gap-1 sm:gap-2 relative shrink-0">
                  <div className="bg-surface-container-low/30 rounded-2xl p-4 sm:p-5 border border-white/5 focus-within:border-primary/40 transition-all z-10">
                    <label className="text-label-sm font-label-sm text-on-surface-variant block mb-1 sm:mb-2">Monto a Convertir</label>
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                      <input 
                        type="number" 
                        value={monto} 
                        onChange={(e) => setMonto(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent border-none p-0 text-headline-md sm:text-display-lg font-display-lg text-primary w-full focus:ring-0 placeholder:text-surface-container-highest focus:outline-none min-w-0"
                      />
                      <div className="flex items-center gap-1 sm:gap-2 bg-surface-container-high px-2 sm:px-3 py-1.5 sm:py-3 rounded-xl border border-white/5 shrink-0">
                        <select 
                          value={monedaOrigen} 
                          onChange={(e) => setMonedaOrigen(e.target.value as any)}
                          className="bg-transparent border-none p-0 m-0 text-white font-bold text-sm sm:text-base font-mono-data focus:ring-0 focus:outline-none cursor-pointer"
                        >
                          <option value="USD" className="bg-background text-white">USD</option>
                          <option value="BS" className="bg-background text-white">BS</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center -my-3 sm:-my-4 z-20 relative">
                    <button 
                      onClick={swapCurrencies}
                      className="w-10 h-10 flex-shrink-0 sm:w-12 sm:h-12 bg-surface-container-highest border-[3px] border-background rounded-full flex items-center justify-center text-primary hover:scale-110 active:scale-95 transition-all shadow-xl focus:outline-none"
                      title="Invertir Monedas"
                    >
                      <span className="material-symbols-outlined font-bold text-[20px] sm:text-[24px]">swap_vert</span>
                    </button>
                  </div>
                </div>

                {/* Sección de Resultados Comparados Simultáneos */}
                <div className="pt-3 sm:pt-4 border-t border-white/5 shrink-0">
                   <h3 className="text-[11px] sm:text-label-sm font-label-sm text-on-surface-variant uppercase mb-2 sm:mb-4 text-center">
                     Resultados
                   </h3>
                   
                   <div className="flex flex-col gap-2 sm:gap-4">
                     <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-4 bg-surface-container-low/50 rounded-xl sm:rounded-2xl border border-white/5">
                        <span className="text-label-sm sm:text-title-sm font-medium text-white flex items-center gap-1.5 sm:gap-2">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary inline-block shrink-0"></span> Dólar BCV
                        </span>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <span className="text-title-sm sm:text-headline-md font-headline-md text-white font-bold text-right truncate">
                                {resultadoBcv > 0 ? resultadoBcv.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2}) : "0.00"} 
                                <span className="text-on-surface-variant text-[11px] sm:text-title-sm font-normal ml-1 sm:ml-2">
                                  {isConvertingToBs ? 'BS' : 'USD'}
                                </span>
                            </span>
                            <button 
                              onClick={() => handleCopy(resultadoBcv, 'bcv')}
                              className="text-on-surface-variant hover:text-primary transition-colors focus:outline-none flex items-center justify-center p-1 sm:p-2 bg-white/5 rounded-lg shrink-0"
                              title="Copiar resultado"
                            >
                              {copiedBcv ? <Check size={14} className="text-emerald-400 sm:w-5 sm:h-5" /> : <Copy size={14} className="sm:w-5 sm:h-5" />}
                            </button>
                        </div>
                     </div>

                     <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-4 bg-surface-container-low/50 rounded-xl sm:rounded-2xl border border-white/5">
                        <span className="text-label-sm sm:text-title-sm font-medium text-white flex items-center gap-1.5 sm:gap-2">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 inline-block shrink-0"></span> Dólar USDT
                        </span>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <span className="text-title-sm sm:text-headline-md font-headline-md text-white font-bold text-right truncate">
                                {resultadoUsdt > 0 ? resultadoUsdt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2}) : "0.00"} 
                                <span className="text-on-surface-variant text-[11px] sm:text-title-sm font-normal ml-1 sm:ml-2">
                                  {isConvertingToBs ? 'BS' : 'USDT'}
                                </span>
                            </span>
                            <button 
                              onClick={() => handleCopy(resultadoUsdt, 'usdt')}
                              className="text-on-surface-variant hover:text-emerald-400 transition-colors focus:outline-none flex items-center justify-center p-1 sm:p-2 bg-white/5 rounded-lg shrink-0"
                              title="Copiar resultado"
                            >
                              {copiedUsdt ? <Check size={14} className="text-emerald-400 sm:w-5 sm:h-5" /> : <Copy size={14} className="sm:w-5 sm:h-5" />}
                            </button>
                        </div>
                     </div>
                   </div>
                   
                   {tasaBcv !== null && tasaUsdt !== null && (
                     <p className="mt-4 sm:mt-5 text-center text-[11px] sm:text-label-sm text-primary font-medium tracking-wide">
                        Brecha Cambiaria Analítica: <strong className="font-bold">{brechaCambiaria.toFixed(2)}%</strong>
                     </p>
                   )}
                </div>
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
          <p className="font-label-sm text-[10px] sm:text-xs text-on-surface-variant text-center">© 2026 Bolivar Flow. Aplicación estricta y sin librerías externas de diseño, utilizando Fetch APIs nativas.</p>
        </div>
      </footer>
    </div>
  );
}
