import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Replicate · LLM Research Lab",
  description:
    "Independent trials. Measurable answers. A local research workspace for evaluating language models.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
