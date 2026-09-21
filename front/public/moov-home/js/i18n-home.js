/* Home-only translations for labels assembled with live vehicle and trip data. */
(() => {
  const lookup = (value) => window.MOOV_EN?.[value] || value;
  const money = (value) => `₩${value}`;

  window.MOOV_PAGE_TRANSLATE = (source, translate) => {
    let match = source.match(/^(\d+)시간 ([\d,]+)원부터$/);
    if (match) return `From ${money(match[2])} for ${match[1]} hr`;
    match = source.match(/^(\d+)시간 · 차량 요금$/);
    if (match) return `${match[1]} hr · Vehicle fare`;
    match = source.match(/^시간당 약 ([\d,]+)원$/);
    if (match) return `About ${money(match[1])} per hour`;
    match = source.match(/^\+([\d,]+)원$/);
    if (match) return `+${money(match[1])}`;
    match = source.match(/^차량 ([\d,]+)원 \+ 옵션 ([\d,]+)원$/);
    if (match) return `Vehicle ${money(match[1])} + options ${money(match[2])}`;
    match = source.match(/^(.+) 주변의 (.+) 차량을 확인하고 있어요\.$/);
    if (match) return `Checking for ${translate(match[2])} vehicles near ${translate(match[1])}.`;
    if (source === "약 3초 후 코스 지도로 이동합니다.") return "Trip map opens in about 3 seconds.";
    match = source.match(/^(.+) 방면 · 다음 지점 약 ([\d—]+)분$/);
    if (match) return `Toward ${translate(match[1])} · Next stop in about ${match[2]} min`;
    match = source.match(/^([\d.]+) km · 약 ([\d—]+)분$/);
    if (match) return `${match[1]} km · about ${match[2]} min`;
    match = source.match(/^· 약 ([\d—]+)분$/);
    if (match) return `· about ${match[1]} min`;
    match = source.match(/^선택 후보: (.+)$/);
    if (match) return `Suggested location: ${translate(match[1])}`;
    match = source.match(/^(\d+)\. (.+)$/);
    if (match && translate(match[2]) !== match[2]) return `${match[1]}. ${translate(match[2])}`;
    match = source.match(/^([\d,]+)원부터$/);
    if (match) return `From ${money(match[1])}`;
    match = source.match(/^약 (\d+)분 후$/);
    if (match) return `In about ${match[1]} min`;
    match = source.match(/^약 (\d+)분$/);
    if (match) return `About ${match[1]} min`;
    match = source.match(/^(\d+)명$/);
    if (match) return `${match[1]} passengers`;
    match = source.match(/^배터리 (\d+)%$/);
    if (match) return `Battery ${match[1]}%`;
    match = source.match(/^(.+?) 선택$/);
    if (match && lookup(match[1]) !== match[1]) return `Select ${lookup(match[1])}`;
    match = source.match(/^✓ (.+)$/);
    if (match && lookup(match[1]) !== match[1]) return `✓ ${lookup(match[1])}`;
    match = source.match(/^(.+?) · 배터리 (\d+)%$/);
    if (match && lookup(match[1]) !== match[1]) return `${lookup(match[1])} · Battery ${match[2]}%`;
    match = source.match(/^(.+?) · 체류 (\d+)분$/);
    if (match && lookup(match[1]) !== match[1]) return `${lookup(match[1])} · Stopover ${match[2]} min`;
    match = source.match(/^(\d+)시간 · (.+)$/);
    if (match) return `${match[1]} hr · ${translate(match[2])}`;
    return null;
  };

})();
