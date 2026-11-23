/* GitHub連携: ブラウザからリポジトリ内のJSONを直接読み書きする(スマホ用)
 * 必要なもの: 対象リポジトリの Contents 読み書き権限だけを持つ fine-grained トークン。
 * 設定はこの端末のブラウザ(localStorage)にだけ保存され、リポジトリには含まれません。 */
const GH=(()=>{
  const K="mushoku_gh_settings_v1",shas={};
  const blank={owner:"",repo:"",branch:"main",dir:"",token:""};
  const get=()=>{try{return{...blank,...JSON.parse(localStorage.getItem(K)||"{}")}}catch(e){return{...blank}}};
  const set=s=>localStorage.setItem(K,JSON.stringify(s));
  const ready=()=>{const s=get();return!!(s.owner&&s.repo&&s.token)};
  const seg=p=>p.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const dirOf=s=>(s.dir||"").replace(/^\/+|\/+$/g,"");
  const root=s=>`https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents`;
  const fileUrl=(s,n)=>`${root(s)}/${seg([dirOf(s),n].filter(Boolean).join("/"))}`;
  const listUrl=s=>`${root(s)}${dirOf(s)?"/"+seg(dirOf(s)):""}?ref=${encodeURIComponent(s.branch)}`;
  const H=(s,raw)=>({"Authorization":"Bearer "+s.token,"Accept":raw?"application/vnd.github.raw+json":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"});
  function need(s){if(!(s.owner&&s.repo&&s.token))throw new Error("ユーザー名・リポジトリ名・トークンを入力して「設定を保存」を押してください")}
  async function ok(r){
    if(r.ok)return r;let m="";try{m=(await r.json()).message}catch(e){}
    const hint=r.status===401?"(トークンが無効か期限切れです)":(r.status===403||r.status===404)?"(権限・リポジトリ名・ブランチ・フォルダを確認してください)":"";
    const e=new Error(`GitHub ${r.status}: ${m||r.statusText} ${hint}`.trim());e.status=r.status;throw e;
  }
  async function currentSha(s,name){
    const list=await(await ok(await fetch(listUrl(s),{headers:H(s),cache:"no-store"}))).json();
    const f=Array.isArray(list)&&list.find(x=>x.name===name);return f?f.sha:null;
  }
  async function load(name){
    const s=get();need(s);
    const sha=await currentSha(s,name);if(!sha)throw new Error(`${name} がリポジトリに見つかりません(フォルダ設定を確認してください)`);
    const r=await ok(await fetch(`${fileUrl(s,name)}?ref=${encodeURIComponent(s.branch)}`,{headers:H(s,true),cache:"no-store"}));
    const obj=JSON.parse(await r.text());shas[name]=sha;return obj;
  }
  // 読みやすさとサイズ削減のため、要素1件は1行にまとめて出力する
  const stringify=o=>JSON.stringify(o,null,2).replace(/\{\s+"value": (-?[\d.]+),\s+"confidence": ([\d.]+)\s+\}/g,'{"value": $1, "confidence": $2}')+"\n";
  const b64=t=>{const b=new TextEncoder().encode(t);let s="";for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)};
  async function push(files,msg){
    const s=get();need(s);
    for(const{name,obj}of files){
      const sha=shas[name]!==undefined?shas[name]:await currentSha(s,name);
      const body={message:msg||"ツールからデータを更新",content:b64(stringify(obj)),branch:s.branch};if(sha)body.sha=sha;
      const r=await fetch(fileUrl(s,name),{method:"PUT",headers:{...H(s),"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(r.status===409||r.status===422){const e=new Error("他の端末などで先に更新されています。「GitHubから読み込む」で最新を読み込み直してください");e.status=r.status;throw e}
      shas[name]=(await(await ok(r)).json()).content.sha;
    }
  }
  function ui(slot,onLoaded){
    const s=get();
    slot.innerHTML=`<details style="margin:0 0 12px;border:1px solid var(--bd);border-radius:10px;padding:8px 12px">
<summary style="cursor:pointer;font-weight:600">GitHub連携(スマホ・別端末から保存する)</summary>
<label>GitHubユーザー名</label><input type="text" id="gh_owner" autocomplete="off" autocapitalize="off" value="${s.owner}">
<label>リポジトリ名</label><input type="text" id="gh_repo" autocomplete="off" autocapitalize="off" value="${s.repo}">
<label>ブランチ</label><input type="text" id="gh_branch" autocomplete="off" autocapitalize="off" value="${s.branch}">
<label>データのフォルダ(ルートなら空)</label><input type="text" id="gh_dir" autocomplete="off" autocapitalize="off" value="${s.dir}">
<label>アクセストークン(fine-grained / Contents: Read and write)</label><input type="password" id="gh_token" autocomplete="off" value="${s.token}">
<div class="row"><button id="gh_save">設定を保存</button><button id="gh_load" class="primary">GitHubから読み込む</button></div>
<div class="hint" id="gh_status">トークンはこの端末のブラウザにだけ保存されます。共有の端末では使わないでください。</div></details>`;
    const q=id=>slot.querySelector("#"+id),st=t=>q("gh_status").textContent=t;
    const read=()=>({owner:q("gh_owner").value.trim(),repo:q("gh_repo").value.trim(),branch:q("gh_branch").value.trim()||"main",dir:q("gh_dir").value.trim(),token:q("gh_token").value.trim()});
    q("gh_save").onclick=()=>{set(read());st("設定を保存しました。")};
    q("gh_load").onclick=async()=>{
      set(read());st("読み込み中…");
      try{const e=await load("elements.json"),c=await load("characters.json");onLoaded(e,c);st(`読み込みました(キャラ ${c.characters.length} 人)。`)}
      catch(err){st("読み込みに失敗: "+err.message)}
    };
  }
  return{ui,load,push,ready,stringify};
})();
