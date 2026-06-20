const API = "/api/provider";

async function get(path) {
  const res = await fetch(`${API}${path}`);
  const json = await res.json();
  if (json.em) throw new Error(json.em);
  return json.data;
}

async function post(path, data) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  const json = await res.json();
  if (json.em) throw new Error(json.em);
  return json.data;
}

let providers = [];

async function loadProviders() {
  providers = await get("/list");
  renderTree();
  renderContent();
}

// --- Sidebar tree ---

function renderTree() {
  const tree = document.getElementById("tree");
  if (!providers.length) {
    tree.innerHTML = '<div style="padding:16px;color:#64748b;font-size:13px">暂无供应商</div>';
    return;
  }
  tree.innerHTML = providers.map(p => `
    <div class="provider-group">
      <div class="provider-header" onclick="this.classList.toggle('collapsed');this.nextElementSibling.classList.toggle('collapsed')">
        <span class="arrow">▼</span>
        <span class="name">${esc(p.provider_name)}</span>
      </div>
      <div class="provider-models">
        ${p.models.map(m => `<div class="model-item"><span class="model-name">${esc(m.display_name || m.model_id)}</span></div>`).join("")}
      </div>
    </div>
  `).join("");
}

// --- Main content: provider cards ---

function renderContent() {
  const container = document.getElementById("provider-content");
  if (!providers.length) {
    container.innerHTML = '<div class="empty-hint">点击右上角「＋ 添加供应商」开始</div>';
    return;
  }

  container.innerHTML = providers.map(p => {
    const key = p.base_url;
    return `
      <div class="provider-card">
        <div class="provider-card-header">
          <div>
            <div class="provider-card-name">${esc(p.provider_name)}</div>
            <div class="provider-card-url">${esc(p.base_url)}${esc(p.endpoint)}</div>
          </div>
          <div class="provider-card-actions">
            <button onclick="editProvider('${esc(key)}')">编辑</button>
            <button onclick="deleteProvider('${esc(key)}')">删除</button>
          </div>
        </div>
        <div class="provider-card-models">
          ${p.models.map(m => `
            <div class="model-row">
              <span class="model-id">${esc(m.model_id)}</span>
              ${m.display_name ? `<span class="model-display">${esc(m.display_name)}</span>` : ""}
              <button class="model-del" onclick="deleteModel('${esc(key)}','${esc(m.model_id)}')" title="删除">×</button>
            </div>
          `).join("")}
          <button class="btn-add-model-row" onclick="openAddModel('${esc(key)}','${esc(p.provider_name)}')">＋ 添加模型</button>
        </div>
      </div>
    `;
  }).join("");
}

// --- Actions ---

window.deleteProvider = async function(baseUrl) {
  if (!confirm("删除该供应商及其所有模型？")) return;
  await post("/delete", { base_url: baseUrl });
  await loadProviders();
};

window.deleteModel = async function(baseUrl, modelId) {
  await post("/model/delete", { base_url: baseUrl, model_id: modelId });
  await loadProviders();
};

window.editProvider = function(baseUrl) {
  const p = providers.find(x => x.base_url === baseUrl);
  if (!p) return;
  const name = prompt("供应商名称", p.provider_name);
  if (name && name !== p.provider_name) {
    post("/update", { base_url: baseUrl, provider_name: name }).then(loadProviders);
  }
};

// --- Add Provider Dialog ---

const dialogAdd = document.getElementById("dialog-add-provider");
const formProbe = document.getElementById("form-probe");
const formConfirm = document.getElementById("form-confirm");

document.getElementById("btn-add-provider").onclick = () => {
  formProbe.reset();
  formConfirm.style.display = "none";
  formProbe.style.display = "";
  document.getElementById("probe-status").textContent = "";
  dialogAdd.showModal();
};

document.getElementById("btn-cancel").onclick = () => dialogAdd.close();

let probeData = null;
let selectedModels = new Set();

formProbe.onsubmit = async (e) => {
  e.preventDefault();
  const url = document.getElementById("input-url").value;
  const key = document.getElementById("input-key").value;
  const status = document.getElementById("probe-status");

  status.textContent = "探测中...";
  status.className = "probe-status loading";

  try {
    probeData = await post("/probe", { url, api_key: key || undefined });
    document.getElementById("confirm-name").value = probeData.name;
    document.getElementById("confirm-base-url").value = probeData.base_url;
    document.getElementById("confirm-endpoint").value = probeData.endpoint;
    document.getElementById("confirm-key").value = key;

    selectedModels = new Set();
    renderModelCheckboxes(probeData.models, "model-checkboxes");
    formProbe.style.display = "none";
    formConfirm.style.display = "";
  } catch (err) {
    status.textContent = `探测失败: ${err.message}`;
    status.className = "probe-status err";
  }
};

document.getElementById("btn-back").onclick = () => {
  formConfirm.style.display = "none";
  formProbe.style.display = "";
};

formConfirm.onsubmit = async (e) => {
  e.preventDefault();
  const models = [...selectedModels].map(id => ({ model_id: id }));
  if (!models.length) { alert("至少选择一个模型"); return; }

  await post("/create", {
    provider_name: document.getElementById("confirm-name").value,
    base_url: document.getElementById("confirm-base-url").value,
    endpoint: document.getElementById("confirm-endpoint").value,
    api_format: probeData?.api_format || "openai",
    api_key: document.getElementById("confirm-key").value || undefined,
    models,
  });

  dialogAdd.close();
  await loadProviders();
};

document.getElementById("btn-add-model").onclick = () => {
  const input = document.getElementById("input-manual-model");
  const id = input.value.trim();
  if (!id) return;
  selectedModels.add(id);
  input.value = "";
  renderModelCheckboxes([...selectedModels], "model-checkboxes");
};

function renderModelCheckboxes(models, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = models.map(m => `
    <label class="model-check">
      <input type="checkbox" value="${esc(m)}" ${selectedModels.has(m) ? "checked" : ""}>
      ${esc(m)}
    </label>
  `).join("");
  container.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.onchange = () => {
      if (cb.checked) selectedModels.add(cb.value);
      else selectedModels.delete(cb.value);
    };
  });
}

// --- Add Model Dialog ---

const dialogModel = document.getElementById("dialog-add-model");
const formAddModel = document.getElementById("form-add-model");
let addModelBaseUrl = "";

window.openAddModel = function(baseUrl, providerName) {
  addModelBaseUrl = baseUrl;
  document.getElementById("add-model-provider").textContent = providerName;
  document.getElementById("input-model-id").value = "";
  document.getElementById("input-model-display").value = "";
  document.getElementById("probe-models-section").style.display = "none";
  dialogModel.showModal();
};

document.getElementById("btn-cancel-model").onclick = () => dialogModel.close();

document.getElementById("btn-probe-model").onclick = async () => {
  const p = providers.find(x => x.base_url === addModelBaseUrl);
  if (!p) return;
  try {
    const result = await post("/probe", {
      url: p.base_url + p.endpoint,
      api_key: p.models[0]?.api_key,
    });
    if (result.models?.length) {
      const section = document.getElementById("probe-models-section");
      section.style.display = "";
      document.getElementById("probe-model-checkboxes").innerHTML = result.models.map(m => `
        <label class="model-check">
          <input type="checkbox" value="${esc(m)}" data-model-pick>
          ${esc(m)}
        </label>
      `).join("");
    }
  } catch (err) {
    alert("探测失败: " + err.message);
  }
};

formAddModel.onsubmit = async (e) => {
  e.preventDefault();
  const picked = document.querySelectorAll("[data-model-pick]:checked");
  const models = [...picked].map(cb => ({ model_id: cb.value }));

  const manualId = document.getElementById("input-model-id").value.trim();
  if (manualId && !models.some(m => m.model_id === manualId)) {
    models.push({
      model_id: manualId,
      display_name: document.getElementById("input-model-display").value || undefined,
    });
  }
  if (!models.length) { alert("输入或选择至少一个模型"); return; }

  for (const m of models) {
    await post("/model/add", { base_url: addModelBaseUrl, ...m });
  }
  dialogModel.close();
  await loadProviders();
};

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

loadProviders();
