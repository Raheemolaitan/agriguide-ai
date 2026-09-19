const $ = id => document.getElementById(id);
let csrfToken = "";
let currentUser = null;

async function initSecurity(){
  const r = await fetch("/api/auth/csrf");
  const d = await r.json();
  csrfToken = d.csrf_token;
}

function showAuth(mode){
  const login = mode === "login";
  $("loginForm").classList.toggle("hidden", !login);
  $("registerForm").classList.toggle("hidden", login);
  $("authTitle").textContent = login ? "Welcome back" : "Create your account";
  $("authSubtitle").textContent = login ? "Sign in securely to access your farm assistant." : "Create a secure farmer account to get started.";
}

function toast(msg){
  const t=$("toast"); t.textContent=msg; t.style.display="block";
  setTimeout(()=>t.style.display="none",3200);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function renderMarkdownish(text){
  let safe=escapeHtml(text);
  safe=safe.replace(/^### (.*)$/gm,"<h3>$1</h3>");
  safe=safe.replace(/^\*\*(.*?)\*\*$/gm,"<strong>$1</strong>");
  safe=safe.replace(/^- (.*)$/gm,"<li>$1</li>");
  safe=safe.replace(/(<li>.*<\/li>\n?)+/gs,m=>"<ul>"+m+"</ul>");
  safe=safe.replace(/\n/g,"<br>");
  return safe;
}

function showSection(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.target===id));
  $(id).classList.remove("hidden");
  if(id==="consultations") loadConsultations();
  if(id==="professional") loadProfessionalConsultations();
}

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>showSection(btn.dataset.target)));

async function checkHealth(){
  try{const r=await fetch("/api/health");const d=await r.json();$("modeBadge").textContent=d.ai_mode==="live"?"● Live AI":"● Demo AI";}
  catch(e){$("modeBadge").textContent="Offline";}
}

async function refreshMe(){
  const r=await fetch("/api/auth/me");
  const d=await r.json();

  if(!d.authenticated){
    currentUser=null;
    $("appView").classList.add("hidden");
    $("authView").classList.remove("hidden");
    showAuth("login");
    return false;
  }

  currentUser=d.user;

  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  $("userBadge").textContent=`👤 ${d.user.name}`;
  $("farmerName").value=d.user.name;
  $("location").value=d.user.location;
  $("farmType").value=d.user.farm_type;
  $("expertLocation").value=d.user.location;

  // Show the professional dashboard only for professional accounts.
  const professionalTab=$("professionalTab");

  if(professionalTab){
    professionalTab.classList.toggle(
      "hidden",
      d.user.role !== "professional"
    );
  }

  return true;
}

$("loginBtn").addEventListener("click",async()=>{
  const email=$("loginEmail").value.trim(), password=$("loginPassword").value;
  if(!email||!password){toast("Enter your email and password.");return;}
  const btn=$("loginBtn");btn.disabled=true;btn.textContent="Signing in…";
  try{
    const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:JSON.stringify({email,password})});
    const d=await r.json(); if(!r.ok)throw new Error(d.error||"Login failed");
    await initSecurity(); await refreshMe(); await checkHealth(); toast("Login successful.");
  }catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent="Log in";}
});

$("registerBtn").addEventListener("click",async()=>{
  const password=$("regPassword").value, confirm=$("regConfirm").value;
  if(password!==confirm){toast("Passwords do not match.");return;}
  const payload={name:$("regName").value.trim(),email:$("regEmail").value.trim(),location:$("regLocation").value.trim(),farm_type:$("regFarmType").value,password};
  const btn=$("registerBtn");btn.disabled=true;btn.textContent="Creating account…";
  try{
    const r=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:JSON.stringify(payload)});
    const d=await r.json(); if(!r.ok)throw new Error(d.error||"Registration failed");
    await initSecurity(); await refreshMe(); await checkHealth(); toast("Account created successfully.");
  }catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent="Create account";}
});

$("logoutBtn").addEventListener("click",async()=>{
  await fetch("/api/auth/logout",{
    method:"POST",
    headers:{"X-CSRF-Token":csrfToken}
  });

  await initSecurity();

  currentUser=null;

  // Clear login form fields after logout.
  $("loginEmail").value="";
  $("loginPassword").value="";

  $("appView").classList.add("hidden");
  $("authView").classList.remove("hidden");
  showAuth("login");

  toast("You have been logged out.");
});

function fillExample(){
  const type=$("farmType").value;
  $("question").value=type==="livestock"?"Several of my chickens are coughing and some have stopped eating. What should I check?":"My tomato leaves have brown spots and the lower leaves are turning yellow. What could be causing this?";
}

$("askBtn").addEventListener("click",async()=>{
  const q=$("question").value.trim(); if(!q){toast("Describe the farm problem first.");return;}
  const btn=$("askBtn");btn.disabled=true;btn.textContent="AgriGuide is thinking…";
  try{
    const r=await fetch("/api/ask",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:JSON.stringify({question:q,farm_type:$("farmType").value})});
    const d=await r.json(); if(r.status===401){return refreshMe()} if(!r.ok)throw new Error(d.error||"Request failed");
    $("answerCard").classList.remove("hidden");
    const action = d.escalate
  ? "⚠️ <strong>Professional assessment recommended.</strong><br><button class=\"primary\" onclick=\"showSection('experts');recommendExpert()\">Find an expert</button>"
  : d.can_recommend_expert
    ? "✅ <strong>Guidance provided.</strong> Monitor the situation and seek professional help if it worsens.<br><button class=\"primary\" onclick=\"showSection('experts');recommendExpert()\">Get professional recommendation</button>"
    : "✅ <strong>Guidance provided.</strong> Monitor the situation and seek professional help if it worsens.";
    const sources = d.sources?.length ? "<div>" + d.sources.map(x=>`<span class=\"source\">${escapeHtml(x)}</span>`).join("") + "</div>" : "";
    $("answerCard").innerHTML=`<h2>AgriGuide assessment</h2><div class=\"answer\">${renderMarkdownish(d.answer)}</div><div class=\"${d.escalate?'warning':'success'}\">${action}</div><p class=\"muted\">Risk signal: <strong>${escapeHtml(d.risk)}</strong> · AI mode: <strong>${escapeHtml(d.mode)}</strong></p>${sources}`;
    $("answerCard").scrollIntoView({behavior:"smooth"});
  }catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent="Get guidance";}
});

$("imageBtn").addEventListener("click",async()=>{
  const file=$("imageFile").files[0];if(!file){toast("Choose an image first.");return;}
  const fd=new FormData();fd.append("image",file);fd.append("question",$("imageQuestion").value);fd.append("farm_type",$("farmType").value);
  const btn=$("imageBtn");btn.disabled=true;btn.textContent="Analyzing…";
  try{const r=await fetch("/api/analyze-image",{method:"POST",headers:{"X-CSRF-Token":csrfToken},body:fd});const d=await r.json();if(r.status===401){return refreshMe()}if(!r.ok)throw new Error(d.error||"Image analysis failed");$("imageResult").classList.remove("hidden");$("imageResult").innerHTML=`<h2>Image assessment</h2><div class="answer">${renderMarkdownish(d.answer)}</div><div class="${d.escalate?'warning':'success'}">${d.escalate?"⚠️ Professional assessment recommended.":"✅ Image received and processed."}</div>`;$("imageResult").scrollIntoView({behavior:"smooth"});}
  catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent="Analyze image";}
});
async function recommendExpert(){
  const problem=$("question").value.trim();

  if(!problem){
    toast("Describe the farm problem first.");
    showSection("assistant");
    $("question").focus();
    return;
  }

  const card=$("expertRecommendation");
  const text=$("recommendationText");
  const button=$("useRecommendationBtn");

  card.classList.remove("hidden");
  text.textContent="AgriGuide is identifying the most relevant professional...";
  button.disabled=true;

  try{
    const r=await fetch("/api/recommend-expert",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-CSRF-Token":csrfToken
      },
      body:JSON.stringify({problem})
    });

    const d=await r.json();

    if(r.status===401){
      return refreshMe();
    }

    if(!r.ok){
      throw new Error(d.error || "Could not recommend a professional.");
    }

    if(!d.expert){
      text.textContent=
        `Based on your question, an ${d.recommended_specialty} may be the most relevant professional.`;
    }else{
      text.innerHTML=
  `Based on your question, AgriGuide recommends a ` +
  `<strong>${escapeHtml(d.recommended_specialty)}</strong> ` +
  `such as <strong>${escapeHtml(d.expert.name)}</strong>.<br>` +
  `<span class="muted">${escapeHtml(d.recommendation_reason || "")}</span>`;
    }

    button.dataset.specialty=d.recommended_specialty;

  }catch(e){
    card.classList.add("hidden");
    toast(e.message);
  }finally{
    button.disabled=false;
  }
}
$("useRecommendationBtn").addEventListener("click",()=>{
  const specialty=$("useRecommendationBtn").dataset.specialty;

  if(!specialty){
    toast("No recommendation is available yet.");
    return;
  }

  $("specialty").value=specialty;
  loadExperts();
});
async function loadExperts(){
  const specialty=$("specialty").value,location=$("expertLocation").value;
  const r=await fetch(`/api/experts?specialty=${encodeURIComponent(specialty)}&location=${encodeURIComponent(location)}`);if(r.status===401){return refreshMe()}
  const experts=await r.json();
  $("expertList").innerHTML=experts.length?experts.map(e=>`<article class="expert"><h3>${escapeHtml(e.name)}</h3><div class="specialty">${escapeHtml(e.specialty)}</div><p>📍 ${escapeHtml(e.location)} · 🕐 ${escapeHtml(e.availability)}</p><p class="muted">${escapeHtml(e.bio)}</p><button class="primary" onclick="requestExpert(${e.id},'${escapeHtml(e.name)}')">Request consultation</button></article>`).join(""):`<div class="card"><strong>No matching demo professional found.</strong><p>Try another specialty or location.</p></div>`;
}
$("findBtn").addEventListener("click",loadExperts);$("specialty").addEventListener("change",loadExperts);

async function requestExpert(id,name){
  const problem=$("question").value.trim()||"Farmer requested professional agricultural assistance.";
  const r=await fetch("/api/consultations",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:JSON.stringify({expert_id:id,problem})});
  const d=await r.json();if(!r.ok){toast(d.error||"Could not create request");return;}toast(`Consultation request #${d.request_id} sent to ${name}.`);loadConsultations();
}

async function loadConsultations(){
  const r=await fetch("/api/my-consultations");

  if(r.status===401){
    return refreshMe();
  }

  const rows=await r.json();

  if(!r.ok){
    toast(rows.error || "Could not load consultation requests.");
    return;
  }
const respondedCount=rows.filter(x=>x.status==="Responded").length;
  const notification=$("consultationNotification");

  if(notification){
    if(respondedCount>0){
      notification.innerHTML=
        `🔔 <strong>${respondedCount} professional response${respondedCount===1?"":"s"} available.</strong> ` +
        `<span>Tap here to view ${respondedCount===1?"it":"them"}.</span>`;

      notification.classList.remove("hidden");
      notification.onclick=()=>{
        $("consultationList").scrollIntoView({behavior:"smooth"});
      };
    }else{
      notification.classList.add("hidden");
      notification.innerHTML="";
      notification.onclick=null;
    }
  }

  $("consultationList").innerHTML=rows.length
    ? rows.map(x=>`
      <article class="expert">
        <h3>Request #${x.id}</h3>
        <div class="specialty">${escapeHtml(x.expert)} · ${escapeHtml(x.specialty)}</div>

        <p><strong>Your question:</strong></p>
        <p>${escapeHtml(x.problem)}</p>

        <p class="muted">
          Submitted: ${escapeHtml(formatConsultationDate(x.created_at))}
          · Status:
          <strong class="consultation-status ${x.status === "Responded" ? "status-responded" : "status-requested"}">
            ${x.status === "Responded" ? "🟢 Responded" : "🟡 Requested"}
          </strong>
        </p>

        ${x.professional_response ? `
          <div class="card">
            <h4>👨🏾‍⚕️ Professional Response</h4>
            <p>${escapeHtml(x.professional_response)}</p>
            ${x.responded_at
              ? `<p class="muted">Responded: ${escapeHtml(formatConsultationDate(x.responded_at))}</p>`
              : ""}
          </div>
        ` : `
          <p class="muted">⏳ Waiting for the professional's response.</p>
        `}
      </article>
    `).join("")
    : `<div class="card">
        <strong>No consultation requests yet.</strong>
        <p>When you request a professional, it will appear here.</p>
      </div>`;
}

function formatConsultationDate(value){
  if(!value) return "";

  const date=new Date(value);

  if(Number.isNaN(date.getTime())){
    return value;
  }

  return date.toLocaleString("en-US", {
    month:"long",
    day:"numeric",
    year:"numeric",
    hour:"numeric",
    minute:"2-digit"
  });
}

async function loadProfessionalConsultations(){
  const r=await fetch("/api/professional/consultations");

  if(r.status===401){
    return refreshMe();
  }

  const d=await r.json();

  if(r.status===403){
    toast(d.error || "Professional access required.");
    return;
  }

  if(!r.ok){
    toast(d.error || "Could not load professional requests.");
    return;
  }
const totalRequests=d.length;
  const pendingRequests=d.filter(x=>x.status==="Requested").length;
  const respondedRequests=d.filter(x=>x.status==="Responded").length;

  const summary=$("professionalSummary");

  if(summary){
    summary.innerHTML=`
      <div class="professional-summary-grid">
        <div class="summary-item">
          <strong>📋 ${totalRequests}</strong>
          <span>Total requests</span>
        </div>

        <div class="summary-item">
          <strong>🟡 ${pendingRequests}</strong>
          <span>Pending</span>
        </div>

        <div class="summary-item">
          <strong>🟢 ${respondedRequests}</strong>
          <span>Responded</span>
        </div>
      </div>
    `;
  }

  $("professionalConsultationList").innerHTML=d.length
    ? d.map(x=>`
      <article class="expert">
        <h3>Request #${x.id}</h3>

        <div class="specialty">
          ${escapeHtml(x.expert)} · ${escapeHtml(x.specialty)}
        </div>

        <p><strong>Farmer:</strong> ${escapeHtml(x.farmer_name)}</p>
        <p><strong>Location:</strong> ${escapeHtml(x.location)}</p>

        <p><strong>Farmer's question:</strong></p>
        <p>${escapeHtml(x.problem)}</p>

        <p class="muted">
          Submitted: ${escapeHtml(formatConsultationDate(x.created_at))}
          · Status:
          <strong class="consultation-status ${x.status === "Responded" ? "status-responded" : "status-requested"}">
            ${x.status === "Responded" ? "🟢 Responded" : "🟡 Requested"}
          </strong>
        </p>

        ${x.status === "Requested" ? `
          <div class="card">
            <h4>👨🏾‍⚕️ Respond to Farmer</h4>

            <textarea
              id="professionalResponse-${x.id}"
              rows="5"
              placeholder="Write your professional guidance here..."
              maxlength="4000"
            ></textarea>

            <button
              class="primary"
              type="button"
              onclick="submitProfessionalResponse(${x.id})"
            >
              Send Response
            </button>
          </div>
        ` : `
          <div class="card">
            <h4>✅ Professional Response</h4>
            <p>${escapeHtml(x.professional_response || "No response text recorded.")}</p>

            ${x.responded_at
              ? `<p class="muted">Responded: ${escapeHtml(formatConsultationDate(x.responded_at))}</p>`
              : ""}
          </div>
        `}
      </article>
    `).join("")
    : `<div class="card">
        <strong>No consultation requests yet.</strong>
        <p>New farmer requests will appear here.</p>
      </div>`;
}

async function submitProfessionalResponse(consultationId){
  const field=$("professionalResponse-" + consultationId);

  if(!field){
    toast("Response field not found.");
    return;
  }

  const response=field.value.trim();

  if(!response){
    toast("Please write a response before sending.");
    field.focus();
    return;
  }

  if(response.length > 4000){
    toast("Response is too long.");
    return;
  }

  const r=await fetch(
    "/api/professional/consultations/" + consultationId + "/respond",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "X-CSRF-Token":csrfToken
      },
      body:JSON.stringify({response})
    }
  );

  const d=await r.json();

  if(r.status===401){
    return refreshMe();
  }

  if(r.status===403){
    toast(d.error || "Professional access required.");
    return;
  }

  if(r.status===409){
    toast(d.error || "This consultation has already been answered.");
    await loadProfessionalConsultations();
    return;
  }

  if(!r.ok){
    toast(d.error || "Could not send professional response.");
    return;
  }

  toast("Professional response sent successfully.");
  await loadProfessionalConsultations();
}

(async()=>{try{await initSecurity();const ok=await refreshMe();if(ok){await checkHealth();await loadExperts();}}catch(e){toast("Could not initialize AgriGuide security.")}})();
