import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/current-user";

export default async function HomePage() {
  const user = await getOptionalUser();
  redirect(user ? "/pets" : "/signin");
}