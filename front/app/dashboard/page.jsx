export default async function DashboardPage({ searchParams }) {
  const { lang } = await searchParams;
  const query = lang === "en" || lang === "ko" ? `?lang=${lang}` : "";
  return (
    <iframe
      src={`/dashboard/index.html${query}#dashboard`}
      title="MOOV Operations Center"
      style={{ width: "100vw", height: "100vh", border: 0, display: "block" }}
    />
  );
}
