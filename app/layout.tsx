export const metadata = {
  title: "Tableau Formula Export",
  description: "Export a Tableau worksheet to Excel with live formulas for calculated fields"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
