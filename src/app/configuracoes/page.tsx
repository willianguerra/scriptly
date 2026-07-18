import type { Metadata } from "next";
import Background from "@/components/background";
import Configuracoes from "@/components/configuracoes";

export const metadata: Metadata = {
  title: "Configurações",
};

export default function ConfiguracoesPage() {
  return (
    <Background>
      <Configuracoes />
    </Background>
  );
}
