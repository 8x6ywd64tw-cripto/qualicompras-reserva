import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Lock, AlertTriangle, Users, Crown, UserCheck, UserX } from "lucide-react";
import { useLocation } from "wouter";

const ROLE_LABELS: Record<string, string> = {
  admin: "ADM Master",
  buyer_senior: "Comprador Sênior",
  comprador: "Comprador (Somente Leitura)",
  aprovador: "Aprovador",
  cotador: "Cotador",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  buyer_senior: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  comprador: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  aprovador: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cotador: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

export default function Configuracoes() {
  const { data: masterCheck, isLoading: checkingMaster } = trpc.adminSettings.isMaster.useQuery();
  const { data: passwordData, isLoading: loadingPassword } = trpc.adminSettings.getPassword.useQuery(
    undefined,
    { enabled: masterCheck?.isMaster === true }
  );
  const { data: allUsers, refetch: refetchUsers } = trpc.adminSettings.listUsers.useQuery(
    undefined,
    { enabled: masterCheck?.isMaster === true }
  );
  const changePasswordMutation = trpc.adminSettings.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateRoleMutation = trpc.adminSettings.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Permissão atualizada com sucesso!");
      refetchUsers();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!checkingMaster && !masterCheck?.isMaster) {
      setLocation("/");
    }
  }, [checkingMaster, masterCheck?.isMaster, setLocation]);

  if (checkingMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!masterCheck?.isMaster) {
    return null;
  }

  const handleChangePassword = () => {
    if (!newPassword.trim()) {
      toast.error("Digite a nova senha");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("A senha deve ter no mínimo 4 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    changePasswordMutation.mutate({ newPassword });
  };

  const handleRoleChange = (userId: number, newRole: "admin" | "comprador" | "aprovador" | "buyer_senior") => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground mt-1">
          Painel exclusivo do ADM Master — gerencie a segurança e permissões do aplicativo
        </p>
      </div>

      {/* Gerenciamento de Usuários */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Controle de Acesso — Usuários
          </CardTitle>
          <CardDescription>
            Gerencie quem pode alterar dados no sistema. <strong>Comprador = somente leitura</strong>. Apenas Master e Comprador Sênior podem criar/editar/excluir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!allUsers || allUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {allUsers.map((u: any) => {
                const isSelf = u.email === "afonsoqueirogagn@gmail.com";
                return (
                  <div key={u.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${isSelf ? "bg-purple-50/50 dark:bg-purple-950/10 border-purple-200 dark:border-purple-800" : "bg-muted/30"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isSelf ? "bg-purple-100 dark:bg-purple-900/30" : u.role === "buyer_senior" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-900/30"}`}>
                        {isSelf ? <Crown className="h-4 w-4 text-purple-600" /> : u.role === "buyer_senior" ? <UserCheck className="h-4 w-4 text-blue-600" /> : <UserX className="h-4 w-4 text-gray-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-[10px] ${ROLE_COLORS[u.role] || ROLE_COLORS.comprador}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                      {!isSelf && (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                          disabled={updateRoleMutation.isPending}
                          className="text-xs border rounded px-2 py-1 bg-background"
                        >
                          <option value="comprador">Somente Leitura</option>
                          <option value="buyer_senior">Comprador Sênior</option>
                          <option value="aprovador">Aprovador</option>
                          <option value="cotador">Cotador</option>
                        </select>
                      )}
                      {isSelf && <span className="text-xs text-purple-600 font-medium">Você (Master)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/10 border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              <strong>Comprador (Somente Leitura)</strong>: pode visualizar tudo, mas não pode criar, editar, excluir ou aprovar nada.
              <br /><strong>Comprador Sênior</strong>: pode editar propostas, redirecionar estoque e gerar pedidos.
              <br /><strong>ADM Master</strong>: acesso total e irrestrito.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Senha Atual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Senha de Acesso Universal
          </CardTitle>
          <CardDescription>
            Esta é a senha que todos os usuários usam para acessar o sistema. Somente você pode alterá-la.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha Atual</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={loadingPassword ? "..." : passwordData?.password || ""}
                readOnly
                className="pr-10 bg-muted font-mono text-lg"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>
            Ao alterar, todos os usuários precisarão usar a nova senha no próximo login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha (mín. 4 caracteres)"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending || !newPassword || !confirmPassword}
            className="w-full"
          >
            {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha de Acesso"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
