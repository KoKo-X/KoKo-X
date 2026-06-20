const shopNavLinks = Array.from(document.querySelectorAll(".shop_menu_scroller a")).filter((link) =>
  link.getAttribute("href")?.startsWith("#")
);
const themeCompareToggle = document.querySelector(".theme_compare_toggle");
const themeCompareToggleLabel = document.querySelector(".theme_compare_toggle_label");
const themeStorageKey = "nearby-bike-shop-theme";

const readStoredTheme = () => {
  try {
    return window.localStorage.getItem(themeStorageKey);
  } catch {
    return null;
  }
};

const writeStoredTheme = (theme) => {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The comparison still works for the current page even when storage is unavailable.
  }
};

const setShopTheme = (theme) => {
  const isLightTheme = theme === "light";
  document.body.classList.toggle("is_light_theme", isLightTheme);
  themeCompareToggle?.setAttribute("aria-pressed", String(isLightTheme));

  if (themeCompareToggleLabel) {
    themeCompareToggleLabel.textContent = isLightTheme ? "黒系で見る" : "白系で見る";
  }

  window.dispatchEvent(new CustomEvent("shop-theme-change", { detail: { theme } }));
};

const savedTheme = readStoredTheme();
setShopTheme(savedTheme === "light" ? "light" : "dark");

themeCompareToggle?.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("is_light_theme") ? "dark" : "light";
  writeStoredTheme(nextTheme);
  setShopTheme(nextTheme);
});

const shopNavTargets = shopNavLinks
  .map((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    return section ? { link, section } : null;
  })
  .filter(Boolean);

const setActiveShopLink = (id) => {
  shopNavLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
  });
};

const syncActiveShopLink = () => {
  if (shopNavTargets.length === 0) {
    return;
  }

  const fixedTop = parseFloat(getComputedStyle(document.body).getPropertyValue("--shop-fixed-top-height")) || 0;
  const anchorLine = fixedTop + Math.max(24, window.innerHeight * 0.16);
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
  if (activeSyncQueued) {
    return;
  }

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

syncActiveShopLink();
window.addEventListener("scroll", queueActiveShopLinkSync, { passive: true });
window.addEventListener("resize", queueActiveShopLinkSync);

const shopMenuBar = document.querySelector(".shop_menu_bar");
const shopMenuScroller = document.querySelector(".shop_menu_scroller");

if (shopMenuBar && shopMenuScroller) {
  const updateMenuHints = () => {
    const maxScroll = shopMenuScroller.scrollWidth - shopMenuScroller.clientWidth;
    const leftVisible = shopMenuScroller.scrollLeft > 2;
    const rightVisible = shopMenuScroller.scrollLeft < maxScroll - 2;
    const hasOverflow = maxScroll > 2;
    const thumbWidth = hasOverflow
      ? Math.max((shopMenuScroller.clientWidth / shopMenuScroller.scrollWidth) * 100, 14)
      : 100;
    const thumbLeft = hasOverflow
      ? (shopMenuScroller.scrollLeft / shopMenuScroller.scrollWidth) * 100
      : 0;

    shopMenuBar.classList.toggle("has_left_hint", leftVisible);
    shopMenuBar.classList.toggle("has_right_hint", rightVisible);
    shopMenuBar.style.setProperty("--menu-thumb-width", `${thumbWidth}%`);
    shopMenuBar.style.setProperty("--menu-thumb-left", `${thumbLeft}%`);
  };

  updateMenuHints();
  shopMenuScroller.addEventListener("scroll", updateMenuHints, { passive: true });
  window.addEventListener("resize", updateMenuHints);
}

const shopHeader = document.querySelector(".shop_header");

if (document.body.classList.contains("shop_page") && shopHeader && shopMenuBar) {
  const updateShopChrome = () => {
    const headerHeight = shopHeader.offsetHeight;
    const menuHeight = shopMenuBar.offsetHeight;
    const fixedTopHeight = headerHeight + menuHeight;

    document.documentElement.style.setProperty("--shop-header-height", `${headerHeight}px`);
    document.documentElement.style.setProperty("--shop-fixed-top-height", `${fixedTopHeight}px`);
    document.documentElement.style.setProperty("--shop-menu-height", `${menuHeight}px`);
    document.body.style.setProperty("--shop-header-height", `${headerHeight}px`);
    document.body.style.setProperty("--shop-fixed-top-height", `${fixedTopHeight}px`);
    document.body.style.setProperty("--shop-menu-height", `${menuHeight}px`);
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

const rideTrack = document.querySelector(".bike_scroll_track");

if (rideTrack) {
  let lastScrollY = window.scrollY;

  const updateRideTrack = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    const clamped = Math.min(1, Math.max(0, progress));
    const direction = window.scrollY < lastScrollY ? -1 : 1;

    document.documentElement.style.setProperty("--ride-progress", `${clamped * 100}%`);
    document.documentElement.style.setProperty("--ride-ratio", clamped);
    document.documentElement.style.setProperty("--ride-direction", direction);

    lastScrollY = window.scrollY;
  };

  updateRideTrack();
  window.addEventListener("scroll", updateRideTrack, { passive: true });
  window.addEventListener("resize", updateRideTrack);
}
