import { useState, useEffect, useRef, useCallback } from 'react';
import { QrCode, CheckCircle2, Loader2, Smartphone, Unplug, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../lib/toast';

type BaileysStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

/**
 * WhatsApp QR (coexistence) connector — links the business's existing WhatsApp
 * number as a "linked device", like WhatsApp Web. The phone keeps working.
 */
export default function BaileysConnect() {
  const [status, setStatus] = useState<BaileysStatus>('disconnected');
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getBaileysStatus();
      setStatus(s.status);
      setQr(s.qr);
      setPhone(s.phone);
      if (s.status === 'connected' || s.status === 'disconnected') stopPolling();
      return s.status;
    } catch {
      return null;
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(refresh, 2500);
  }, [refresh, stopPolling]);

  useEffect(() => {
    refresh().then((s) => {
      if (s === 'qr' || s === 'connecting') startPolling();
    });
    return stopPolling;
  }, [refresh, startPolling, stopPolling]);

  async function handleConnect() {
    setBusy(true);
    try {
      await api.connectBaileys();
      setStatus('connecting');
      startPolling();
    } catch {
      toast.error('No se pudo iniciar la conexión. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar WhatsApp QR? Tendrás que escanear el código de nuevo para reconectar.')) return;
    setBusy(true);
    try {
      await api.disconnectBaileys();
      setStatus('disconnected');
      setQr(null);
      setPhone(null);
      stopPolling();
      toast.success('WhatsApp desconectado');
    } catch {
      toast.error('No se pudo desconectar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-slate-800">WhatsApp por código QR</span>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase">
          Coexistencia
        </span>
        {status === 'connected' && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Conectado
          </span>
        )}
      </div>

      {status === 'connected' ? (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-lg border border-green-100">
          <Smartphone className="w-4 h-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-700">+{phone}</span>
            <p className="text-xs text-slate-400">
              Tu teléfono sigue funcionando normal. La IA responde desde aquí. 🤖
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Desconectar"
          >
            <Unplug className="w-4 h-4" /> Desconectar
          </button>
        </div>
      ) : status === 'qr' && qr ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-xs text-slate-600 text-center">
            Abre <strong>WhatsApp</strong> en tu teléfono → <strong>Dispositivos vinculados</strong> →{' '}
            <strong>Vincular un dispositivo</strong> y escanea:
          </p>
          <img src={qr} alt="Código QR de WhatsApp" className="w-56 h-56 rounded-lg border border-slate-200" />
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Esperando escaneo... el código se renueva solo
          </p>
        </div>
      ) : status === 'connecting' ? (
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Generando código QR...
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            Vincula tu WhatsApp actual escaneando un código QR — igual que WhatsApp Web. Sin esperar
            aprobación de Meta: tu número sigue activo en tu teléfono y ClienteLoop responde con IA en paralelo.
          </p>
          <button
            onClick={handleConnect}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {busy
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando...</>
              : <><QrCode className="w-4 h-4" /> Conectar escaneando QR</>}
          </button>
          <p className="text-[11px] text-amber-600 flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            Método no oficial (protocolo de WhatsApp Web). Úsalo para responder a clientes que te
            escriben; evita envíos masivos no solicitados para proteger tu número.
          </p>
        </>
      )}
    </div>
  );
}
