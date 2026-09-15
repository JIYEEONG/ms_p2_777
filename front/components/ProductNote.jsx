export default function ProductNote() {
  return (
    <aside className="product-note" aria-label="서비스 소개">
      <div className="brand-lockup">
        <span className="brand-mark">M</span>
        <span>MOOV</span>
      </div>
      <p className="eyebrow">AUTONOMOUS MOBILITY PLATFORM</p>
      <h1>
        이동부터 휴식까지,
        <br />
        한 번에 MOOV.
      </h1>
      <p>
        기존 정적 HTML을 Next.js의 컴포넌트 구조로 옮기기 위한 시작 화면입니다.
      </p>
      <div className="system-pills">
        <span>실시간 배차</span>
        <span>Zero Trust Cabin</span>
        <span>AI 동행</span>
      </div>
      <section className="cabin-live" aria-label="실시간 차량 내부 테마 미리보기">
        <div className="cabin-live-head">
          <span>
            <i />
            LIVE CABIN
          </span>
          <strong>기본 모드 적용 중</strong>
        </div>
        <img src="/assets/cabin-default.jpg" alt="MOOV 차량 내부" />
      </section>
    </aside>
  );
}
