import "./globals.css";

export const metadata = {
  title: "MOOV",
  description: "MOOV autonomous mobility platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
