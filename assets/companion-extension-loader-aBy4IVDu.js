import{F as e,G as t,H as n,L as r,N as i,O as a,a as o,d as s,ot as c,st as l}from"./dist-DFIIeeW2.js";import{d as u}from"./fs-access-D-fDaJ8V-D4qvKoNj.js";import"./lit-Kr-z_jtQ.js";import{t as d}from"./api-CjEJgKoe.js";import{n as f,t as p}from"./api-Ce3SVMD6.js";var m=class extends o{constructor(...e){super(...e),this.ready=!1,this.checking=!1}connectedCallback(){super.connectedCallback(),this.refresh()}async refresh(){if(!this.checking){this.checking=!0;try{this.ready=(await new f().health()).ok}finally{this.checking=!1}}}render(){let e=this.checking?`Checking Companion…`:this.ready?`Companion connected — click to check`:`Companion unavailable — click to check`,t=this.ready?`var(--wa-color-success-600, #16a34a)`:`var(--wa-color-danger-600, #dc2626)`;return c`
      <wa-button
        appearance="plain"
        size="small"
        title=${e}
        aria-label=${e}
        ?disabled=${this.checking}
        @click=${()=>void this.refresh()}
      >
        <wa-icon
          name=${this.checking?`circle-notch`:`circle`}
          class=${this.checking?`spinning`:``}
          style="color: ${t}; font-size: 0.625rem;"
        ></wa-icon>
      </wa-button>
    `}static{this.styles=l`
    :host {
      display: inline-flex;
      align-items: center;
      height: 100%;
      padding-left: 0.5rem;
    }

    .spinning {
      animation: cloudadmin-companion-spin 1s linear infinite;
    }

    @keyframes cloudadmin-companion-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `}};a([i()],m.prototype,`ready`,void 0),a([i()],m.prototype,`checking`,void 0),m=a([e(`cloudadmin-companion-status`)],m);var h=!1,g,_=!1;function v(e){let t=String(e.tool??``).trim();if(t)return{tool:t,allowedArgsPrefixes:(e.allowedArgsPrefixes??[]).map(e=>e.map(e=>String(e).trim()).filter(Boolean)).filter(e=>e.length>0)}}function y(){let e=n.getContributions(p),t=new Map;for(let n of e){let e=String(n.requester??``).trim();if(!e)continue;let r=(n.rules??[]).map(v).filter(Boolean);r.length!==0&&t.set(e,[...t.get(e)??[],...r])}return t}async function b(){let e=y();if(e.size===0)return;let n=new f;for(let[r,i]of e)await n.registerToolPolicies({requester:r,rules:i}),t(`Tool policies registered from "${r}": ${i.length} rule${i.length===1?``:`s`}`)}function x(){if(g){_=!0;return}g=(async()=>{do _=!1,await b();while(_)})().catch(()=>{}).finally(()=>{g=void 0})}function S(){h||(h=!0,x(),u(r,e=>{e?.target&&e.target!==`companion.toolPolicies`||x()}))}var C=new URL(`/cloudadmin/assets/cloudadmin-companion-DYWGHpS5.`,``+import.meta.url).href,w=new URL(`../companion/vendor/bin/cloudadmin-companion.exe`,``+import.meta.url).href,T={label:`Companion`,icon:`server`,contributionId:`catalog.companion`,items:[{label:`Binaries`,icon:`file-zipper`,contributionId:`catalog.companion.binaries`,items:[{label:`cloudadmin-companion (linux-x64)`,icon:`download`,state:{url:C,filename:`cloudadmin-companion`}},{label:`cloudadmin-companion.exe (windows-x64)`,icon:`download`,state:{url:w,filename:`cloudadmin-companion.exe`}}]}]};function E(){d(T),S(),n.registerContribution(s,{target:s,label:`Companion`,component:`<cloudadmin-companion-status></cloudadmin-companion-status>`})}export{E as default};