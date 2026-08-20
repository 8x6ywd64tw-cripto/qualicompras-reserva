import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Package } from "lucide-react";

export default function CorrecaoPreco() {
  const params = useParams<{ token: string; supplierId: string; itemId: string }>();
  const token = params.token || "";
  const supplierId = parseInt(params.supplierId || "0");
  const itemId = parseInt(params.itemId || "0");

  const [newPrice, setNewPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [packagingType, setPackagingType] = useState<"unidade" | "caixa" | "fardo" | "pacote">("unidade");
  const [unitsPerPackage, setUnitsPerPackage] = useState("1");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = trpc.quotations.getCorrectionItem.useQuery(
    { token, supplierId, itemId },
    { enabled: !!token && supplierId > 0 && itemId > 0 }
  );

  const submitMutation = trpc.quotations.submitCorrection.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const normalizedPrice = packagingType !== "unidade" && parseInt(unitsPerPackage) > 1
    ? parseFloat(newPrice) / parseInt(unitsPerPackage)
    : parseFloat(newPrice);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Link inválido</h2>
            <p className="text-gray-600 mt-2">Este link de correção não é válido ou já expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Preço corrigido com sucesso!</h2>
            <p className="text-gray-600 mt-2">
              Obrigado pela correção. O novo preço já foi atualizado na cotação.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader className="bg-orange-50 border-b">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <CardTitle className="text-lg text-orange-800">Correção de Preço</CardTitle>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              O preço informado para este produto parece estar incorreto. Por favor, confirme ou corrija.
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Info da cotação */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Cotação:</span>
                <span className="text-sm font-medium">{data.quotationTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Fornecedor:</span>
                <span className="text-sm font-medium">{data.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Produto:</span>
                <span className="text-sm font-bold text-gray-900">{data.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Quantidade:</span>
                <span className="text-sm font-medium">{data.quantity} {data.unit}</span>
              </div>
              {data.currentPrice && (
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-sm text-red-600 font-medium">Preço atual (suspeito):</span>
                  <span className="text-sm font-bold text-red-600">
                    R$ {parseFloat(data.currentPrice).toFixed(2)}
                  </span>
                </div>
              )}
              {data.currentBrand && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Marca informada:</span>
                  <span className="text-sm font-medium">{data.currentBrand}</span>
                </div>
              )}
            </div>

            {/* Formulário de correção */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço correto *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="pl-9"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marca *
                </label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Dona Clara, Camil..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Package className="inline h-4 w-4 mr-1" />
                  Vende por:
                </label>
                <Select value={packagingType} onValueChange={(v) => setPackagingType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="fardo">Fardo</SelectItem>
                    <SelectItem value="pacote">Pacote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {packagingType !== "unidade" && (
                <div>
                  {(() => {
                    const isWeightUnit = ["KG","kg","G","g","TON","ton"].includes(data.unit?.trim());
                    const isVolumeUnit = ["LT","lt","L","l","ML","ml"].includes(data.unit?.trim());
                    const isWeightOrVolume = isWeightUnit || isVolumeUnit;
                    const unitLabel = isWeightUnit ? "KG" : isVolumeUnit ? "LT" : "unidades";
                    return (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isWeightOrVolume
                            ? `Quantos ${unitLabel} na ${packagingType}? *`
                            : `Quantas unidades na ${packagingType}? *`}
                        </label>
                        <Input
                          type="number"
                          min="2"
                          value={unitsPerPackage}
                          onChange={(e) => setUnitsPerPackage(e.target.value)}
                          placeholder={isWeightOrVolume ? "Ex: 18, 20, 25 (peso em KG)" : "Ex: 12, 24, 48..."}
                        />
                        {isWeightOrVolume && parseInt(unitsPerPackage) <= 1 && (
                          <p className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded font-medium">
                            ⚠️ Informe o peso real da {packagingType} em {unitLabel} (ex: 18 para caixa de 18kg)
                          </p>
                        )}
                        {newPrice && parseInt(unitsPerPackage) > 1 && (
                          <p className="text-xs text-green-700 mt-1 bg-green-50 p-2 rounded">
                            Preço por {isWeightOrVolume ? unitLabel.toLowerCase() : "unidade"}: R$ {normalizedPrice.toFixed(4)}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Botão de enviar */}
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              disabled={!newPrice || !brand || parseFloat(newPrice) <= 0 || submitMutation.isPending}
              onClick={() => {
                submitMutation.mutate({
                  token,
                  supplierId,
                  itemId,
                  newPrice: parseFloat(newPrice),
                  brand,
                  packagingType,
                  unitsPerPackage: parseInt(unitsPerPackage) || 1,
                });
              }}
            >
              {submitMutation.isPending ? "Enviando..." : "Confirmar Correção"}
            </Button>

            {submitMutation.error && (
              <p className="text-sm text-red-600 text-center">
                Erro ao enviar correção. Tente novamente.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
