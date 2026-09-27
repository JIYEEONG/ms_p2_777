import "./globals.css";

export const metadata = {
  title: "MOOV",
  description: "MOOV autonomous mobility platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
