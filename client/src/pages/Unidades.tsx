import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Plus, Building2, MapPin, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Unidades() {
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", state: "", city: "", address: "", costCenter: "", contactName: "", contactPhone: "",
  });
  const [editForm, setEditForm] = useState<any>({});

  const { user } = useAuth();
  const isMaster = user?.email === "afonsoqueirogagn@gmail.com";
  const hasWriteAccess = isMaster || user?.role === "buyer_senior";

  const utils = trpc.useUtils();
  const { data: unitsList, isLoading } = trpc.units.list.useQuery();
  const createMutation = trpc.units.create.useMutation({
    onSuccess: () => {
      toast.success("Unidade cadastrada com sucesso!");
      utils.units.list.invalidate();
      setShowCreate(false);
      setForm({ name: "", state: "", city: "", address: "", costCenter: "", contactName: "", contactPhone: "" });
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.units.update.useMutation({
    onSuccess: () => { toast.success("Unidade atualizada!"); utils.units.list.invalidate(); setShowEdit(false); },
    onError: (err: any) => toast.error(err.message),
  });
  const deleteMutation = trpc.units.delete.useMutation({
    onSuccess: () => { toast.success("Unidade excluída"); utils.units.list.invalidate(); },
    onError: (err: any) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!form.name.trim() || !form.state.trim() || !form.city.trim()) {
      toast.error("Nome, estado e cidade são obrigatórios");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unidades / Obras</h1>
            <p className="text-muted-foreground mt-1">Gestão multiunidade com centros de custo</p>
          </div>
          {hasWriteAccess && (
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Unidade</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar Unidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div><Label>Nome da Unidade *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Canteiro Vale - Marabá" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Estado *</Label><Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="PA" maxLength={2} /></div>
                  <div><Label>Cidade *</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Marabá" /></div>
                </div>
                <div><Label>Endereço</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Endereço completo" /></div>
                <div><Label>Centro de Custo</Label><Input value={form.costCenter} onChange={e => setForm(f => ({ ...f, costCenter: e.target.value }))} placeholder="CC-001" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Responsável</Label><Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Nome" /></div>
                  <div><Label>Telefone</Label><Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="(00) 0000-0000" /></div>
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Cadastrar Unidade"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>)}
          </div>
        ) : !unitsList || unitsList.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">Nenhuma unidade cadastrada</p><p className="text-xs text-muted-foreground mt-1">Cadastre suas unidades/obras para vincular cotações e pedidos</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unitsList.map((unit: any) => (
              <Card key={unit.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{unit.name}</h3>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{unit.city} - {unit.state}</span>
                      </div>
                      {unit.costCenter && (
                        <p className="text-xs text-muted-foreground mt-1">CC: {unit.costCenter}</p>
                      )}
                      {unit.contactName && (
                        <p className="text-xs text-muted-foreground mt-1">Resp: {unit.contactName}</p>
                      )}
                    </div>
                  </div>
                  {/* ADM Master + buyer_senior: Edit + Delete */}
                  {hasWriteAccess && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => {
                        setEditingUnit(unit);
                        setEditForm({ name: unit.name, state: unit.state, city: unit.city, address: unit.address || "", costCenter: unit.costCenter || "", contactName: unit.contactName || "", contactPhone: unit.contactPhone || "" });
                        setShowEdit(true);
                      }}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-red-600 hover:bg-red-50" onClick={() => {
                        if (confirm(`Excluir unidade "${unit.name}"? Esta ação não pode ser desfeita.`)) deleteMutation.mutate({ id: unit.id });
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Unit Modal */}
      {showEdit && editingUnit && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Unidade: {editingUnit.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Nome *</Label><Input value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Estado *</Label><Input value={editForm.state} onChange={e => setEditForm((f: any) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></div>
                <div><Label>Cidade *</Label><Input value={editForm.city} onChange={e => setEditForm((f: any) => ({ ...f, city: e.target.value }))} /></div>
              </div>
              <div><Label>Endereço</Label><Input value={editForm.address} onChange={e => setEditForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Centro de Custo</Label><Input value={editForm.costCenter} onChange={e => setEditForm((f: any) => ({ ...f, costCenter: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Responsável</Label><Input value={editForm.contactName} onChange={e => setEditForm((f: any) => ({ ...f, contactName: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={editForm.contactPhone} onChange={e => setEditForm((f: any) => ({ ...f, contactPhone: e.target.value }))} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
                <Button onClick={() => updateMutation.mutate({ id: editingUnit.id, ...editForm })} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
