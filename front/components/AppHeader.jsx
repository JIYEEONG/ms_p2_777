export default function AppHeader() {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Moov</p>
        <h2>홈</h2>
      </div>
      <div className="header-actions">
        <button className="icon-button status-button" type="button" aria-label="무인차 정보 보기">
          <span className="status-dot" />
          <svg>
            <use href="#i-car" />
          </svg>
        </button>
        <button className="header-profile" type="button" aria-label="프로필 열기">
          <span>지</span>
        </button>
      </div>
    </header>
  );
}
