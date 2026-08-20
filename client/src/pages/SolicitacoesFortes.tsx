import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderArchive, Calendar, MapPin, FileText, Package, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function SolicitacoesFortes() {
  const { data: archives, isLoading } = trpc.quotations.listPdfArchive.useQuery();

  const handleClick = (arc: any) => {
    if (arc.fileUrl && arc.fileUrl !== "retroativo") {
      window.open(arc.fileUrl, '_blank');
    } else {
      toast.info("PDF original não disponível para solicitações anteriores à implementação do arquivo.");
    }
  };

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <FolderArchive className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Histórico Solicitações Fortes</h1>
            <p className="text-sm text-muted-foreground">Banco de dados de todas as solicitações de pedido importadas do Fortes AG</p>
          </div>
        </div>

        {isLoading && <p className="text-muted-foreground">Carregando...</p>}

        {archives && archives.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FolderArchive className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma solicitação arquivada ainda.</p>
              <p className="text-sm mt-1">As solicitações aparecerão aqui após a cotação ser concluída e os pedidos gerados.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3">
          {archives?.map((arc: any) => (
            <Card key={arc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleClick(arc)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm break-words">{arc.fileName}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {arc.unitName && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <MapPin className="h-3 w-3" />{arc.unitName}
                          </Badge>
                        )}
                        {arc.category && (
                          <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
                            {arc.category}
                          </Badge>
                        )}
                        {arc.periodo && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Calendar className="h-3 w-3" />{arc.periodo}
                          </Badge>
                        )}
                        {arc.coletaNumber && (
                          <Badge variant="secondary" className="text-xs">
                            Coleta {arc.coletaNumber}
                          </Badge>
                        )}
                        {arc.itemCount > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Package className="h-3 w-3" />{arc.itemCount} itens
                          </Badge>
                        )}
                      </div>
                      {arc.observacao && (
                        <p className="text-xs text-muted-foreground mt-1 break-words">{arc.observacao}</p>
                      )}
                      {arc.fileUrl && arc.fileUrl !== "retroativo" && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600">
                          <ExternalLink className="h-3 w-3" /> PDF disponível
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {arc.uploadedAt ? new Date(arc.uploadedAt).toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
