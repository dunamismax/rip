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
  const extSelect = formatForm.querySelector("#ext");
  const sourceExtInput = formatForm.querySelector('input[name="source_ext"]');
  const hasVideoInput = formatForm.querySelector('input[name="has_video"]');
  const hasAudioInput = formatForm.querySelector('input[name="has_audio"]');
  const radios = formatForm.querySelectorAll('input[name="format_id"]');

  const syncFormatFields = () => {
    const checked = formatForm.querySelector('input[name="format_id"]:checked');
    if (!checked || !extSelect) {
      return;
    }

    const options = (checked.dataset.outputExtensions || checked.dataset.ext || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const nextValue = options.includes(extSelect.value) ? extSelect.value : (checked.dataset.ext || options[0] || "");

    extSelect.replaceChildren();
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (value === nextValue) {
        option.selected = true;
      }
      extSelect.appendChild(option);
    });

    if (sourceExtInput) {
      sourceExtInput.value = checked.dataset.ext || "";
    }
    if (hasVideoInput) {
      hasVideoInput.value = checked.dataset.hasVideo || "false";
    }
    if (hasAudioInput) {
      hasAudioInput.value = checked.dataset.hasAudio || "false";
    }
  };

  radios.forEach((radio) => radio.addEventListener("change", syncFormatFields));
  syncFormatFields();
}
