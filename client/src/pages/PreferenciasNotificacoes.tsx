import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { BellRing, Bell, BellOff, Smartphone } from "lucide-react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

const MASTER_EMAIL = "afonsoqueirogagn@gmail.com";

const EVENT_CATEGORIES = [
  { type: "supplier_response", label: "Fornecedor respondeu cotação", icon: "📩" },
  { type: "order_generated", label: "Pedido de compra gerado", icon: "🛒" },
  { type: "quotation_reopened", label: "Cotação reaberta", icon: "🔄" },
  { type: "price_alert", label: "Alerta de preço (aumento >10%)", icon: "⚠️" },
  { type: "delivery_adjusted", label: "Ajuste de entrega", icon: "✂️" },
  { type: "no_response_48h", label: "Sem resposta em 48h", icon: "⏰" },
  { type: "doc_expired", label: "Documentação vencida", icon: "📄" },
  { type: "system", label: "Avisos do sistema", icon: "🔔" },
];

type PrefState = Record<string, { inApp: boolean; push: boolean }>;

export default function PreferenciasNotificacoes() {
  const { user } = useAuth();
  const isMaster = user?.email === MASTER_EMAIL;

  const { data: savedPrefs, isLoading } = trpc.notifications.getPreferences.useQuery();
  const { data: vapidKey } = trpc.notifications.vapidPublicKey.useQuery();
  const saveMutation = trpc.notifications.savePreferences.useMutation({
    onSuccess: () => toast.success("Preferências salvas"),
  });
  const subscribePushMutation = trpc.notifications.subscribePush.useMutation({
    onSuccess: () => toast.success("Push ativado neste dispositivo"),
  });
  const unsubscribePushMutation = trpc.notifications.unsubscribePush.useMutation({
    onSuccess: () => toast.success("Push desativado"),
  });

  const [prefs, setPrefs] = useState<PrefState>({});
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission as any);
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  useEffect(() => {
    if (savedPrefs) {
      const map: PrefState = {};
      EVENT_CATEGORIES.forEach(cat => {
        const saved = savedPrefs.find((p: any) => p.eventType === cat.type);
        map[cat.type] = { inApp: saved ? saved.inAppEnabled : true, push: saved ? saved.pushEnabled : true };
      });
      setPrefs(map);
    }
  }, [savedPrefs]);

  const togglePref = useCallback((type: string, channel: 'inApp' | 'push') => {
    setPrefs(prev => ({
      ...prev,
      [type]: { ...prev[type], [channel]: !prev[type]?.[channel] },
    }));
  }, []);

  const handleSave = useCallback(() => {
    const payload = EVENT_CATEGORIES.map(cat => ({
      eventType: cat.type,
      inAppEnabled: prefs[cat.type]?.inApp ?? true,
      pushEnabled: prefs[cat.type]?.push ?? true,
    }));
    saveMutation.mutate(payload);
  }, [prefs, saveMutation]);

  const handleActivatePush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error("Push não suportado neste navegador");
      return;
    }
    if (!vapidKey) {
      toast.error("Chaves VAPID não configuradas. Contate o administrador.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission as any);
      if (permission !== 'granted') {
        toast.error("Permissão de notificação negada");
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON();
      subscribePushMutation.mutate({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
      });
    } catch (err) {
      console.error("Push registration failed:", err);
      toast.error("Falha ao ativar push");
    }
  }, [vapidKey, subscribePushMutation]);

  if (isLoading) return <DashboardLayout><div className="animate-pulse h-40" /></DashboardLayout>;

  if (!isMaster) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground max-w-md">
            Apenas o administrador master pode definir quais alertas aparecem e quando.
            Suas notificações seguem as regras configuradas pelo administrador.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BellRing className="h-6 w-6" /> Preferências de Notificação
          </h1>
          <p className="text-muted-foreground mt-1">Escolha quais alertas receber e por qual canal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Push no Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pushStatus === 'unsupported' ? (
              <p className="text-sm text-muted-foreground">Push não suportado neste navegador. No iPhone/iPad, adicione o site à Tela de Início para ativar.</p>
            ) : pushStatus === 'denied' ? (
              <p className="text-sm text-red-500">Permissão de notificação negada. Acesse as configurações do navegador para reativar.</p>
            ) : pushStatus === 'granted' ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-600 flex items-center gap-2"><Bell className="h-4 w-4" /> Push ativo neste dispositivo</p>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.serviceWorker?.ready.then(reg => reg.pushManager.getSubscription().then(sub => {
                    if (sub) {
                      unsubscribePushMutation.mutate({ endpoint: sub.endpoint });
                      sub.unsubscribe();
                    }
                  }));
                }}>
                  <BellOff className="h-4 w-4 mr-1" /> Desativar
                </Button>
              </div>
            ) : (
              <Button onClick={handleActivatePush}>
                <Bell className="h-4 w-4 mr-1" /> Ativar alertas neste dispositivo
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_60px_60px] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <span>Evento</span>
                <span className="text-center">Sino</span>
                <span className="text-center">Push</span>
              </div>
              {EVENT_CATEGORIES.map(cat => (
                <div key={cat.type} className="grid grid-cols-[1fr_60px_60px] gap-2 items-center">
                  <span className="text-sm flex items-center gap-2">
                    <span>{cat.icon}</span> {cat.label}
                  </span>
                  <div className="flex justify-center">
                    <Switch
                      checked={prefs[cat.type]?.inApp ?? true}
                      onCheckedChange={() => togglePref(cat.type, 'inApp')}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={prefs[cat.type]?.push ?? true}
                      onCheckedChange={() => togglePref(cat.type, 'push')}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Preferências"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
