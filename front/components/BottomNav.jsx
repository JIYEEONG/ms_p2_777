const tabs = [
  ["ai", "i-chat", "AI"],
  ["space", "i-space", "공간"],
  ["home", "i-home", "홈"],
  ["outing", "i-compass", "나들이"],
  ["profile", "i-user", "내 정보"],
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="메인 메뉴">
      {tabs.map(([id, icon, label]) => (
        <button key={id} className={id === "home" ? "nav-active" : undefined} type="button">
          <svg>
            <use href={`#${icon}`} />
          </svg>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
