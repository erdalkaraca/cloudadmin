import{B as e,D as t,E as n,F as r,H as i,N as a,O as o,P as s,R as c,S as l,_ as u,f as d,l as f,n as p,o as m,ot as h,rt as g,st as _,x as ee,z as v}from"./dist-DFIIeeW2.js";import{d as y,f as b}from"./fs-access-D-fDaJ8V-D4qvKoNj.js";import"./lit-Kr-z_jtQ.js";import"./monaco-widget-fMLWniJD-DJMJgJ9n.js";import{S as x,a as S,b as C,c as w,d as T,f as E,h as te,i as ne,l as re,m as D,n as ie,o as ae,r as oe,s as O,t as k,u as A,v as j,x as M,y as N}from"./cloud-connection-service-mKtz1pNm.js";var P=`view.cloud`,F=`No cloud accounts yet. Use Add cloud account to connect a provider.`;function I(e){return{label:e,icon:`triangle-exclamation`,leaf:!0,children:[],loaded:!0}}function L(e){return e.kind===M.Workload?!0:!!(e.meta&&(e.meta.openInEditor===!0||e.meta.openInEditor===`true`))}function R(e){switch(e){case M.Connection:return`Refresh connection`;case M.Scope:return`Refresh scope`;case M.Group:return`Refresh group`;case M.Workload:return`Refresh workload`;case M.Service:return`Refresh service`;default:return`Refresh`}}function z(e,t){return e.icon?e.icon:e.kind===M.Connection?k.getConnectionContributor(t.providerId)?.icon??x(e.kind):x(e.kind)}var B=class extends m{constructor(...e){super(...e),this.rootNodes=[],this.providerContextActions=[],this.treeRef=n(),this.loadingNodes=new Set}doBeforeUI(){k.initialize().then(()=>this.rebuildTree()),this.subscriptionToken=y(ie,()=>this.rebuildTree())}doClose(){this.subscriptionToken&&=(b(this.subscriptionToken),void 0),super.doClose()}async rebuildTree(){let e=k.getConnections();this.rootNodes=e.map(e=>this.connectionToTreeNode(e)),await Promise.all(this.rootNodes.map(e=>this.loadNodeChildren(e))),this.requestUpdate()}connectionToTreeNode(e){let t={nodeId:`${e.id}/connection`,connectionId:e.id,providerId:e.providerId,kind:M.Connection,label:e.name,hasChildren:!0},n=!!e.errorMessage?.trim();return{data:{cloudRef:t,connection:e},label:t.label,icon:z(t,e),leaf:!1,children:n?[I(String(e.errorMessage))]:[],loaded:n,loadError:void 0}}renderToolbar(){return h`
      <docks-command
        icon="plus"
        title="Add cloud account"
        label
        dropdown=${C}
      ></docks-command>
      <docks-command
        icon="arrows-rotate"
        title="Refresh"
        .action=${()=>void this.rebuildTree()}
      ></docks-command>
    `}shellActions(e){let{cloudRef:t,connection:n}=e,r=[];return k.supportsEditConnection(n.providerId)&&r.push({id:`cloudadmin.shell.edit`,label:`Edit connection`,icon:`pen-to-square`,run:()=>j(async()=>{await k.editConnection(n.id),await this.rebuildTree()})}),t.kind===M.Connection&&(r.push({id:`cloudadmin.shell.rename`,label:`Rename`,icon:`pen`,run:()=>j(async()=>{let e=(await ee({label:`Rename connection`,fields:[{name:`name`,label:`Connection name`,value:n.name}]})).name;e!==n.name&&await k.renameConnection(n.id,e)})}),r.push({id:`cloudadmin.shell.disconnect`,label:`Disconnect`,icon:`trash`,run:()=>j(async()=>{await u(`Disconnect "${n.name}"?`)&&await k.removeConnection(n.id)})})),L(t)&&r.push({id:`cloudadmin.shell.open-workload`,label:`Open`,icon:`up-right-from-square`,run:()=>j(()=>E(n,t))}),r.push({id:`cloudadmin.shell.refresh`,label:R(t.kind),icon:`arrows-rotate`,run:()=>j(()=>this.refreshSelectedNode(e))}),r}findTreeNode(e){let t=(n,r)=>{for(let i of n){if(i.data?.cloudRef?.nodeId===e)return{node:i,parent:r};if(i.children?.length){let e=t(i.children,i);if(e)return e}}};return t(this.rootNodes,null)}async refreshSelectedNode(e){let{cloudRef:t,connection:n}=e,r=this.findTreeNode(t.nodeId);if(r){if(t.kind===M.Connection){await k.refreshConnection(n.id);let e=k.getConnection(n.id);e?.status===`error`&&e.errorMessage&&N(Error(e.errorMessage));return}if(t.kind===M.Workload){await this.refreshWorkloadNode(r.node,t.nodeId),this.requestUpdate();return}await this.reloadNodeChildren(r.node),this.requestUpdate()}}async reloadNodeChildren(e){!e.data||e.leaf||(e.loaded=!1,e.loadError=void 0,e.children=[],await this.loadNodeChildren(e))}async refreshWorkloadNode(e,t){let n=this.findTreeNode(t)?.parent;if(!n||!n.data)return;await this.reloadNodeChildren(n);let r=n.children?.find(e=>e.data?.cloudRef.nodeId===t);r&&(e.data=r.data,e.label=r.label,e.icon=r.icon,e.leaf=r.leaf,e.loadError=r.loadError,e.children=r.children,e.loaded=r.loaded)}async loadProviderContextActions(e){let t=await k.getActions(e.cloudRef,e.connection);this.selectedData()?.cloudRef.nodeId===e.cloudRef.nodeId&&(this.providerContextActions=t,this.requestUpdate())}renderActionCommands(e,t){return h`${e.map(e=>h`
        <docks-command
          icon=${e.icon??``}
          title=${e.label}
          ?disabled=${e.disabled??!1}
            .action=${()=>void j(()=>e.run({connection:t.connection,node:t.cloudRef}))}
        >
          ${e.label}
        </docks-command>
      `)}`}renderContextMenu(){if(this.rootNodes.length===0)return g;let e=this.selectedData();return e?this.renderActionCommands([...this.providerContextActions,...this.shellActions(e)],e):h`
      <docks-command
        icon="arrows-rotate"
        title="Refresh all connections"
        .action=${()=>void this.rebuildTree()}
      >
        Refresh all
      </docks-command>
    `}selectedData(){let t=e.get();return t?.connection?t:void 0}async loadNodeChildren(e,t=!0){let n=e.data;if(!(!n||e.leaf||e.loaded||this.loadingNodes.has(e))){this.loadingNodes.add(e);try{e.children=(await te.getChildren(n.cloudRef,n.connection)).map(e=>this.cloudRefToTreeNode(e,n.connection)),e.loaded=!0,t&&this.requestUpdate()}catch(n){e.loadError=n instanceof Error?n.message:String(n),e.children=[I(e.loadError)],e.loadError=void 0,e.loaded=!0,t&&this.requestUpdate()}finally{this.loadingNodes.delete(e)}}}async onLazyLoad(e,t){let n=e.currentTarget;t.loaded||await this.loadNodeChildren(t,!1),n.lazy=!1,n.loading=!1,this.requestUpdate()}cloudRefToTreeNode(e,t){return{data:{cloudRef:e,connection:t},label:e.label,icon:z(e,t),leaf:!e.hasChildren,children:[],loaded:!e.hasChildren}}createTreeItems(e,t=!1){if(!e)return h``;let n=!e.leaf&&!e.loaded;return h`
      <wa-tree-item
        @dblclick=${this.nobubble(t=>this.onItemDblClicked(t,e))}
        @wa-lazy-load=${this.nobubble(t=>this.onLazyLoad(t,e))}
        .model=${e}
        ?expanded=${t}
        ?lazy=${n}
      >
        <div class="tree-item-rows">
          <div class="tree-item-label-row">
            <span class="tree-label">
              ${l(e.icon,{label:e.leaf?`Resource`:`Group`})}
              <span class="tree-label-text">${e.label}</span>
            </span>
          </div>
        </div>
        ${e.children?.map(e=>this.createTreeItems(e))}
      </wa-tree-item>
    `}onItemDblClicked(e,t){let n=t.data;if(n&&t.leaf&&L(n.cloudRef)){j(()=>E(n.connection,n.cloudRef));return}let r=e.currentTarget;!t.leaf&&`expanded`in r&&(r.expanded=!r.expanded)}onSelectionChanged(t){let n=t.detail?.selection?.[0]?.model?.data;if(n?.connection){e.set(n),this.providerContextActions=[],this.loadProviderContextActions(n);return}e.set(void 0),this.providerContextActions=[]}renderContent(){return h`
      <div class="tree" ${t(this.treeRef)}>
        ${this.rootNodes.length>0?h`
              <wa-tree
                @wa-selection-change=${this.nobubble(this.onSelectionChanged)}
                style="--indent-guide-width: 1px;"
              >
                ${this.rootNodes.map(e=>this.createTreeItems(e,!0))}
              </wa-tree>
            `:h`
              <docks-no-content message=${F} icon="cloud"></docks-no-content>
            `}
      </div>
    `}static{this.styles=_`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .tree {
      height: 100%;
      min-height: 0;
      position: relative;
    }

    .tree wa-tree {
      height: 100%;
    }

    .tree-item-rows {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--wa-space-2xs);
      min-width: 0;
      width: 100%;
    }

    .tree-item-label-row {
      min-width: 0;
    }

    .tree-item-detail-row {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      overflow-wrap: anywhere;
    }

    .tree-item-error-text {
      font-size: var(--wa-font-size-s);
      line-height: var(--wa-line-height-normal);
      color: var(--wa-color-danger-text, #c62828);
    }

    .tree-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .tree-label-text {
      white-space: nowrap;
    }
  `}};o([a()],B.prototype,`rootNodes`,void 0),o([a()],B.prototype,`providerContextActions`,void 0),B=o([r(`docks-cloud-tree`)],B);function V(){i.registerContribution(f,{name:P,label:`Cloud Browser`,icon:`cloud`,closable:!1,toolbar:!0,component:e=>h`<docks-cloud-tree id="${e}"></docks-cloud-tree>`})}var H=class extends m{constructor(...e){super(...e),this.scrollMode=`native`}renderContent(){return h`
      <docks-tabs id=${S} placement="bottom"></docks-tabs>
    `}static{this.styles=[_`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        min-height: 0;
        box-sizing: border-box;
      }

      .part-shell {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
        width: 100%;
      }

      .part-toolbar {
        display: none;
      }

      .part-content {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      .part-content-inner {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
      }

      docks-tabs {
        flex: 1 1 0;
        min-height: 0;
        width: 100%;
        height: 100%;
      }
    `]}};o([s({attribute:!1})],H.prototype,`editorInput`,void 0),H=o([r(`cloudadmin-workload-editor`)],H);function U(e){let t=e;for(;t;){if(t instanceof H)return t;let e=t.parentElement;if(e)t=e;else{let e=t.getRootNode();t=e instanceof ShadowRoot?e.host:null}}return null}function W(){return U(v.get())??(c.get()instanceof H?c.get():null)}function G(){let e=W()?.editorInput;if(e)return{connection:k.getConnection(e.connection.id)??e.connection,node:e.node}}function K(){let e=G();return e?D.getHandler(e.connection.providerId)?.getCapabilities(e)??{}:{}}function q(e){return!!K()[e]}var J=class extends m{constructor(...e){super(...e),this.scrollMode=`native`,this.loaded=!1,this.tabRevealed=!1}get workloadShell(){return this.findWorkloadShell(this)}get editorInput(){return this.workloadShell?.editorInput}get context(){let e=this.editorInput;if(!e)throw Error(`No workload editor.`);return{connection:k.getConnection(e.connection.id)??e.connection,node:e.node}}get handler(){return D.getHandler(this.context.connection.providerId)}get capabilities(){return this.editorInput?this.handler?.getCapabilities(this.context)??{}:{}}renderLoading(){return h`<p class="muted">Loading…</p>`}connectedCallback(){super.connectedCallback(),this.syncTabRevealed(),this.tabShowListener=e=>{let t=e.detail?.name;t&&t===this.tabContribution?.name&&this.onTabShown()},this.closest(`wa-tab-group`)?.addEventListener(`wa-tab-show`,this.tabShowListener),this.tabRevealed&&this.onTabShown()}disconnectedCallback(){this.tabShowListener&&this.closest(`wa-tab-group`)?.removeEventListener(`wa-tab-show`,this.tabShowListener),super.disconnectedCallback()}syncTabRevealed(){this.closest(`wa-tab-panel`)?.hasAttribute(`active`)&&(this.tabRevealed=!0)}async onTabShown(){this.tabRevealed=!0,await this.ensureLoaded(),await this.afterTabShown(),this.requestUpdate()}async afterTabShown(){}resetState(){}async ensureLoaded(){!this.editorInput||this.loaded||(await this.load(),this.loaded=!0,this.requestUpdate())}async reload(){this.loaded=!1,await this.ensureLoaded(),await this.afterTabShown(),this.requestUpdate()}findWorkloadShell(e){let t=e;for(;t;){if(t instanceof H)return t;let e=t.parentElement;if(e)t=e;else{let e=t.getRootNode();t=e instanceof ShadowRoot?e.host:null}}return null}static{this.styles=[_`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        box-sizing: border-box;
      }

      .part-shell {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
        width: 100%;
      }

      .part-toolbar {
        flex: 0 0 auto;
      }

      .part-content {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
      }

      .part-content-inner {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-height: 0;
      }

      .muted {
        color: var(--wa-color-text-quiet);
        padding: var(--wa-space-m);
      }
    `]}};o([a()],J.prototype,`loaded`,void 0),o([a()],J.prototype,`tabRevealed`,void 0);var Y=class extends J{constructor(...e){super(...e),this.statusError=``,this.lifecycleBusy=!1}resetState(){this.status=void 0,this.statusError=``}async load(){let e=this.handler;if(!e?.getStatus){this.status={label:`Unknown`};return}this.statusError=``;try{this.status=await e.getStatus(this.context)}catch(e){this.statusError=e instanceof Error?e.message:String(e)}}canLifecycle(e){return this.capabilities.lifecycle?.includes(e)?oe(`cloud.workload.${e}`).allowed:!1}async runLifecycle(e){let t=this.handler;if(!(!t?.lifecycle||!this.canLifecycle(e))&&!(e===`stop`&&!await u(`Stop "${this.editorInput?.node.label}"?`))){this.lifecycleBusy=!0;try{await t.lifecycle(this.context,e),await this.reload()}catch(e){N(e)}finally{this.lifecycleBusy=!1}}}renderToolbar(){return h`${[{op:`start`,label:`Start`,icon:`play`},{op:`stop`,label:`Stop`,icon:`stop`},{op:`restart`,label:`Restart`,icon:`arrows-rotate`}].filter(e=>this.canLifecycle(e.op)).map(e=>h`
          <docks-command
            icon=${e.icon}
            title=${e.label}
            appearance="plain"
            ?disabled=${this.lifecycleBusy}
            .action=${()=>void j(()=>this.runLifecycle(e.op))}
          ></docks-command>
        `)}`}renderContent(){if(!this.editorInput)return h`<p class="muted">Loading…</p>`;if(!D.getHandler(this.context.connection.providerId))return h`<p class="muted">No workload handler for this provider.</p>`;if(this.statusError)return h`<p class="error-text">${this.statusError}</p>`;let e=this.editorInput?.node.meta;return h`
      <dl class="overview-dl">
        <dt>Status</dt>
        <dd>${this.status?.label??`—`}</dd>
        ${this.status?.detail?h`
              <dt>Detail</dt>
              <dd>${this.status.detail}</dd>
            `:g}
        <dt>Connection</dt>
        <dd>${this.context.connection.name}</dd>
        <dt>Provider</dt>
        <dd>${this.context.connection.providerId}</dd>
        ${e&&Object.keys(e).length>0?h`
              <dt>Metadata</dt>
              <dd><pre class="meta-pre">${JSON.stringify(e,null,2)}</pre></dd>
            `:g}
      </dl>
    `}static{this.styles=[_`
      .part-content {
        overflow: auto;
        padding: var(--wa-space-m);
        box-sizing: border-box;
      }

      .overview-dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.35rem 1rem;
        margin: 0;
      }

      .overview-dl dt {
        font-weight: 500;
        color: var(--wa-color-text-quiet);
      }

      .overview-dl dd {
        margin: 0;
      }

      .meta-pre {
        margin: 0;
        font-family: var(--wa-font-family-mono, monospace);
        font-size: var(--wa-font-size-s);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .muted {
        color: var(--wa-color-text-quiet);
      }

      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
      }
    `]}};o([a()],Y.prototype,`status`,void 0),o([a()],Y.prototype,`statusError`,void 0),o([a()],Y.prototype,`lifecycleBusy`,void 0),Y=o([r(`cloudadmin-workload-tab-overview`)],Y);function se(e){let t=[`#`,`message`];return e?{columns:t,rows:e.split(/\r?\n/).map((e,t)=>[t+1,e])}:{columns:t,rows:[]}}var X=class extends J{constructor(...e){super(...e),this.logsText=``,this.logsError=``}resetState(){this.logsText=``,this.logsError=``}async load(){if(!this.capabilities.logs){this.logsError=`Logs are not available for this workload.`;return}let e=this.handler;if(!e?.fetchLogs){this.logsError=`Logs are not available for this workload.`;return}this.logsError=``;try{this.logsText=await e.fetchLogs(this.context,{tail:500})}catch(e){this.logsText=``,this.logsError=e instanceof Error?e.message:String(e)}}renderToolbar(){return h`
      <docks-command
        icon="arrows-rotate"
        title="Refresh logs"
        appearance="plain"
        .action=${()=>void this.reload()}
      ></docks-command>
    `}async afterTabShown(){this.requestUpdate()}renderContent(){return!this.editorInput||!this.loaded&&!this.logsError||!this.tabRevealed?this.renderLoading():this.logsError?h`<p class="error-text">${this.logsError}</p>`:h`
      <docks-data-table
        .data=${se(this.logsText)}
        emptyMessage="No log output."
      ></docks-data-table>
    `}static{this.styles=[_`
      docks-data-table {
        flex: 1 1 0;
        min-height: 0;
        height: 100%;
      }

      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
        padding: var(--wa-space-m);
      }
    `]}};o([a()],X.prototype,`logsText`,void 0),o([a()],X.prototype,`logsError`,void 0),X=o([r(`cloudadmin-workload-tab-logs`)],X);var Z=class extends J{constructor(...e){super(...e),this.text=``,this.language=`json`,this.error=``,this.monacoRef=n()}resetState(){this.text=``,this.error=``}async load(){if(!this.capabilities.config){this.error=`Config is not available for this workload.`;return}let e=this.handler;if(!e?.fetchConfig){this.error=`Config is not available for this workload.`;return}this.error=``;try{let t=await e.fetchConfig(this.context);this.text=t.text,this.language=t.language??`json`}catch(e){this.text=``,this.error=e instanceof Error?e.message:String(e)}}async afterTabShown(){await this.layoutMonaco()}async layoutMonaco(){!this.tabRevealed||!this.text||(await this.updateComplete,await new Promise(e=>requestAnimationFrame(()=>e())),this.monacoRef.value?.layout?.())}renderToolbar(){return h`
      <docks-command
        icon="arrows-rotate"
        title="Refresh config"
        appearance="plain"
        .action=${()=>void this.reload()}
      ></docks-command>
    `}renderContent(){return!this.editorInput||!this.loaded&&!this.error?this.renderLoading():this.error?h`<p class="error-text">${this.error}</p>`:this.tabRevealed?h`
      <docks-monaco-widget
        ${t(this.monacoRef)}
        .value=${this.text}
        language=${this.language}
        .readOnly=${!0}
        auto-layout
      ></docks-monaco-widget>
    `:this.renderLoading()}static{this.styles=[_`
      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
        padding: var(--wa-space-m);
      }
    `]}};o([a()],Z.prototype,`text`,void 0),o([a()],Z.prototype,`language`,void 0),o([a()],Z.prototype,`error`,void 0),Z=o([r(`cloudadmin-workload-tab-config`)],Z);var Q=class extends J{constructor(...e){super(...e),this.text=``,this.error=``,this.monacoRef=n()}resetState(){this.text=``,this.error=``}async load(){if(!this.capabilities.inspect){this.error=`Inspect is not available for this workload.`;return}let e=this.handler;if(!e?.fetchInspect){this.error=`Inspect is not available for this workload.`;return}this.error=``;try{let t=await e.fetchInspect(this.context);this.text=JSON.stringify(t,null,2)}catch(e){this.text=``,this.error=e instanceof Error?e.message:String(e)}}async afterTabShown(){await this.layoutMonaco()}async layoutMonaco(){!this.tabRevealed||!this.text||(await this.updateComplete,await new Promise(e=>requestAnimationFrame(()=>e())),this.monacoRef.value?.layout?.())}renderToolbar(){return h`
      <docks-command
        icon="arrows-rotate"
        title="Refresh inspect"
        appearance="plain"
        .action=${()=>void this.reload()}
      ></docks-command>
    `}renderContent(){return!this.editorInput||!this.loaded&&!this.error?this.renderLoading():this.error?h`<p class="error-text">${this.error}</p>`:this.tabRevealed?h`
      <docks-monaco-widget
        ${t(this.monacoRef)}
        .value=${this.text}
        language="json"
        .readOnly=${!0}
        auto-layout
      ></docks-monaco-widget>
    `:this.renderLoading()}static{this.styles=[_`
      .error-text {
        color: var(--wa-color-danger-600, #dc2626);
        padding: var(--wa-space-m);
      }
    `]}};o([a()],Q.prototype,`text`,void 0),o([a()],Q.prototype,`error`,void 0),Q=o([r(`cloudadmin-workload-tab-inspect`)],Q);var $=!1;function ce(){if($)return;$=!0;let e=[{name:re,label:`Overview`,icon:`circle-info`,closable:!1,toolbar:!0,component:()=>h`<cloudadmin-workload-tab-overview></cloudadmin-workload-tab-overview>`},{name:w,label:`Logs`,icon:`scroll`,closable:!1,toolbar:!0,visible:()=>q(`logs`),component:()=>h`<cloudadmin-workload-tab-logs></cloudadmin-workload-tab-logs>`},{name:ae,label:`Config`,icon:`file-code`,closable:!1,toolbar:!0,visible:()=>q(`config`),component:()=>h`<cloudadmin-workload-tab-config></cloudadmin-workload-tab-config>`},{name:O,label:`Inspect`,icon:`magnifying-glass`,closable:!1,toolbar:!0,visible:()=>q(`inspect`),component:()=>h`<cloudadmin-workload-tab-inspect></cloudadmin-workload-tab-inspect>`}];for(let t of e)i.registerContribution(S,t)}function le(){ce(),p.registerEditorInputHandler({editorId:A,label:`Cloud workload`,icon:`box`,ranking:50,canHandle:e=>T(e),handle:async e=>{let t=e;return{key:`cloudadmin:workload:${t.node.nodeId}`,title:t.node.label,icon:t.node.icon??`box`,data:t,state:{},component:e=>h`
          <cloudadmin-workload-editor
            id="${e}"
            .editorInput=${t}
          ></cloudadmin-workload-editor>
        `}}})}function ue(){le(),V(),i.registerContribution(d,{label:`Scope`,slot:`center`,component:()=>(e.get(),h`
        <span class="cloudadmin-scope" style="display:inline-flex;align-items:center;gap:0.5rem;">
          <wa-icon name="crosshairs"></wa-icon>
          <span>${ne()?.label??`No cloud scope selected`}</span>
        </span>
      `)})}export{ue as default};