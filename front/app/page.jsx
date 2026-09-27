export default async function Home({ searchParams }) {
  const { lang } = await searchParams;
  const query = lang === "en" || lang === "ko" ? `?lang=${lang}` : "";
  return (
    <iframe
      src={`/moov.html${query}`}
      title="MOOV"
      allow="geolocation"
      style={{
        width: "100vw",
        height: "100vh",
        border: 0,
        display: "block",
      }}
    />
  );
}
