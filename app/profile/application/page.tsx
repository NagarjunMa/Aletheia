import { redirect } from "next/navigation";

export default function ApplicationProfilePage() {
  redirect("/dashboard#candidate-profile");
}
