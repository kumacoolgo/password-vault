import "./globals.css";

export const metadata = {
  title: "Password Vault",
  description: "Simple password vault",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
