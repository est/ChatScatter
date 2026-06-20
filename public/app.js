let conversations = [];
let activeId = null;

async function loadConversations() {
  // TODO: replace with real API call
  conversations = [];
  renderTree();
}

function renderTree() {
  const tree = document.getElementById("tree");
  if (!conversations.length) {
    tree.innerHTML = '<div class="tree-empty">No conversations yet</div>';
    return;
  }

  tree.innerHTML = conversations.map(c => `
    <div class="tree-item ${c.id === activeId ? "active" : ""}" onclick="selectConversation('${c.id}')">
      <span class="tree-item-label">${esc(c.title)}</span>
      <span class="tree-item-time">${esc(c.time || "")}</span>
    </div>
  `).join("");
}

window.selectConversation = function(id) {
  activeId = id;
  renderTree();
  // TODO: load messages
};

document.getElementById("btn-new-chat").onclick = () => {
  // TODO: create conversation
};

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

loadConversations();
