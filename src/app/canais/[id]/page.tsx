import { CanalDetalhe } from "@/components/canais/canal-detalhe";

export default async function CanalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CanalDetalhe id={id} />;
}
