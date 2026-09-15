"use client";

import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import IconSprite from "@/components/IconSprite";
import ProductNote from "@/components/ProductNote";

export default function MoovApp() {
  return (
    <>
      <IconSprite />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="stage">
        <ProductNote />

        <section className="phone-shell" aria-label="MOOV 앱">
          <div className="phone-top">
            <span>9:41</span>
            <span className="phone-status" aria-label="휴대폰 상태">
              <span className="signal-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="wifi-mark" aria-hidden="true" />
              <span className="battery-ui charging" aria-hidden="true">
                <b />
                <i />
              </span>
            </span>
          </div>

          <section className="screen screen-active app-screen" aria-label="MOOV 서비스">
            <AppHeader />
            <div className="app-content" tabIndex={-1}>
              <section className="hero-card">
                <p className="eyebrow">MOOV</p>
                <h3>Next.js 전환 준비 완료</h3>
                <p>
                  기존 HTML 화면을 이 영역부터 React 컴포넌트로 하나씩 옮기면 됩니다.
                </p>
              </section>
            </div>
            <BottomNav />
          </section>

          <div className="home-indicator" />
        </section>
      </main>
    </>
  );
}
