import type { Metadata } from "next";
import { VaultView } from "@/components/app/VaultView";

export const metadata: Metadata = { title: "Business vault" };

export default function BusinessVaultPage() {
  return <VaultView profileType="business" />;
}
