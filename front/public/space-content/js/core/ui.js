let toastTimer;

export function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

export function icon(id) {
  return `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;
}
