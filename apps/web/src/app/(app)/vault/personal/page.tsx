import type { Metadata } from "next";
import { VaultView } from "@/components/app/VaultView";

export const metadata: Metadata = { title: "Personal vault" };

export default function PersonalVaultPage() {
  return <VaultView profileType="personal" />;
}
