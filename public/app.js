const API = "/api/chat";

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

async function get(path) {
  const res = await fetch(`${API}${path}`);
  const json = await res.json();
  if (json.em) throw new Error(json.em);
  return json.data;
}

let conversations = [];
let activeConvId = null;
let treeNodes = [];
let sending = false;
let currentUser = null;

// --- Session check ---

async function checkSession() {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    if (json.em === "unauthorized") {
      window.location.href = "/login";
      return;
    }
    currentUser = json.data;
    if (currentUser) {
      document.getElementById("main-header-meta").textContent = currentUser.email;
    }
  } catch {
    window.location.href = "/login";
    return;
  }
  loadConversations();
}

// --- Sidebar: conversation list ---

async function loadConversations() {
  conversations = await get("/list");
  renderSidebar();
}

function renderSidebar() {
  const tree = document.getElementById("tree");
  if (!conversations.length) {
    tree.innerHTML = '<div class="tree-empty">No conversations yet</div>';
    return;
  }

  const convListHtml = conversations.map(c => {
    const idx = (c.idx || "").toLowerCase();
    const isActive = c.conv_id === activeConvId;
    return `<div class="tree-item ${isActive ? "active" : ""}" onclick="selectConv('${c.conv_id}')">
      <span class="tree-item-label">${esc(c.title || c.user_content || "Untitled")}</span>
    </div>`;
  }).join("");

  if (activeConvId && treeNodes.length) {
    tree.innerHTML = `<div class="conv-list">${convListHtml}</div>
      <div class="tree-divider"></div>
      <div class="graph-container">${renderGraph()}</div>`;
  } else {
    tree.innerHTML = `<div class="conv-list">${convListHtml}</div>`;
  }
}

// --- git log --graph rendering ---

function renderGraph() {
  if (!treeNodes.length) return "";

  // Build lane assignment: each unique prefix_idx path gets a lane
  const lanes = new Map(); // prefixHex -> lane index
  let nextLane = 0;

  let html = "";

  for (const node of treeNodes) {
    const idx = node.idx.toLowerCase();
    const prefix = (node.prefix_idx || "").toLowerCase();
    const scatterFrom = node.scatter_from ? node.scatter_from.toLowerCase() : null;

    // Assign lane
    const laneKey = prefix + idx;
    if (!lanes.has(laneKey)) {
      lanes.set(laneKey, nextLane++);
    }
    const lane = lanes.get(laneKey);

    // Determine prefix lane for parent
    let parentLane = 0;
    if (prefix) {
      const parentKey = prefix;
      // Find parent's lane
      for (const [k, v] of lanes) {
        if (k.endsWith(prefix) || k === prefix) {
          parentLane = v;
          break;
        }
      }
    }

    const label = node.title || (node.user_content ? node.user_content.slice(0, 30) : `node ${idx}`);
    const isFocus = idx === (localStorage.getItem(`focus_${activeConvId}`) || "").toLowerCase();

    // Build graph chars
    const chars = [];
    const maxLane = Math.max(lane, parentLane, ...Array.from(lanes.values()));
    for (let i = 0; i <= maxLane; i++) {
      if (i === lane && i === parentLane) {
        chars.push("*"); // same lane, continues
      } else if (i === lane) {
        chars.push(scatterFrom ? "/" : "*"); // new branch or scatter
      } else if (i === parentLane) {
        chars.push("|"); // parent continues
      } else if (i > parentLane && i < lane) {
        chars.push("/"); // crossing
      } else {
        chars.push(" ");
      }
    }

    html += `<div class="graph-line ${isFocus ? "focus" : ""}" onclick="window._scrollToNode('${idx}')">
      <span class="graph-chars">${chars.map(c => `<span class="graph-${c === "*" ? "star" : c === "/" ? "slash" : c === "|" ? "pipe" : "space"}">${c}</span>`).join("")}</span>
      <span class="graph-label">${esc(label)}</span>
    </div>`;
  }

  return html;
}

// --- Actions ---

window.selectConv = async function(convId) {
  activeConvId = convId;
  localStorage.setItem("activeConv", convId);
  await loadTree(convId);
  renderSidebar();
  renderMessages();
};

window._scrollToNode = function(idx) {
  localStorage.setItem(`focus_${activeConvId}`, idx);
  const el = document.getElementById("msg-" + idx);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight-flash");
    setTimeout(() => el.classList.remove("highlight-flash"), 1200);
  }
};

window.toggleFold = function(idx) {
  const body = document.getElementById("ai-body-" + idx);
  if (!body) return;
  body.classList.toggle("folded");
  const btn = body.parentElement.querySelector(".msg-fold-btn");
  if (btn) btn.textContent = body.classList.contains("folded") ? "展开" : "收起";
};

async function loadTree(convId) {
  treeNodes = await get(`/tree?conv_id=${convId}`);
}

// --- Messages ---

function renderMessages() {
  const container = document.getElementById("messages");
  const title = document.getElementById("main-header-title");

  if (!activeConvId || !treeNodes.length) {
    title.textContent = "Select a conversation";
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">&gt;_</div><div class="empty-state-text">Start a new conversation</div></div>`;
    return;
  }

  // Find focus path
  const focusIdx = localStorage.getItem(`focus_${activeConvId}`);
  let pathNodes = [];

  if (focusIdx) {
    const focusNode = treeNodes.find(n => n.idx.toLowerCase() === focusIdx.toLowerCase());
    if (focusNode) {
      const prefix = focusNode.prefix_idx || "";
      const ancestorIdxes = prefix.match(/.{4}/g) || [];
      pathNodes = ancestorIdxes
        .map(hex => treeNodes.find(n => n.idx.toLowerCase() === hex.toLowerCase()))
        .filter(Boolean);
      pathNodes.push(focusNode);
    }
  } else {
    // Default: all root-path nodes
    pathNodes = treeNodes.filter(n => !n.prefix_idx || n.prefix_idx === "");
    if (pathNodes.length) {
      // Just show the last root node and its ancestors
      const last = pathNodes[pathNodes.length - 1];
      pathNodes = [last];
    }
  }

  title.textContent = treeNodes[0]?.title || "Chat";

  let html = "";
  for (const node of pathNodes) {
    if (node.user_content) {
      html += renderNodeMessage(node);
    }
  }

  container.innerHTML = html || `<div class="empty-state"><div class="empty-state-text">No messages yet</div></div>`;
  container.scrollTop = container.scrollHeight;
}

function renderNodeMessage(node) {
  const idx = node.idx.toLowerCase();
  let html = "";

  html += `<div class="msg msg-user" id="msg-${idx}">
    <div class="msg-content">
      <div class="msg-label">You</div>
      <div class="msg-body">${esc(node.user_content)}</div>
    </div>
  </div>`;

  if (node.assistant_content) {
    const rendered = renderMarkdown(node.assistant_content, idx);
    html += `<div class="msg msg-assistant">
      <div class="msg-content">
        <div class="msg-label">AI</div>
        <div class="msg-body" id="ai-body-${idx}">${rendered}</div>
        <span class="msg-fold-btn" onclick="toggleFold('${idx}')">收起</span>
      </div>
    </div>`;
  }

  return html;
}

function renderMarkdown(text, nodeIdx) {
  if (typeof marked === "undefined") return `<pre>${esc(text)}</pre>`;
  const html = marked.parse(text);
  return html.replace(
    /<h2>(.*?)<\/h2>/g,
    (_, heading) => `<h2 class="branch-heading" onclick="window._branch('${nodeIdx}', '${esc(heading).replace(/'/g, "\\'")}')">▸ ${heading}</h2>`
  );
}

window._branch = async function(nodeIdx, heading) {
  if (!activeConvId) return;
  try {
    await post("/branch", { conv_id: activeConvId, node_idx: nodeIdx, heading });
    await loadTree(activeConvId);
    renderSidebar();
    renderMessages();
  } catch (err) {
    alert("Branch error: " + err.message);
  }
};

// --- Send ---

document.getElementById("send").onclick = sendMessage;
document.getElementById("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
document.getElementById("input").addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 120) + "px";
});

async function sendMessage() {
  if (sending) return;
  const input = document.getElementById("input");
  const msg = input.value.trim();
  if (!msg) return;

  if (!activeConvId) {
    const conv = await post("/conversation", { title: msg.slice(0, 50) });
    activeConvId = conv.conv_id;
    localStorage.setItem("activeConv", conv.conv_id);
    await loadConversations();
  }

  input.value = "";
  input.style.height = "auto";
  sending = true;

  const container = document.getElementById("messages");
  const focusIdx = localStorage.getItem(`focus_${activeConvId}`);

  container.innerHTML += `<div class="msg msg-user"><div class="msg-content"><div class="msg-label">You</div><div class="msg-body">${esc(msg)}</div></div></div>
    <div class="msg msg-assistant msg-loading"><div class="msg-content"><div class="msg-label">AI</div><div class="msg-body"><em>Thinking...</em></div></div></div>`;
  container.scrollTop = container.scrollHeight;

  try {
    await post("/send", { conv_id: activeConvId, message: msg, node_idx: focusIdx || undefined });
    await loadTree(activeConvId);
    renderSidebar();
    renderMessages();
  } catch (err) {
    container.innerHTML += `<div class="msg msg-error"><div class="msg-body">Error: ${esc(err.message)}</div></div>`;
  } finally {
    sending = false;
  }
}

// --- New Chat ---

document.getElementById("btn-new-chat").onclick = () => {
  activeConvId = null;
  treeNodes = [];
  localStorage.removeItem("activeConv");
  renderSidebar();
  renderMessages();
};

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

// --- Init ---

async function init() {
  await checkSession();
  const saved = localStorage.getItem("activeConv");
  if (saved) {
    activeConvId = saved;
    await loadTree(saved);
    renderSidebar();
    renderMessages();
  }
}

init();
