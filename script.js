const navLinks = Array.from(document.querySelectorAll(".site-nav a")).filter((link) =>
  link.getAttribute("href")?.startsWith("#")
);

const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const setActiveLink = (id) => {
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
  });
};

if ("IntersectionObserver" in window && sections.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible) {
        setActiveLink(visible.target.id);
      }
    },
    {
      rootMargin: "-30% 0px -55% 0px",
      threshold: [0.15, 0.35, 0.6],
    }
  );

  sections.forEach((section) => observer.observe(section));
}

const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
const storeCards = Array.from(document.querySelectorAll(".store-card[data-category]"));

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
    storeCards.forEach((card) => {
      card.classList.toggle("is-hidden", filter !== "all" && card.dataset.category !== filter);
    });
  });
});
