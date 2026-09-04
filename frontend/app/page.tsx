import { redirect } from "next/navigation";

/**
 * Root page redirects to the chatbot interface.
 */
export default function Home() {
  redirect("/chat");
}
