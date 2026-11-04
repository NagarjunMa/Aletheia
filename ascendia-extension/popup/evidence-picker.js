/** Story summaries and choices live only in the open side panel. */
export function createEvidencePicker({
  getOwner,
  readOwner,
  getCategory,
  send,
}) {
  const panel = document.getElementById("evidencePicker");
  const summary = document.getElementById("evidenceSummary");
  const choices = document.getElementById("evidenceChoices");
  const status = document.getElementById("evidenceStatus");
  const clear = document.getElementById("evidenceClear");
  const reload = document.getElementById("evidenceReload");
  let stories = [];
  const selected = new Set();
  let loadState = "idle";
  let requestId = 0;
  let revision = 0;
  let busy = false;
  let errorMessage = "";
  const limit = () =>
    ["linkedin_connection", "linkedin_inmail"].includes(getCategory()) ? 1 : 2;

  function updateControls() {
    summary.textContent = selected.size
      ? `Story focus · ${selected.size} selected`
      : "Story focus · Automatic";
    for (const input of choices.querySelectorAll("input")) {
      input.checked = selected.has(input.value);
      input.disabled = busy || (!input.checked && selected.size >= limit());
    }
    clear.disabled = busy || selected.size === 0;
    reload.disabled = busy || loadState === "loading";
    status.textContent =
      errorMessage ||
      (loadState === "loading"
        ? "Loading confirmed stories…"
        : loadState === "unsupported"
          ? "Story choices are unavailable on this server. Automatic selection is available."
          : loadState === "auth"
            ? "Reconnect your Aletheia account to load confirmed stories."
            : loadState === "error"
              ? "Could not load stories. Reload to try again, or use automatic selection."
              : loadState === "ready" && !stories.length
                ? "No confirmed stories yet. Add and review stories in your application profile."
                : `Choose up to ${limit()} ${limit() === 1 ? "story" : "stories"}, or leave the choice on automatic.`);
  }

  function renderChoices() {
    choices.replaceChildren(
      ...stories.map(({ id, title, kind }) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = id;
        const caption = document.createElement("span");
        caption.textContent = `${title} · ${kind.replaceAll("_", " ")}`;
        label.append(input, caption);
        return label;
      }),
    );
    updateControls();
  }

  function resetContext() {
    revision++;
    selected.clear();
    errorMessage = "";
    updateControls();
  }

  async function load() {
    const owner = getOwner();
    if (!owner || loadState === "loading") return;
    const id = ++requestId;
    loadState = "loading";
    updateControls();
    let response;
    let activeOwner;
    try {
      response = await send({ action: "listEvidence", requesterId: owner });
      activeOwner = await readOwner();
    } catch {
      if (id === requestId) {
        loadState = "error";
        updateControls();
      }
      return;
    }
    if (id !== requestId) return;
    if (owner !== getOwner() || owner !== activeOwner) {
      resetAccount();
      return;
    }
    stories = response.success ? response.evidence : [];
    loadState = response.success
      ? "ready"
      : response.code === "EVIDENCE_SELECTION_UNSUPPORTED"
        ? "unsupported"
        : response.code === "AUTH_REQUIRED"
          ? "auth"
          : "error";
    renderChoices();
  }

  function resetAccount() {
    requestId++;
    stories = [];
    loadState = "idle";
    panel.open = false;
    resetContext();
    renderChoices();
  }

  panel.addEventListener("toggle", () => {
    if (panel.open && loadState === "idle") void load();
  });
  choices.addEventListener("change", ({ target }) => {
    if (busy || !stories.some(({ id }) => id === target.value)) return;
    if (!target.checked) selected.delete(target.value);
    else if (selected.size < limit()) selected.add(target.value);
    revision++;
    errorMessage = "";
    updateControls();
  });
  clear.addEventListener("click", resetContext);
  reload.addEventListener("click", () => {
    resetContext();
    stories = [];
    renderChoices();
    void load();
  });
  updateControls();

  return {
    resetContext,
    resetAccount,
    snapshot: () => ({ ids: [...selected], revision }),
    isCurrent: (snapshot) => snapshot.revision === revision,
    setBusy(value) {
      busy = value;
      updateControls();
    },
    rejectSelection() {
      errorMessage =
        "These stories cannot be used for this draft. Change your selection, reload stories, or clear the selection.";
      panel.open = true;
      updateControls();
    },
  };
}
