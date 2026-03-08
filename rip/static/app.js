const downloadsPanel = document.querySelector("#downloads-panel");
const formatForm = document.querySelector(".format-form");

if (downloadsPanel) {
  const url = downloadsPanel.dataset.downloadsUrl;
  let timer = null;

  const schedule = () => {
    const active = downloadsPanel.dataset.hasActive === "true";
    clearTimeout(timer);
    if (!active) {
      timer = setTimeout(refresh, 5000);
      return;
    }
    timer = setTimeout(refresh, 2000);
  };

  const refresh = async () => {
    try {
      const response = await fetch(url, { headers: { "X-Requested-With": "fetch" } });
      if (!response.ok) {
        schedule();
        return;
      }

      downloadsPanel.innerHTML = await response.text();
      const hasActive = downloadsPanel.querySelector(".status-queued, .status-downloading, .status-processing");
      downloadsPanel.dataset.hasActive = hasActive ? "true" : "false";
    } catch (_error) {
      downloadsPanel.dataset.hasActive = "true";
    }

    schedule();
  };

  schedule();
}

if (formatForm) {
  const extInput = formatForm.querySelector("#ext");
  const radios = formatForm.querySelectorAll('input[name="format_id"]');

  const syncExt = () => {
    const checked = formatForm.querySelector('input[name="format_id"]:checked');
    if (checked && extInput && checked.dataset.ext) {
      extInput.value = checked.dataset.ext;
    }
  };

  radios.forEach((radio) => radio.addEventListener("change", syncExt));
  syncExt();
}
