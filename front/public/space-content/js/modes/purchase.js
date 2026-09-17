import { CONFIG } from "../config.js";

export function renderPurchasePanel(container) {
  const media = CONFIG.media.purchaseHero;
  container.innerHTML = `
    <section class="panel-view purchase-view" data-panel="purchase">
      <figure class="purchase-visual">
        <img src="${media.src}" alt="${media.alt}" width="1200" height="1600" />
      </figure>
    </section>
  `;
}
