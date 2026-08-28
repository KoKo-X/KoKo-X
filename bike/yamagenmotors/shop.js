const pistonToggle = document.querySelector(".piston_toggle");
const pistonToggleText = document.querySelector(".piston_toggle_text");
const pistonStorageKey = "yamagen-piston-background";

const readStoredPistonPreference = () => {
  try {
    return window.localStorage.getItem(pistonStorageKey);
  } catch {
    return null;
  }
};

const writeStoredPistonPreference = (enabled) => {
  try {
    window.localStorage.setItem(pistonStorageKey, enabled ? "on" : "off");
  } catch {
    // The switch remains usable for the current page when storage is unavailable.
  }
};

const setPistonEnabled = (enabled, { persist = false } = {}) => {
  document.body.classList.toggle("is_piston_disabled", !enabled);
  pistonToggle?.setAttribute("aria-pressed", String(enabled));
  pistonToggle?.setAttribute("aria-label", `背景ピストンを${enabled ? "オフ" : "オン"}にする`);

  if (pistonToggleText) {
    pistonToggleText.textContent = `ピストン ${enabled ? "ON" : "OFF"}`;
  }

  if (persist) {
    writeStoredPistonPreference(enabled);
  }

  window.dispatchEvent(new CustomEvent("shop-piston-change", { detail: { enabled } }));
};

const storedPistonPreference = readStoredPistonPreference();
setPistonEnabled(storedPistonPreference !== "off");

pistonToggle?.addEventListener("click", () => {
  const nextEnabled = document.body.classList.contains("is_piston_disabled");
  setPistonEnabled(nextEnabled, { persist: true });
});

const shopNavLinks = Array.from(document.querySelectorAll(".shop_menu_scroller a")).filter((link) =>
  link.getAttribute("href")?.startsWith("#")
);

const shopNavTargets = shopNavLinks
  .map((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    return section ? { link, section } : null;
  })
  .filter(Boolean);

const setActiveShopLink = (id) => {
  shopNavLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const syncActiveShopLink = () => {
  if (shopNavTargets.length === 0) return;

  const fixedTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shop-fixed-top-height")) || 0;
  const anchorLine = fixedTop + Math.max(24, window.innerHeight * 0.14);
  let activeId = shopNavTargets[0].section.id;

  shopNavTargets.forEach(({ section }) => {
    if (section.getBoundingClientRect().top <= anchorLine) {
      activeId = section.id;
    }
  });

  setActiveShopLink(activeId);
};

let activeSyncQueued = false;

const queueActiveShopLinkSync = () => {
  if (activeSyncQueued) return;

  activeSyncQueued = true;
  requestAnimationFrame(() => {
    activeSyncQueued = false;
    syncActiveShopLink();
  });
};

shopNavTargets.forEach(({ link, section }) => {
  link.addEventListener("click", () => {
    setActiveShopLink(section.id);
    link.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  });
});

const shopMenuBar = document.querySelector(".shop_menu_bar");
const shopMenuScroller = document.querySelector(".shop_menu_scroller");

if (shopMenuBar && shopMenuScroller) {
  const updateMenuHints = () => {
    const maxScroll = shopMenuScroller.scrollWidth - shopMenuScroller.clientWidth;
    shopMenuBar.classList.toggle("has_left_hint", shopMenuScroller.scrollLeft > 2);
    shopMenuBar.classList.toggle("has_right_hint", maxScroll > 2 && shopMenuScroller.scrollLeft < maxScroll - 2);
  };

  updateMenuHints();
  shopMenuScroller.addEventListener("scroll", updateMenuHints, { passive: true });
  window.addEventListener("resize", updateMenuHints);
}

const shopHeader = document.querySelector(".shop_header");

if (shopHeader && shopMenuBar) {
  const updateShopChrome = () => {
    const headerHeight = shopHeader.offsetHeight;
    const menuHeight = shopMenuBar.offsetHeight;
    const fixedTopHeight = headerHeight + menuHeight;

    document.documentElement.style.setProperty("--shop-header-height", `${headerHeight}px`);
    document.documentElement.style.setProperty("--shop-menu-height", `${menuHeight}px`);
    document.documentElement.style.setProperty("--shop-fixed-top-height", `${fixedTopHeight}px`);
    queueActiveShopLinkSync();
  };

  updateShopChrome();
  requestAnimationFrame(updateShopChrome);
  window.addEventListener("load", updateShopChrome);
  window.addEventListener("resize", updateShopChrome);
  window.addEventListener("orientationchange", updateShopChrome);
  window.visualViewport?.addEventListener("resize", updateShopChrome);
  document.fonts?.ready.then(updateShopChrome).catch(() => {});
}

syncActiveShopLink();
window.addEventListener("scroll", queueActiveShopLinkSync, { passive: true });
window.addEventListener("resize", queueActiveShopLinkSync);
