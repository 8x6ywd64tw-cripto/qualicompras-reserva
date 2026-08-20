import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, Loader2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha email e senha");
      return;
    }
    if (needsName && !operatorName.trim()) {
      toast.error("Informe seu nome para continuar");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          operatorName: needsName ? operatorName.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "FIRST_LOGIN_NEEDS_NAME") {
          setNeedsName(true);
          toast.info("Primeiro acesso! Informe seu nome.");
          setIsSubmitting(false);
          return;
        }
        toast.error(data.error || "Credenciais inválidas");
        setIsSubmitting(false);
        return;
      }

      // Save token to localStorage - THE ONLY auth mechanism
      localStorage.setItem("manus-auth-token", data.token);
      toast.success("Login realizado com sucesso!");
      // Full page reload to "/" - getAuthHeaders will read from localStorage
      window.location.href = "/";
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0F1B4C]">
      <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
        {/* Logo and branding */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="QualiCompras"
              className="h-14 w-14 rounded-xl"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              QualiCompras
            </h1>
            <p className="text-sm text-white/60 mt-2 max-w-sm">
              Central de Compras Inteligente
            </p>
            <p className="text-xs text-white/40 mt-1">
              Qualities Refeições — Grupo Comenda
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80 text-sm">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-white/50 focus:ring-white/20"
                autoComplete="email"
                disabled={needsName}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80 text-sm">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-white/50 focus:ring-white/20"
                autoComplete="current-password"
                disabled={needsName}
              />
            </div>
          </div>

          {/* Name field - only shown on first login */}
          {needsName && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="operatorName" className="text-white/80 text-sm">
                Seu Nome (identificação permanente)
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  id="operatorName"
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Ex: Paula, Douglas, Afonso..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-white/50 focus:ring-white/20"
                  autoFocus
                />
              </div>
              <p className="text-xs text-amber-300/80">
                Este nome ficará vinculado ao seu email e aparecerá em todas as ações no sistema. Não poderá ser alterado depois.
              </p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full bg-white text-[#0F1B4C] hover:bg-white/90 font-semibold shadow-lg hover:shadow-xl transition-all mt-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : needsName ? (
              "Confirmar Nome e Entrar"
            ) : (
              "Entrar no Sistema"
            )}
          </Button>
        </form>

        <p className="text-xs text-white/30 text-center">
          Acesso restrito a colaboradores autorizados
        </p>
      </div>
    </div>
  );
}
