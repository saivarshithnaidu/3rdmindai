import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3RDMIND — The intelligence above intelligence",
  description: "The first mind is human. The second mind is a single AI. The third mind is the orchestrator — the intelligence that coordinates intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="h-full overflow-hidden flex flex-col bg-[#FBF9F6] text-[#191919] font-dmsans">
        {children}
      </body>
    </html>
  );
}
